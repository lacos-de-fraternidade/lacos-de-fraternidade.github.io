import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { isValidCim, normalizeCim } from "../_shared/cim.ts";
import {
  GENERIC_RECOVERY_MESSAGE,
  clientIp,
  getAuthPepper,
  hmacPrivate,
  serviceClient,
  userAuthClient,
  writeAuthLog,
} from "../_shared/members.ts";
import { passwordResetUrl } from "../_shared/site-url.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return jsonResponse(req, 200, { ok: true, message: GENERIC_RECOVERY_MESSAGE });
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const cim = normalizeCim(payload.cim);
  const supabase = serviceClient();
  const { data: config } = await supabase.from("configuracoes_autenticacao").select("*").eq("id", 1).maybeSingle();
  const windowMin = config?.janela_falhas_minutos ?? 15;
  const maxIp = config?.max_recuperacoes_ip ?? 5;
  const maxCim = config?.max_recuperacoes_cim ?? 3;
  const since = new Date(Date.now() - windowMin * 60 * 1000).toISOString();

  const pepperReady = Boolean(getAuthPepper());
  const ipHash = pepperReady ? await hmacPrivate("ip", clientIp(req) || "unknown") : null;
  const cimHash = pepperReady && isValidCim(cim) ? await hmacPrivate("cim", cim) : null;

  let limited = !pepperReady;
  if (ipHash) {
    const { count: ipCount } = await supabase
      .from("logs_autenticacao")
      .select("id", { count: "exact", head: true })
      .eq("evento", "recuperacao_solicitada")
      .eq("ip_hash", ipHash)
      .gte("criado_em", since);
    if ((ipCount ?? 0) >= maxIp) limited = true;
  }
  if (cimHash) {
    const { count: cimCount } = await supabase
      .from("logs_autenticacao")
      .select("id", { count: "exact", head: true })
      .eq("evento", "recuperacao_solicitada")
      .eq("cim_hash", cimHash)
      .gte("criado_em", since);
    if ((cimCount ?? 0) >= maxCim) limited = true;
  }

  if (!limited && isValidCim(cim)) {
    const { data: member } = await supabase.from("irmaos_autorizados").select("*").eq("cim", cim).maybeSingle();
    if (member?.ativo && member.conta_ativada && member.email) {
      try {
        await userAuthClient().auth.resetPasswordForEmail(member.email, {
          redirectTo: passwordResetUrl(String(payload.site_origin || "")),
        });
      } catch {
        // A falha do mailer não deve vazar se a CIM existe.
      }
    }
  }

  await writeAuthLog({ cim: isValidCim(cim) ? cim : undefined, evento: "recuperacao_solicitada", sucesso: true, req });
  return jsonResponse(req, 200, { ok: true, message: GENERIC_RECOVERY_MESSAGE });
});
