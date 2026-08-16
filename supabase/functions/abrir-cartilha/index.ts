import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { sha256Hex } from "../_shared/crypto.ts";

const PDF_PATH = "cartilha-do-candidato.pdf";

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

  let payload: { token?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { ok: false, error: "Não foi possível ler o pedido de acesso." });
  }

  const token = String(payload.token ?? "").trim();
  if (!token) {
    return jsonResponse(req, 400, { ok: false, error: "O acesso à cartilha é inválido." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = await sha256Hex(token);
  const { data: tokenRow, error: lookupError } = await supabase
    .from("cartilha_token")
    .select("id, used_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (lookupError) {
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível validar o acesso." });
  }

  if (!tokenRow) {
    return jsonResponse(req, 404, { ok: false, error: "Este acesso é inválido." });
  }

  if (tokenRow.used_at) {
    return jsonResponse(req, 410, { ok: false, error: "Este acesso já foi utilizado." });
  }

  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return jsonResponse(req, 410, { ok: false, error: "Este acesso expirou." });
  }

  const { data: consumed, error: consumeError } = await supabase
    .from("cartilha_token")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();

  if (consumeError) {
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível liberar a cartilha." });
  }

  if (!consumed) {
    return jsonResponse(req, 410, { ok: false, error: "Este acesso já foi utilizado ou expirou." });
  }

  const { data: pdf, error: downloadError } = await supabase.storage
    .from("cartilha")
    .download(PDF_PATH);

  if (downloadError || !pdf) {
    await supabase.from("cartilha_token").update({ used_at: null }).eq("id", tokenRow.id);
    return jsonResponse(req, 503, { ok: false, error: "A cartilha não está disponível no momento." });
  }

  return new Response(pdf, {
    status: 200,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Cartilha-do-Candidato.pdf"',
      "Cache-Control": "no-store",
    },
  });
});
