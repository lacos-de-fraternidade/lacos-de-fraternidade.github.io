import {
  isAdminProfile,
  isStaffProfile,
} from "./perfis.js";

export {
  ADMIN_PROFILES,
  CAPABILITIES,
  MEMBER_PROFILES,
  PERFIL_LABELS,
  STAFF_PROFILES,
  assignableProfiles,
  authorizeGerenciarAcao,
  hasCapability,
  isAdminProfile,
  isMemberProfile,
  isStaffProfile,
  resolveAssignableProfile,
} from "./perfis.js";

export const VENERAVEL_MESTRE = "veneravel_mestre";

export const INSTITUTIONAL_OFFICES = [
  "veneravel_mestre",
  "primeiro_vigilante",
  "segundo_vigilante",
  "orador",
  "secretario",
  "tesoureiro",
  "chanceler",
  "hospitaleiro",
  "mestre_cerimonias",
  "primeiro_diacono",
  "segundo_diacono",
  "primeiro_experto",
  "segundo_experto",
  "cobridor_interno",
  "cobridor_externo",
  "mestre_harmonia",
  "mestre_banquetes",
];

export const CARGO_LABELS = {
  veneravel_mestre: "Venerável Mestre",
  primeiro_vigilante: "Primeiro Vigilante",
  segundo_vigilante: "Segundo Vigilante",
  orador: "Orador",
  secretario: "Secretário",
  tesoureiro: "Tesoureiro",
  chanceler: "Chanceler",
  hospitaleiro: "Hospitaleiro",
  mestre_cerimonias: "Mestre de Cerimônias",
  primeiro_diacono: "Primeiro Diácono",
  segundo_diacono: "Segundo Diácono",
  primeiro_experto: "Primeiro Experto",
  segundo_experto: "Segundo Experto",
  cobridor_interno: "Cobridor Interno",
  cobridor_externo: "Cobridor Externo",
  mestre_harmonia: "Mestre de Harmonia",
  mestre_banquetes: "Mestre de Banquetes",
};

export function isInstitutionalOffice(cargo) {
  return INSTITUTIONAL_OFFICES.includes(String(cargo || ""));
}

export function cargoLabel(cargo) {
  if (!cargo) return "Sem cargo institucional";
  return CARGO_LABELS[cargo] || String(cargo);
}

export function isVeneravelMestreInstitucional(context = {}) {
  return context.cargoVigente === VENERAVEL_MESTRE && context.situacao === "ativo";
}

export function canManageInstitutionalOffices(member) {
  return Boolean(
    member
    && member.ativo === true
    && member.conta_ativada === true
    && isStaffProfile(member.perfil),
  );
}

export function canManageVeneravelMestre(member) {
  return Boolean(
    member
    && member.ativo === true
    && member.conta_ativada === true
    && isAdminProfile(member.perfil),
  );
}

export function canAssignCargo(member, cargo) {
  if (!canManageInstitutionalOffices(member)) return false;
  if (String(cargo || "") === VENERAVEL_MESTRE) return canManageVeneravelMestre(member);
  return isInstitutionalOffice(cargo);
}

export function officeSelectOptions(member, currentCargo) {
  return INSTITUTIONAL_OFFICES.map((cargo) => ({
    id: cargo,
    label: CARGO_LABELS[cargo],
    disabled: cargo === VENERAVEL_MESTRE && !canManageVeneravelMestre(member) && cargo !== currentCargo,
    selected: cargo === currentCargo,
    allowed: canAssignCargo(member, cargo),
  }));
}
