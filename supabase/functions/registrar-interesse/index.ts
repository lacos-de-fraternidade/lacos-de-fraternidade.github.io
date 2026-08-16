import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { randomToken, sha256Hex } from "../_shared/crypto.ts";
import { sendInteresseEmail } from "../_shared/email.ts";
import { normalizeInteresse } from "../_shared/validation.ts";

const TOKEN_TTL_MINUTES = 10;
const MAX_SUBMISSIONS_PER_DAY = 5;

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

  const { errors, data } = normalizeInteresse(payload);
  if (errors.length > 0) {
    return jsonResponse(req, 422, { ok: false, error: errors[0], errors });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("interesse")
    .select("id", { count: "exact", head: true })
    .eq("email", data.email)
    .gte("created_at", since);

  if (countError) {
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível registrar o interesse." });
  }

  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_DAY) {
    return jsonResponse(req, 429, {
      ok: false,
      error: "Há registros recentes com este e-mail. Tente novamente mais tarde.",
    });
  }

  const { data: interesse, error: insertError } = await supabase
    .from("interesse")
    .insert(data)
    .select("id")
    .single();

  if (insertError || !interesse) {
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível salvar o registro." });
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: tokenError } = await supabase.from("cartilha_token").insert({
    interesse_id: interesse.id,
    token_hash: await sha256Hex(token),
    expires_at: expiresAt,
  });

  if (tokenError) {
    return jsonResponse(req, 500, { ok: false, error: "O registro foi salvo, mas a cartilha não pôde ser liberada." });
  }

  try {
    await sendInteresseEmail(data);
  } catch (error) {
    console.error("Falha ao enviar e-mail de interesse", error);
    return jsonResponse(req, 500, {
      ok: false,
      error: "O registro foi salvo, mas o e-mail de notificação não pôde ser enviado.",
    });
  }

  return jsonResponse(req, 200, {
    ok: true,
    token,
    expiresAt,
    expiresInMinutes: TOKEN_TTL_MINUTES,
  });
});
