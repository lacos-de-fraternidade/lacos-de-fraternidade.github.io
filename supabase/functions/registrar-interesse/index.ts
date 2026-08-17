import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { randomToken, sha256Hex } from "../_shared/crypto.ts";
import { sendSecretarioEmail } from "../_shared/email.ts";
import { normalizeInteresse } from "../_shared/validation.ts";

const TOKEN_TTL_MINUTES = 10;
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

  const normalized = normalizeInteresse(payload);
  if (normalized.spam) {
    return jsonResponse(req, 200, { ok: true });
  }
  if (normalized.errors.length > 0 || !normalized.data) {
    return jsonResponse(req, 422, { ok: false, error: normalized.errors[0], errors: normalized.errors });
  }

  const data = normalized.data;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
    supabase
      .from("interesse")
      .select("id", { count: "exact", head: true })
      .eq("email", data.email)
      .gte("created_at", sinceDay),
    supabase
      .from("interesse")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceWindow),
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

  const { data: interesse, error: insertError } = await supabase
    .from("interesse")
    .insert(data)
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

  const token = randomToken();
  const { error: tokenError } = await supabase.from("cartilha_token").insert({
    interesse_id: interesse.id,
    token_hash: await sha256Hex(token),
    expires_at: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  const cartilhaToken = tokenError ? null : token;
  if (tokenError) {
    console.error("cartilha_token", tokenError.code || "erro");
  }

  let secretaryEmailSent = false;
  try {
    const secretary = await sendSecretarioEmail(data);
    secretaryEmailSent = Boolean(secretary.sent);
  } catch (error) {
    console.error("Falha no e-mail do secretário", { name: error instanceof Error ? error.name : "erro" });
  }

  return jsonResponse(req, 200, {
    ok: true,
    registrationSuccess: true,
    secretaryEmailSent,
    token: cartilhaToken,
    expiresInMinutes: TOKEN_TTL_MINUTES,
  });
});
