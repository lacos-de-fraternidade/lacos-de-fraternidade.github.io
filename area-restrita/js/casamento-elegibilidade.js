export const CONJUGE_PARENTESCO = ["esposa", "companheira"];

export function isConjugeParentesco(parentesco) {
  return CONJUGE_PARENTESCO.includes(String(parentesco || ""));
}

export function activeMarriages(casamentos = [], exceptId = null) {
  return (casamentos || []).filter((row) => row.ativo !== false && row.id !== exceptId);
}

export function eligibleIrmaos({ irmaos = [], casamentos = [], exceptCasamentoId = null } = {}) {
  const married = new Set(
    activeMarriages(casamentos, exceptCasamentoId).map((row) => row.irmao_id),
  );
  return (irmaos || []).filter((row) => row.ativo !== false && !married.has(row.id));
}

export function eligibleConjuges({
  familiares = [],
  casamentos = [],
  irmaoId,
  exceptCasamentoId = null,
} = {}) {
  if (!irmaoId) return [];
  const taken = new Set(
    activeMarriages(casamentos, exceptCasamentoId)
      .map((row) => row.conjuge_id)
      .filter(Boolean),
  );
  return (familiares || []).filter((row) => (
    row.ativo !== false
    && row.irmao_id === irmaoId
    && isConjugeParentesco(row.parentesco)
    && !taken.has(row.id)
  ));
}

export function validateCasamento({
  irmao,
  familiar,
  casamentos = [],
  exceptCasamentoId = null,
} = {}) {
  if (!irmao || irmao.ativo === false) {
    return { ok: false, error: "Irmão indisponível para casamento." };
  }
  const marriedBrother = activeMarriages(casamentos, exceptCasamentoId)
    .some((row) => row.irmao_id === irmao.id);
  if (marriedBrother) {
    return { ok: false, error: "Este Irmão já possui casamento ativo." };
  }
  if (!familiar) return { ok: true };
  if (familiar.ativo === false || !isConjugeParentesco(familiar.parentesco)) {
    return { ok: false, error: "Cônjuge incompatível." };
  }
  if (familiar.irmao_id !== irmao.id) {
    return { ok: false, error: "A cunhada precisa pertencer ao cadastro deste Irmão." };
  }
  const marriedSpouse = activeMarriages(casamentos, exceptCasamentoId)
    .some((row) => row.conjuge_id === familiar.id);
  if (marriedSpouse) {
    return { ok: false, error: "Esta cunhada já está vinculada a um casamento ativo." };
  }
  return { ok: true };
}
