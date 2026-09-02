export const MEMBER_PROFILES = ["irmao", "secretario", "veneravel_mestre", "administrador"];
export const STAFF_PROFILES = ["secretario", "veneravel_mestre", "administrador"];
export const ADMIN_PROFILES = ["administrador"];

export const MEMBER_SELF_ACTIONS = ["registrar_logout", "registrar_senha_alterada"];
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
];
export const ADMIN_ACTIONS = ["alterar_perfil", "revogar", "logs", "configurar", "excluir_irmao"];

export const CAPABILITIES = {
  decidir_ordem_do_dia: ["veneravel_mestre"],
};

export const PERFIL_LABELS = {
  irmao: "Irmão",
  secretario: "Secretário",
  veneravel_mestre: "Venerável Mestre",
  administrador: "Administrador",
};

export function isMemberProfile(perfil) {
  return MEMBER_PROFILES.includes(String(perfil || ""));
}

export function isStaffProfile(perfil) {
  return STAFF_PROFILES.includes(String(perfil || ""));
}

export function isAdminProfile(perfil) {
  return ADMIN_PROFILES.includes(String(perfil || ""));
}

export function hasCapability(member, capability) {
  if (!member || member.ativo !== true || member.conta_ativada !== true) return false;
  const allowed = CAPABILITIES[capability] || [];
  return allowed.includes(member.perfil);
}

export function assignableProfiles(actorPerfil) {
  if (actorPerfil === "administrador") return [...MEMBER_PROFILES];
  if (actorPerfil === "veneravel_mestre" || actorPerfil === "secretario") return ["irmao", "secretario"];
  return ["irmao"];
}

export function resolveAssignableProfile(actorPerfil, requested) {
  const perfil = String(requested || "irmao").trim() || "irmao";
  if (!isMemberProfile(perfil)) {
    return { ok: false, error: "Perfil inválido." };
  }
  if (!assignableProfiles(actorPerfil).includes(perfil)) {
    return { ok: false, error: "Perfil não autorizado." };
  }
  return { ok: true, perfil };
}

export function authorizeGerenciarAcao(member, acao) {
  if (!acao) return { ok: false, status: 400 };
  if (!member || member.ativo !== true || member.conta_ativada !== true) {
    return { ok: false, status: 403 };
  }
  if (MEMBER_SELF_ACTIONS.includes(acao)) return { ok: true };
  if (ADMIN_ACTIONS.includes(acao)) {
    return isAdminProfile(member.perfil) ? { ok: true } : { ok: false, status: 403 };
  }
  if (STAFF_ACTIONS.includes(acao)) {
    return isStaffProfile(member.perfil) ? { ok: true } : { ok: false, status: 403 };
  }
  return { ok: false, status: 400 };
}
