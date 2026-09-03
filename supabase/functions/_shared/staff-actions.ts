export const MEMBER_PROFILES = ["irmao", "secretario", "veneravel_mestre", "administrador"] as const;
export const STAFF_PROFILES = ["secretario", "veneravel_mestre", "administrador"] as const;
export const ADMIN_PROFILES = ["administrador"] as const;

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
  "listar_gestao",
  "listar_historico",
  "atribuir_cargo",
  "encerrar_cargo",
] as const;
export const ADMIN_ACTIONS = ["alterar_perfil", "revogar", "logs", "configurar", "excluir_irmao"] as const;

export const CAPABILITIES = {
  decidir_ordem_do_dia: ["veneravel_mestre"],
} as const;

export type MemberProfile = typeof MEMBER_PROFILES[number];
export type Capability = keyof typeof CAPABILITIES;

export function isMemberProfile(perfil?: string | null) {
  return (MEMBER_PROFILES as readonly string[]).includes(String(perfil || ""));
}

export function isStaffProfile(perfil?: string | null) {
  return (STAFF_PROFILES as readonly string[]).includes(String(perfil || ""));
}

export function isAdminProfile(perfil?: string | null) {
  return (ADMIN_PROFILES as readonly string[]).includes(String(perfil || ""));
}

export function hasCapability(
  member: { ativo?: boolean; conta_ativada?: boolean; perfil?: string } | null,
  capability: Capability,
) {
  if (!member || member.ativo !== true || member.conta_ativada !== true) return false;
  return (CAPABILITIES[capability] as readonly string[]).includes(String(member.perfil || ""));
}

export function assignableProfiles(actorPerfil?: string): string[] {
  if (actorPerfil === "administrador") return [...MEMBER_PROFILES];
  if (actorPerfil === "veneravel_mestre" || actorPerfil === "secretario") return ["irmao", "secretario"];
  return ["irmao"];
}

export function resolveAssignableProfile(
  actorPerfil: string | undefined,
  requested: unknown,
): { ok: true; perfil: string } | { ok: false; error: string } {
  const perfil = String(requested || "irmao").trim() || "irmao";
  if (!isMemberProfile(perfil)) {
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
    return isAdminProfile(member.perfil) ? { ok: true } : { ok: false, status: 403 };
  }
  if ((STAFF_ACTIONS as readonly string[]).includes(acao)) {
    return isStaffProfile(member.perfil) ? { ok: true } : { ok: false, status: 403 };
  }
  return { ok: false, status: 400 };
}
