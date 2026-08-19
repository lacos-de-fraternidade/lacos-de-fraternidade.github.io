import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { jsonResponse } from "./cors.ts";
import { hmacSha256Hex } from "./crypto.ts";

export const GENERIC_LOGIN_ERROR = "CIM ou senha inválida.";
export const GENERIC_LATER_ERROR = "Não foi possível realizar o acesso. Verifique os dados informados e tente novamente mais tarde.";
export const GENERIC_INVITE_ERROR = "Não foi possível concluir esta ação. Tente novamente ou fale com a Secretaria.";
export const GENERIC_RECOVERY_MESSAGE = "Caso exista uma conta ativa vinculada à CIM informada, enviaremos as instruções de recuperação ao e-mail cadastrado.";
export const GENERIC_BOOTSTRAP_MESSAGE = "Se o procedimento ainda estiver disponível, o convite será enviado.";

const MIN_PEPPER_LENGTH = 16;

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function userAuthClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  return (req.headers.get("cf-connecting-ip") || forwarded.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
}

export function getAuthPepper() {
  const pepper = Deno.env.get("AUTH_HASH_PEPPER") ?? "";
  if (pepper.length < MIN_PEPPER_LENGTH) return null;
  return pepper;
}

export async function hmacPrivate(context: "cim" | "ip", value: string) {
  const pepper = getAuthPepper();
  if (!pepper) return null;
  return hmacSha256Hex(pepper, `${context}:${value}`);
}

export async function writeAuthLog(input: {
  authUserId?: string | null;
  cim?: string;
  evento: string;
  sucesso: boolean;
  req: Request;
}) {
  const supabase = serviceClient();
  const ua = (input.req.headers.get("user-agent") || "").slice(0, 180);
  await supabase.from("logs_autenticacao").insert({
    auth_user_id: input.authUserId || null,
    cim_hash: input.cim ? await hmacPrivate("cim", input.cim) : null,
    evento: input.evento,
    sucesso: input.sucesso,
    ip_hash: await hmacPrivate("ip", clientIp(input.req) || "unknown"),
    user_agent: ua,
  });
}

export function inviteExpiresAt(config: { convite_validade_horas?: number; auth_otp_expira_segundos?: number } | null) {
  const appMs = (config?.convite_validade_horas ?? 24) * 60 * 60 * 1000;
  const otpMs = (config?.auth_otp_expira_segundos ?? 3600) * 1000;
  return new Date(Date.now() + Math.min(appMs, otpMs)).toISOString();
}

export async function sendMemberInvite(
  member: { id: string; email: string; cim: string },
  expiresAt: string,
  req: Request,
  userId?: string,
) {
  const supabase = serviceClient();
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://lacos-de-fraternidade.github.io";
  const redirectTo = `${siteUrl}/area-restrita/ativar/`;
  const invited = await supabase.auth.admin.inviteUserByEmail(member.email, { redirectTo });
  if (invited.error) {
    await supabase.auth.resetPasswordForEmail(member.email, { redirectTo });
  }
  await supabase.from("irmaos_autorizados").update({
    convite_enviado_em: new Date().toISOString(),
    convite_expira_em: expiresAt,
    conta_ativada: false,
  }).eq("id", member.id);
  await writeAuthLog({ cim: member.cim, evento: "convite_enviado", sucesso: true, req, authUserId: userId });
}

export async function revokeMemberAuth(authUserId: string | null | undefined, ban: boolean) {
  if (!authUserId) return;
  const supabase = serviceClient();
  await supabase.auth.admin.signOut(authUserId, "global");
  await supabase.auth.admin.updateUserById(authUserId, {
    ban_duration: ban ? "876000h" : "none",
  });
}

export async function requireUser(req: Request): Promise<{ user: User } | Response> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || token.split(".").length !== 3) {
    return jsonResponse(req, 401, { ok: false, error: "Sessão inválida." });
  }
  const supabase = userAuthClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return jsonResponse(req, 401, { ok: false, error: "Sessão inválida." });
  }
  return { user: data.user };
}

export async function loadMemberByUserId(userId: string) {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("irmaos_autorizados")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return data;
}

export async function requireActiveMember(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const member = await loadMemberByUserId(auth.user.id);
  if (!member || member.ativo !== true || member.conta_ativada !== true) {
    return jsonResponse(req, 403, { ok: false, error: GENERIC_INVITE_ERROR });
  }
  return { user: auth.user, member };
}
