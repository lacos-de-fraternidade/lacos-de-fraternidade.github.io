import { isAdminProfile, isStaffProfile } from "./staff-actions.ts";

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
] as const;

export type InstitutionalOffice = typeof INSTITUTIONAL_OFFICES[number];

export const CARGO_LABELS: Record<InstitutionalOffice, string> = {
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

export function isInstitutionalOffice(cargo: unknown): cargo is InstitutionalOffice {
  return (INSTITUTIONAL_OFFICES as readonly string[]).includes(String(cargo || ""));
}

export function isVeneravelMestreInstitucional(context: {
  cargoVigente?: string | null;
  situacao?: string | null;
} = {}) {
  return context.cargoVigente === VENERAVEL_MESTRE && context.situacao === "ativo";
}

export function canManageInstitutionalOffices(
  member: { ativo?: boolean; conta_ativada?: boolean; perfil?: string } | null,
) {
  return Boolean(
    member
    && member.ativo === true
    && member.conta_ativada === true
    && isStaffProfile(member.perfil),
  );
}

export function canManageVeneravelMestre(
  member: { ativo?: boolean; conta_ativada?: boolean; perfil?: string } | null,
) {
  return Boolean(
    member
    && member.ativo === true
    && member.conta_ativada === true
    && isAdminProfile(member.perfil),
  );
}

export function canAssignCargo(
  member: { ativo?: boolean; conta_ativada?: boolean; perfil?: string } | null,
  cargo: unknown,
) {
  if (!canManageInstitutionalOffices(member)) return false;
  if (String(cargo || "") === VENERAVEL_MESTRE) return canManageVeneravelMestre(member);
  return isInstitutionalOffice(cargo);
}
