import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import {
  GENERIC_BOOTSTRAP_MESSAGE,
  inviteExpiresAt,
  sendMemberInvite,
  serviceClient,
  writeAuthLog,
} from "../_shared/members.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") {
    return jsonResponse(req, 200, { ok: true, message: GENERIC_BOOTSTRAP_MESSAGE });
  }
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  const secret = Deno.env.get("BOOTSTRAP_INVITE_SECRET") || "";
  const provided = req.headers.get("x-bootstrap-secret") || "";
  const supabase = serviceClient();
  const { count: activatedAdmins } = await supabase
    .from("irmaos_autorizados")
    .select("id", { count: "exact", head: true })
    .eq("perfil", "administrador")
    .eq("conta_ativada", true);

  const canBootstrap = secret.length >= 16 && provided === secret && (activatedAdmins ?? 0) === 0;
  await writeAuthLog({
    evento: "bootstrap_utilizado",
    sucesso: canBootstrap,
    req,
  });

  if (canBootstrap) {
    const { data: config } = await supabase.from("configuracoes_autenticacao").select("*").eq("id", 1).maybeSingle();
    const { data: admin } = await supabase
      .from("irmaos_autorizados")
      .select("*")
      .eq("perfil", "administrador")
      .eq("conta_ativada", false)
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (admin?.ativo) {
      await sendMemberInvite(admin, inviteExpiresAt(config), req);
    }
  }

  return jsonResponse(req, 200, { ok: true, message: GENERIC_BOOTSTRAP_MESSAGE });
});
