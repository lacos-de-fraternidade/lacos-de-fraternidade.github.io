import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { isValidCim, normalizeCim } from "../_shared/cim.ts";
import {
  GENERIC_LATER_ERROR,
  GENERIC_LOGIN_ERROR,
  clientIp,
  getAuthPepper,
  hmacPrivate,
  serviceClient,
  userAuthClient,
  writeAuthLog,
} from "../_shared/members.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { ok: false, error: GENERIC_LOGIN_ERROR });
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);
  if (!getAuthPepper()) return jsonResponse(req, 503, { ok: false, error: GENERIC_LATER_ERROR });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { ok: false, error: GENERIC_LOGIN_ERROR });
  }

  const cim = normalizeCim(payload.cim);
  const password = String(payload.password ?? "");
  if (!isValidCim(cim) || !password) {
    return jsonResponse(req, 401, { ok: false, error: GENERIC_LOGIN_ERROR });
  }

  const supabase = serviceClient();
  const { data: config } = await supabase.from("configuracoes_autenticacao").select("*").eq("id", 1).maybeSingle();
  const maxCim = config?.max_falhas_cim ?? 5;
  const windowMin = config?.janela_falhas_minutos ?? 15;
  const maxIp = config?.max_falhas_ip ?? 20;
  const blockMin = config?.bloqueio_inicial_minutos ?? 15;

  const ipHash = await hmacPrivate("ip", clientIp(req) || "unknown");
  if (!ipHash) return jsonResponse(req, 503, { ok: false, error: GENERIC_LATER_ERROR });

  const { data: ipRow } = await supabase.from("auth_rate_ip").select("*").eq("ip_hash", ipHash).maybeSingle();
  if (ipRow?.bloqueado_ate && new Date(ipRow.bloqueado_ate) > new Date()) {
    await writeAuthLog({ cim, evento: "conta_bloqueada", sucesso: false, req });
    return jsonResponse(req, 429, { ok: false, error: GENERIC_LATER_ERROR });
  }

  const { data: member } = await supabase.from("irmaos_autorizados").select("*").eq("cim", cim).maybeSingle();
  const blocked = member?.bloqueado_ate && new Date(member.bloqueado_ate) > new Date();
  if (blocked) {
    await writeAuthLog({ cim, evento: "conta_bloqueada", sucesso: false, req, authUserId: member?.auth_user_id });
    return jsonResponse(req, 429, { ok: false, error: GENERIC_LATER_ERROR });
  }

  async function registerFailure() {
    const now = new Date();
    if (!ipRow || new Date(ipRow.janela_inicio).getTime() < now.getTime() - windowMin * 60 * 1000) {
      await supabase.from("auth_rate_ip").upsert({
        ip_hash: ipHash,
        falhas: 1,
        janela_inicio: now.toISOString(),
        bloqueado_ate: null,
      });
    } else {
      const falhas = (ipRow.falhas || 0) + 1;
      await supabase.from("auth_rate_ip").update({
        falhas,
        bloqueado_ate: falhas >= maxIp ? new Date(now.getTime() + blockMin * 60 * 1000).toISOString() : null,
      }).eq("ip_hash", ipHash);
    }
    if (member) {
      const falhas = (member.tentativas_falhas || 0) + 1;
      const multiplier = Math.min(4, Math.ceil(falhas / maxCim));
      await supabase.from("irmaos_autorizados").update({
        tentativas_falhas: falhas,
        bloqueado_ate: falhas >= maxCim
          ? new Date(now.getTime() + blockMin * multiplier * 60 * 1000).toISOString()
          : member.bloqueado_ate,
      }).eq("id", member.id);
    }
    await writeAuthLog({ cim, evento: "login_falha", sucesso: false, req, authUserId: member?.auth_user_id });
  }

  if (!member || !member.ativo || !member.conta_ativada || !member.email) {
    await registerFailure();
    return jsonResponse(req, 401, { ok: false, error: GENERIC_LOGIN_ERROR });
  }

  const authClient = userAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: member.email,
    password,
  });

  if (error || !data.session) {
    await registerFailure();
    return jsonResponse(req, 401, { ok: false, error: GENERIC_LOGIN_ERROR });
  }

  await supabase.from("irmaos_autorizados").update({
    tentativas_falhas: 0,
    bloqueado_ate: null,
    ultimo_acesso_em: new Date().toISOString(),
  }).eq("id", member.id);
  await supabase.from("auth_rate_ip").upsert({
    ip_hash: ipHash,
    falhas: 0,
    janela_inicio: new Date().toISOString(),
    bloqueado_ate: null,
  });
  await writeAuthLog({
    cim,
    evento: "login_sucesso",
    sucesso: true,
    req,
    authUserId: data.user?.id,
  });

  return jsonResponse(req, 200, {
    ok: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
    },
  });
});
