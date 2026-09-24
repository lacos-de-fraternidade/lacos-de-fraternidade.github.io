import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { randomToken, sha256Hex } from "../_shared/crypto.ts";
import { runConclusaoCandidatura } from "../_shared/conclusao-candidatura.js";
import { loadCandidaturaDossie, resolveProponenteEmail } from "../_shared/dossie-secretaria.ts";
import { sendProponenteEmail, sendSecretarioEmail } from "../_shared/email.ts";
import { normalizeCandidatura, requiredDocumentTypes } from "../_shared/candidatura.ts";

const TOKEN_TTL_MINUTES = 10;
const UPLOAD_TTL_MINUTES = 40;
const MAX_SUBMISSIONS_PER_DAY = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") {
    return jsonResponse(req, 405, { ok: false, error: "Método não permitido." });
  }
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, 500, { ok: false, error: "Serviço temporariamente indisponível." });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { ok: false, error: "Não foi possível ler os dados enviados." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (String(payload.acao || "") === "concluir") {
    return concluirCandidatura(req, supabase, payload);
  }

  const normalized = normalizeCandidatura(payload);
  if (normalized.spam) {
    return jsonResponse(req, 200, { ok: true });
  }
  if (normalized.errors.length > 0 || !normalized.data) {
    return jsonResponse(req, 422, { ok: false, error: normalized.errors[0], errors: normalized.errors });
  }

  const data = normalized.data;
  const { data: eligible } = await supabase.rpc("proponente_elegivel", { p_id: data.proponente_id });
  if (eligible !== true) {
    return jsonResponse(req, 422, {
      ok: false,
      error: "O Irmão informado não pode constar como proponente. Selecione um Irmão ativo da Loja.",
    });
  }

  const [{ data: byEmail }, { data: byCpf }] = await Promise.all([
    supabase.from("interesse").select("id").eq("email", data.email).limit(1),
    supabase.from("interesse").select("id").eq("cpf", data.cpf).limit(1),
  ]);
  if ((byEmail && byEmail.length > 0) || (byCpf && byCpf.length > 0)) {
    return jsonResponse(req, 409, {
      ok: false,
      error: "Já existe uma manifestação registrada com estes dados. Se precisar de orientação, fale com a Secretaria.",
    });
  }

  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sinceWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [{ count, error: countError }, { count: recentCount, error: recentError }] = await Promise.all([
    supabase.from("interesse").select("id", { count: "exact", head: true }).eq("email", data.email).gte("created_at", sinceDay),
    supabase.from("interesse").select("id", { count: "exact", head: true }).gte("created_at", sinceWindow),
  ]);
  if (countError || recentError) {
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível registrar o interesse." });
  }
  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_DAY || (recentCount ?? 0) >= 8) {
    return jsonResponse(req, 429, {
      ok: false,
      error: "Há registros recentes com estes dados. Tente novamente mais tarde.",
    });
  }

  const {
    filhos,
    referencias,
    referencia_comercial,
    ...interesseRow
  } = data;

  const { data: interesse, error: insertError } = await supabase
    .from("interesse")
    .insert(interesseRow)
    .select("id")
    .single();

  if (insertError || !interesse) {
    if (insertError?.code === "23505") {
      return jsonResponse(req, 409, {
        ok: false,
        error: "Já existe uma manifestação registrada com estes dados. Se precisar de orientação, fale com a Secretaria.",
      });
    }
    console.error("insert interesse", insertError?.code || "erro");
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível salvar o registro." });
  }

  const abortPartial = async (message: string, code?: string) => {
    console.error("candidatura parcial", code || "erro");
    await supabase.from("interesse").delete().eq("id", interesse.id);
    return jsonResponse(req, 500, { ok: false, error: message });
  };

  if (filhos.length) {
    const { error } = await supabase.from("interesse_filhos").insert(
      filhos.map((filho) => ({ ...filho, interesse_id: interesse.id })),
    );
    if (error) return abortPartial("Não foi possível salvar os filhos.", error.code);
  }
  if (referencias.length) {
    const { error } = await supabase.from("interesse_referencias").insert(
      referencias.map((item) => ({ ...item, interesse_id: interesse.id })),
    );
    if (error) return abortPartial("Não foi possível salvar as referências.", error.code);
  }
  const { error: comercialError } = await supabase.from("interesse_referencia_comercial").insert({
    interesse_id: interesse.id,
    ...referencia_comercial,
  });
  if (comercialError) {
    return abortPartial("Não foi possível salvar a referência comercial.", comercialError.code);
  }

  const uploadToken = randomToken();
  const { error: tokenError } = await supabase.from("interesse_upload_token").insert({
    interesse_id: interesse.id,
    token_hash: await sha256Hex(uploadToken),
    expires_at: new Date(Date.now() + UPLOAD_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (tokenError) {
    console.error("upload_token", tokenError.code || "erro");
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível iniciar o envio de documentos." });
  }

  return jsonResponse(req, 200, {
    ok: true,
    registrationStarted: true,
    uploadToken,
    documentosExigidos: requiredDocumentTypes(data.estado_civil),
    expiresInMinutes: UPLOAD_TTL_MINUTES,
  });
});

async function concluirCandidatura(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  const token = String(payload.token || payload.uploadToken || "").trim();
  if (!token) return jsonResponse(req, 400, { ok: false, error: "Envio de documentos inválido." });
  const tokenHash = await sha256Hex(token);

  const concluded = await runConclusaoCandidatura({ tokenHash }, {
    async claim(hash: string) {
      const { data, error } = await supabase.rpc("claim_conclusao_candidatura", { p_token_hash: hash });
      if (error) {
        console.error("conclusao claim", { code: error.code || "erro" });
        throw new Error("claim");
      }
      return Array.isArray(data) ? data[0] : data;
    },
    loadDossie: (interesseId: string) => loadCandidaturaDossie(supabase, interesseId),
    async release(tokenId: string) {
      const { error } = await supabase.rpc("release_conclusao_claim", { p_token_id: tokenId });
      if (error) console.error("conclusao release", { code: error.code || "erro" });
    },
    async criarCartilha(interesseId: string) {
      const cartilhaToken = randomToken();
      const { error } = await supabase.from("cartilha_token").insert({
        interesse_id: interesseId,
        token_hash: await sha256Hex(cartilhaToken),
        expires_at: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString(),
      });
      if (error) {
        console.error("cartilha_token", error.code || "erro");
        return { token: null, expiresInMinutes: TOKEN_TTL_MINUTES };
      }
      return { token: cartilhaToken, expiresInMinutes: TOKEN_TTL_MINUTES };
    },
    async enviarEmails(loaded: { payload: { interesse: Record<string, unknown> }; irmao: { nome?: string | null } | null }) {
      const interesse = loaded.payload.interesse;
      let secretaryEmailSent = false;
      let proponenteNotificacao = "nao_enviada";
      try {
        const secretary = await sendSecretarioEmail({
          ...loaded.payload,
          interesse: { ...interesse, documentacao_completa: true },
        });
        secretaryEmailSent = Boolean(secretary.sent);
      } catch (error) {
        console.error("Falha no e-mail do secretário", { name: error instanceof Error ? error.name : "erro" });
      }
      try {
        const resolved = await resolveProponenteEmail(supabase, loaded.irmao);
        if (!resolved.ok) {
          proponenteNotificacao = "falha";
        } else if (!resolved.email) {
          proponenteNotificacao = "sem_email";
        } else {
          const sent = await sendProponenteEmail({
            to: resolved.email,
            candidatoNome: String(interesse.nome || ""),
            proponenteNome: String(loaded.irmao?.nome || ""),
          });
          proponenteNotificacao = sent.sent ? "enviada" : "falha";
        }
      } catch (error) {
        console.error("Falha no e-mail do proponente", { name: error instanceof Error ? error.name : "erro" });
        proponenteNotificacao = "falha";
      }
      return { secretaryEmailSent, proponenteNotificacao };
    },
    async finalize(input: { tokenId: string; interesseId: string; notificacao: string }) {
      const { data, error } = await supabase.rpc("finalize_conclusao_candidatura", {
        p_token_id: input.tokenId,
        p_interesse_id: input.interesseId,
        p_notificacao: input.notificacao,
      });
      if (error) {
        console.error("conclusao finalize", { code: error.code || "erro" });
        return false;
      }
      return data === true;
    },
  });

  return jsonResponse(req, concluded.status, concluded.body);
}
