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
  "cancelar_convite",
  "importar_celebracoes",
  "listar_cadastro",
  "salvar_irmao",
  "salvar_familiar",
  "salvar_casamento",
  "remover_familiar",
  "remover_casamento",
  "listar_gestao",
  "listar_historico",
  "convidar_gestao",
  "salvar_gestao_irmao",
  "afastar_irmao",
  "quiet_placet",
  "encerrar_quiet_placet",
  "regularizar_situacao",
  "transferencia",
  "atualizar_transferencia",
  "suspender_acesso",
  "reativar",
  "listar_eventos",
  "salvar_evento",
  "cancelar_evento",
  "gerar_sessoes",
  "listar_comunicados",
  "salvar_comunicado",
] as const;
export const ADMIN_ACTIONS = ["alterar_perfil", "revogar", "logs", "configurar", "excluir_irmao"] as const;
export const MEMBER_PROFILES = ["irmao", "secretario", "administrador"] as const;

export function assignableProfiles(actorPerfil?: string): string[] {
  if (actorPerfil === "administrador") return [...MEMBER_PROFILES];
  if (actorPerfil === "secretario") return ["irmao", "secretario"];
  return ["irmao"];
}

export function resolveAssignableProfile(
  actorPerfil: string | undefined,
  requested: unknown,
): { ok: true; perfil: string } | { ok: false; error: string } {
  const perfil = String(requested || "irmao").trim() || "irmao";
  if (!(MEMBER_PROFILES as readonly string[]).includes(perfil)) {
    return { ok: false, error: "Perfil inválido." };
  }
  if (!assignableProfiles(actorPerfil).includes(perfil)) {
    return { ok: false, error: "Perfil não autorizado." };
  }
  return { ok: true, perfil };
}

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
