import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { jsonResponse } from "./cors.ts";
import { sha256Hex } from "./crypto.ts";

export const GENERIC_LOGIN_ERROR = "CIM ou senha inválida.";
export const GENERIC_LATER_ERROR = "Não foi possível realizar o acesso. Verifique os dados informados e tente novamente mais tarde.";
export const GENERIC_INVITE_ERROR = "Não foi possível concluir esta ação. Tente novamente ou fale com a Secretaria.";
export const GENERIC_RECOVERY_MESSAGE = "Caso exista uma conta ativa vinculada à CIM informada, enviaremos as instruções de recuperação ao e-mail cadastrado.";

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  return (req.headers.get("cf-connecting-ip") || forwarded.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
}

export async function hashPrivate(value: string) {
  const pepper = Deno.env.get("AUTH_HASH_PEPPER") || "lacos-auth-log";
  return sha256Hex(`${pepper}:${value}`);
}

export async function writeAuthLog(input: {
  authUserId?: string | null;
  cim?: string;
  evento: string;
  sucesso: boolean;
  req: Request;
}) {
  const supabase = serviceClient();
  const ua = (req.headers.get("user-agent") || "").slice(0, 180);
  await supabase.from("logs_autenticacao").insert({
    auth_user_id: input.authUserId || null,
    cim_hash: input.cim ? await hashPrivate(input.cim) : null,
    evento: input.evento,
    sucesso: input.sucesso,
    ip_hash: await hashPrivate(clientIp(input.req) || "unknown"),
    user_agent: ua,
  });
}

export async function requireUser(req: Request): Promise<{ user: User } | Response> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!url || !anon || !token) {
    return jsonResponse(req, 401, { ok: false, error: "Sessão inválida." });
  }
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
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

export async function requireStaff(req: Request, adminOnly = false) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const member = await loadMemberByUserId(auth.user.id);
  if (!member || !member.ativo || !member.conta_ativada) {
    return jsonResponse(req, 403, { ok: false, error: GENERIC_INVITE_ERROR });
  }
  const allowed = adminOnly
    ? member.perfil === "administrador"
    : member.perfil === "secretario" || member.perfil === "administrador";
  if (!allowed) {
    return jsonResponse(req, 403, { ok: false, error: GENERIC_INVITE_ERROR });
  }
  return { user: auth.user, member };
}
