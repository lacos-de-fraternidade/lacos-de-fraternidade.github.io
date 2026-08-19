import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { isValidCim, normalizeCim } from "../_shared/cim.ts";
import {
  GENERIC_RECOVERY_MESSAGE,
  clientIp,
  hashPrivate,
  serviceClient,
  writeAuthLog,
} from "../_shared/members.ts";

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://lacos-de-fraternidade.github.io";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { ok: false, error: GENERIC_RECOVERY_MESSAGE });
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const cim = normalizeCim(payload.cim);
  const supabase = serviceClient();
  const ipHash = await hashPrivate(clientIp(req) || "unknown");
  const { data: ipRow } = await supabase.from("auth_rate_ip").select("*").eq("ip_hash", ipHash).maybeSingle();
  if (ipRow?.bloqueado_ate && new Date(ipRow.bloqueado_ate) > new Date()) {
    return jsonResponse(req, 200, { ok: true, message: GENERIC_RECOVERY_MESSAGE });
  }

  if (isValidCim(cim)) {
    const { data: member } = await supabase.from("irmaos_autorizados").select("*").eq("cim", cim).maybeSingle();
    if (member?.ativo && member.conta_ativada && member.email) {
      await supabase.auth.admin.resetPasswordForEmail(member.email, {
        redirectTo: `${SITE_URL}/area-restrita/redefinir-senha/`,
      });
    }
  }

  await writeAuthLog({ cim: isValidCim(cim) ? cim : undefined, evento: "recuperacao_solicitada", sucesso: true, req });
  return jsonResponse(req, 200, { ok: true, message: GENERIC_RECOVERY_MESSAGE });
});
