export const MEMBER_SELF_ACTIONS = ["registrar_logout", "registrar_senha_alterada"] as const;
export const STAFF_ACTIONS = [
  "listar",
  "criar",
  "atualizar",
  "enviar_convite",
  "reenviar_convite",
  "ativar",
  "desativar",
  "desbloquear",
  "importar_celebracoes",
] as const;
export const ADMIN_ACTIONS = ["alterar_perfil", "revogar", "logs", "configurar"] as const;

export function authorizeGerenciarAcao(
  member: { ativo?: boolean; conta_ativada?: boolean; perfil?: string } | null,
  acao: string,
): { ok: true } | { ok: false; status: number } {
  if (!acao) return { ok: false, status: 400 };
  if (!member || member.ativo !== true || member.conta_ativada !== true) {
    return { ok: false, status: 403 };
  }
  if ((MEMBER_SELF_ACTIONS as readonly string[]).includes(acao)) return { ok: true };
  if ((ADMIN_ACTIONS as readonly string[]).includes(acao)) {
    return member.perfil === "administrador" ? { ok: true } : { ok: false, status: 403 };
  }
  if ((STAFF_ACTIONS as readonly string[]).includes(acao)) {
    return member.perfil === "secretario" || member.perfil === "administrador"
      ? { ok: true }
      : { ok: false, status: 403 };
  }
  return { ok: false, status: 400 };
}
