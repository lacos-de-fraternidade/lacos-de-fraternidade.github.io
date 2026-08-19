import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { isValidCim, normalizeCim } from "../_shared/cim.ts";
import { inspectPassword } from "../_shared/password.ts";
import {
  GENERIC_INVITE_ERROR,
  requireUser,
  serviceClient,
  writeAuthLog,
} from "../_shared/members.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { ok: false, error: GENERIC_INVITE_ERROR });
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
  }

  const cim = normalizeCim(payload.cim);
  const password = String(payload.password ?? "");
  const confirm = String(payload.confirmacao ?? payload.passwordConfirm ?? "");
  const termos = payload.termos === true;
  if (!isValidCim(cim) || !termos || password !== confirm) {
    return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
  }

  const email = (auth.user.email || "").toLowerCase();
  const strength = inspectPassword(password, { cim, email });
  if (!strength.ok) {
    return jsonResponse(req, 400, { ok: false, error: strength.errors[0] });
  }

  const supabase = serviceClient();
  const { data: member } = await supabase.from("irmaos_autorizados").select("*").eq("cim", cim).maybeSingle();
  const { data: taken } = await supabase
    .from("irmaos_autorizados")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  const inviteValid = member?.convite_expira_em && new Date(member.convite_expira_em) > new Date();
  if (
    !member ||
    !member.ativo ||
    member.conta_ativada ||
    member.email !== email ||
    !inviteValid ||
    (member.auth_user_id && member.auth_user_id !== auth.user.id) ||
    (taken && taken.id !== member.id)
  ) {
    await writeAuthLog({ cim, evento: "login_falha", sucesso: false, req, authUserId: auth.user.id });
    return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
  }

  const { error: passError } = await supabase.auth.admin.updateUserById(auth.user.id, { password });
  if (passError) {
    return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
  }

  const { error: updateError } = await supabase.from("irmaos_autorizados").update({
    auth_user_id: auth.user.id,
    conta_ativada: true,
    conta_ativada_em: new Date().toISOString(),
    convite_expira_em: new Date().toISOString(),
    tentativas_falhas: 0,
    bloqueado_ate: null,
  }).eq("id", member.id);
  if (updateError) {
    return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
  }

  await writeAuthLog({ cim, evento: "conta_ativada", sucesso: true, req, authUserId: auth.user.id });
  return jsonResponse(req, 200, { ok: true });
});
