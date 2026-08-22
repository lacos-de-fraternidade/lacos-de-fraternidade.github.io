export function normalizeNomeVinculo(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

export function currentCim(value) {
  const cim = String(value ?? "").trim();
  return cim || null;
}

function duplicates(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].filter(([, rows]) => rows.length > 1);
}

export function diagnoseCimVinculo(official = [], irmaos = []) {
  const errors = [];
  const officialRows = official.map(([nomeOficial, cim]) => ({
    nomeOficial,
    cim: String(cim),
    chave: normalizeNomeVinculo(nomeOficial),
  }));

  for (const [cim, rows] of duplicates(officialRows, (row) => row.cim)) {
    errors.push(`CIM duplicada na lista importada: ${cim} (${rows.map((row) => row.nomeOficial).join(", ")})`);
  }
  for (const [chave, rows] of duplicates(officialRows, (row) => row.chave)) {
    errors.push(`Nome duplicado na lista importada: ${chave} (${rows.map((row) => row.nomeOficial).join(", ")})`);
  }

  const byChave = new Map();
  for (const irmao of irmaos) {
    const chave = normalizeNomeVinculo(irmao.nome);
    if (!byChave.has(chave)) byChave.set(chave, []);
    byChave.get(chave).push(irmao);
  }

  for (const [chave, rows] of byChave.entries()) {
    if (rows.length > 1 && officialRows.some((row) => row.chave === chave)) {
      errors.push(`Nome com mais de uma correspondência: ${chave}`);
    }
  }

  const rows = officialRows.map((dado) => {
    const matches = byChave.get(dado.chave) || [];
    const membro = matches.length === 1 ? matches[0] : null;
    const cimAtual = currentCim(membro?.cim);
    let situacao = "NAO_ENCONTRADO";
    if (matches.length > 1) situacao = "NOME_AMBIGUO";
    else if (membro && !cimAtual) situacao = "PRONTO_PARA_ATUALIZAR";
    else if (membro && cimAtual === dado.cim) situacao = "JA_ATUALIZADO";
    else if (membro) situacao = "CONFLITO_DE_CIM";
    return {
      ...dado,
      matches: matches.length,
      membro,
      cimAtual,
      situacao,
    };
  });

  for (const row of rows) {
    if (row.situacao === "CONFLITO_DE_CIM") {
      errors.push(`CIM existente e diferente: ${row.nomeOficial} atual=${row.cimAtual} oficial=${row.cim}`);
    }
    if (row.situacao === "NOME_AMBIGUO") {
      errors.push(`Nome com mais de uma correspondência: ${row.nomeOficial}`);
    }
    const usedByOther = irmaos.find((irmao) => (
      currentCim(irmao.cim) === row.cim
      && normalizeNomeVinculo(irmao.nome) !== row.chave
    ));
    if (usedByOther) {
      errors.push(`CIM ${row.cim} já usada por outro Irmão: ${usedByOther.nome}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    rows,
    totais: {
      oficiais: officialRows.length,
      encontrados: rows.filter((row) => row.matches === 1).length,
      prontos: rows.filter((row) => row.situacao === "PRONTO_PARA_ATUALIZAR").length,
      atualizados: rows.filter((row) => row.situacao === "JA_ATUALIZADO").length,
      naoEncontrados: rows.filter((row) => row.situacao === "NAO_ENCONTRADO").map((row) => row.nomeOficial),
      conflitos: errors,
    },
  };
}

export function applyCimVinculo(official, irmaos) {
  const plan = diagnoseCimVinculo(official, irmaos);
  if (!plan.ok) {
    const error = new Error(plan.errors.join(" | "));
    error.plan = plan;
    throw error;
  }
  const next = irmaos.map((irmao) => ({ ...irmao }));
  let atualizados = 0;
  for (const row of plan.rows) {
    if (row.situacao !== "PRONTO_PARA_ATUALIZAR") continue;
    const target = next.find((irmao) => irmao === row.membro || irmao.id === row.membro.id);
    if (!target) continue;
    target.cim = row.cim;
    atualizados += 1;
  }
  const after = diagnoseCimVinculo(official, next);
  const pending = after.rows.filter((row) => row.matches === 1 && row.situacao !== "JA_ATUALIZADO");
  if (pending.length) {
    throw new Error(`Registros encontrados sem a CIM correta: ${pending.map((row) => row.nomeOficial).join(", ")}`);
  }
  return { plan, irmaos: next, atualizados };
}
