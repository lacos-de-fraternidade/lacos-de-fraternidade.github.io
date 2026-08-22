const MONTHS = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

export const REQUIRED_FILES = [
  "irmaos_aniversarios.csv",
  "cunhadas_aniversarios.csv",
  "familiares_aniversarios.csv",
  "casamentos.csv",
  "iniciacoes.csv",
  "fundacao_loja.csv",
];

export const PARENTESCO_VALIDO = ["esposa", "companheira", "filho", "filha", "pai", "mae", "outro"];

export function stripAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function normalizeWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function nomeChave(value) {
  return normalizeWhitespace(value).toLocaleUpperCase("pt-BR");
}

export function chaveSemAcento(value) {
  return stripAccents(nomeChave(value)).toLocaleUpperCase("pt-BR");
}

export function parseMonth(value) {
  const folded = stripAccents(String(value || "")).toLowerCase().trim();
  const month = MONTHS[folded];
  if (!month) return null;
  return month;
}

export function parseDay(value) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return day;
}

export function parseIsoDate(value) {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return raw;
}

export function parseOptionalAge(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const age = Number(value);
  if (!Number.isInteger(age) || age < 0 || age > 120) return { error: "idade_invalida" };
  return { value: age };
}

export function mapParentesco(raw) {
  const original = normalizeWhitespace(raw);
  const folded = stripAccents(original).toLowerCase();
  const map = {
    esposa: "esposa",
    companheira: "companheira",
    filho: "filho",
    filha: "filha",
    filhos: "filho",
    pai: "pai",
    mae: "mae",
    genitor: "outro",
    "genitor(a)": "outro",
    outro: "outro",
  };
  const mapped = map[folded];
  if (!mapped) return { ok: false, original };
  return {
    ok: true,
    parentesco: mapped,
    original,
    revisao: folded === "filhos" || folded === "genitor" || folded === "genitor(a)",
  };
}

export function parseCsv(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    const row = { __linha: index + 2 };
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function buildImportPlan(files) {
  const report = {
    irmaosImportados: 0,
    familiaresImportados: 0,
    casamentosImportados: 0,
    iniciacoesImportadas: 0,
    fundacaoImportada: 0,
    atualizados: 0,
    ignorados: 0,
    erros: [],
    pendencias: [],
    revisao: [],
    relacionados: { sucesso: 0, naoEncontrados: [], multiplas: [], grafiasDivergentes: [] },
  };
  const irmaos = new Map();

  function upsertIrmao(partial, fonte) {
    const chave = nomeChave(partial.nome);
    if (!chave) {
      report.erros.push({ fonte, motivo: "nome_ausente", linha: partial.linha });
      return null;
    }
    const existing = irmaos.get(chave);
    if (!existing) {
      irmaos.set(chave, {
        nome: normalizeWhitespace(partial.nome),
        nome_original: partial.nome_original || partial.nome,
        dia_nascimento: partial.dia_nascimento ?? null,
        mes_nascimento: partial.mes_nascimento ?? null,
        ano_nascimento: null,
        idade_informada_na_importacao: partial.idade_informada_na_importacao ?? null,
        data_iniciacao: partial.data_iniciacao ?? null,
        loja_iniciacao: partial.loja_iniciacao ?? null,
        exibir_aniversario: true,
        exibir_idade: false,
        exibir_iniciacao: true,
        origem: "glmerj",
      });
      report.irmaosImportados += 1;
      return irmaos.get(chave);
    }
    let changed = false;
    for (const key of ["dia_nascimento", "mes_nascimento", "idade_informada_na_importacao", "data_iniciacao", "loja_iniciacao"]) {
      if (partial[key] != null && existing[key] == null) {
        existing[key] = partial[key];
        changed = true;
      }
    }
    if (changed) report.atualizados += 1;
    return existing;
  }

  for (const row of files.irmaosAniversarios || []) {
    const nome = normalizeWhitespace(row.nome);
    const mes = parseMonth(row.mes);
    const dia = parseDay(row.dia);
    const age = parseOptionalAge(row.idade_informada_em_2026);
    if (!nome || !mes || !dia) {
      report.erros.push({ fonte: "irmaos_aniversarios", linha: row.__linha, motivo: "registro_invalido" });
      report.ignorados += 1;
      continue;
    }
    if (age?.error) {
      report.erros.push({ fonte: "irmaos_aniversarios", linha: row.__linha, motivo: "idade_invalida" });
    }
    const irmao = upsertIrmao({
      nome,
      nome_original: row.nome,
      dia_nascimento: dia,
      mes_nascimento: mes,
      idade_informada_na_importacao: age?.value ?? null,
      linha: row.__linha,
    }, "irmaos_aniversarios");
    if (irmao && isAllCaps(nome)) {
      report.revisao.push({ tipo: "caixa_alta", nome, fonte: "irmaos_aniversarios" });
    }
  }

  for (const row of files.iniciacoes || []) {
    const nome = normalizeWhitespace(row.irmao || row.nome);
    const data = parseIsoDate(row.data_iniciacao);
    if (!nome || !data) {
      report.erros.push({ fonte: "iniciacoes", linha: row.__linha, motivo: "data_ou_nome_invalido" });
      report.ignorados += 1;
      continue;
    }
    upsertIrmao({
      nome,
      nome_original: row.irmao || row.nome,
      data_iniciacao: data,
      loja_iniciacao: normalizeWhitespace(row.loja_iniciacao) || null,
      linha: row.__linha,
    }, "iniciacoes");
    report.iniciacoesImportadas += 1;
  }

  const familiares = [];
  function addFamiliar(row, fonte, relatedField) {
    const nome = normalizeWhitespace(row.nome);
    const mes = parseMonth(row.mes);
    const dia = parseDay(row.dia);
    const parentescoInfo = mapParentesco(row.parentesco || "esposa");
    const related = normalizeWhitespace(row[relatedField]);
    if (!nome || !mes || !dia || !parentescoInfo.ok) {
      report.erros.push({ fonte, linha: row.__linha, motivo: "registro_invalido" });
      report.ignorados += 1;
      return;
    }
    const match = matchIrmao(irmaos, related, report);
    if (!match) return;
    familiares.push({
      irmao_chave: match,
      nome,
      nome_original: row.nome,
      parentesco: parentescoInfo.parentesco,
      parentesco_original: parentescoInfo.original,
      dia_nascimento: dia,
      mes_nascimento: mes,
      ano_nascimento: null,
      autorizado_exibicao: false,
      origem: "glmerj",
      categoria: fonte === "cunhadas_aniversarios" ? "cunhada" : "familiar",
    });
    report.familiaresImportados += 1;
    report.relacionados.sucesso += 1;
    if (parentescoInfo.revisao) {
      report.revisao.push({
        tipo: "parentesco_generico",
        nome,
        parentesco: parentescoInfo.original,
        irmao: related,
      });
    }
    if (isAllCaps(nome) || /oliviera/i.test(nome)) {
      report.revisao.push({ tipo: /oliviera/i.test(nome) ? "grafia" : "caixa_alta", nome, fonte });
    }
  }

  for (const row of files.cunhadas || []) addFamiliar({ ...row, parentesco: "esposa" }, "cunhadas_aniversarios", "esposa_de");
  for (const row of files.familiares || []) addFamiliar(row, "familiares_aniversarios", "irmao_relacionado");

  const casamentos = [];
  for (const row of files.casamentos || []) {
    const irmaoNome = normalizeWhitespace(row.irmao);
    const data = parseIsoDate(row.data_casamento);
    const conjuge = normalizeWhitespace(row.casado_com);
    if (!irmaoNome || !data) {
      report.erros.push({ fonte: "casamentos", linha: row.__linha, motivo: "data_ou_nome_invalido" });
      report.ignorados += 1;
      continue;
    }
    const match = matchIrmao(irmaos, irmaoNome, report);
    if (!match) continue;
    const conjugeChave = nomeChave(conjuge);
    const conjugeRow = familiares.find((item) => item.irmao_chave === match && nomeChave(item.nome) === conjugeChave) || null;
    casamentos.push({
      irmao_chave: match,
      conjuge_chave: conjugeRow ? nomeChave(conjugeRow.nome) : null,
      conjuge_nome: conjuge,
      data_casamento: data,
      autorizado_exibicao: false,
      origem: "glmerj",
    });
    report.casamentosImportados += 1;
    if (!conjugeRow) {
      report.pendencias.push({ tipo: "conjuge_nao_vinculado", irmao: irmaoNome, conjuge });
    }
  }

  let fundacao = null;
  for (const row of files.fundacao || []) {
    const data = parseIsoDate(row.data_fundacao || row.data_evento);
    if (!data) {
      report.erros.push({ fonte: "fundacao_loja", linha: row.__linha, motivo: "data_invalida" });
      report.ignorados += 1;
      continue;
    }
    fundacao = {
      titulo: "Fundação da Loja",
      descricao: normalizeWhitespace(row.loja) || "A∴R∴L∴M∴ Laços de Fraternidade 357 nº 251",
      data_evento: data,
      tipo_evento: "fundacao",
      chave_idempotencia: `fundacao:${data}`,
      publicado: true,
    };
    report.fundacaoImportada = 1;
  }

  return {
    irmaos: [...irmaos.values()],
    familiares,
    casamentos,
    fundacao,
    report,
  };
}

function matchIrmao(irmaos, relatedName, report) {
  const exact = nomeChave(relatedName);
  if (irmaos.has(exact)) return exact;
  const folded = chaveSemAcento(relatedName);
  const accentHits = [...irmaos.keys()].filter((key) => chaveSemAcento(key) === folded);
  if (accentHits.length === 1) {
    report.relacionados.grafiasDivergentes.push({
      informado: relatedName,
      candidato: irmaos.get(accentHits[0]).nome,
    });
    report.pendencias.push({ tipo: "grafia_divergente", informado: relatedName, candidato: irmaos.get(accentHits[0]).nome });
    return null;
  }
  if (accentHits.length > 1) {
    report.relacionados.multiplas.push({ informado: relatedName, candidatos: accentHits });
    return null;
  }
  report.relacionados.naoEncontrados.push(relatedName);
  report.pendencias.push({ tipo: "irmao_nao_encontrado", informado: relatedName });
  return null;
}

function isAllCaps(value) {
  const letters = String(value || "").replace(/[^\p{L}]/gu, "");
  return letters.length > 3 && letters === letters.toLocaleUpperCase("pt-BR") && letters !== letters.toLocaleLowerCase("pt-BR");
}

export function applyToMemory(plan, store = emptyStore()) {
  for (const irmao of plan.irmaos) {
    const key = nomeChave(irmao.nome);
    const existing = store.irmaos.get(key);
    store.irmaos.set(key, existing ? { ...existing, ...skipNull(irmao) } : { ...irmao });
  }
  for (const familiar of plan.familiares) {
    const key = `${familiar.irmao_chave}|${nomeChave(familiar.nome)}|${familiar.parentesco}`;
    store.familiares.set(key, { ...familiar });
  }
  for (const casamento of plan.casamentos) {
    const key = `${casamento.irmao_chave}|${casamento.data_casamento}`;
    store.casamentos.set(key, { ...casamento });
  }
  if (plan.fundacao) {
    store.eventos.set(plan.fundacao.chave_idempotencia, { ...plan.fundacao });
  }
  return store;
}

export function emptyStore() {
  return {
    irmaos: new Map(),
    familiares: new Map(),
    casamentos: new Map(),
    eventos: new Map(),
  };
}

function skipNull(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value != null));
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function planToSql(plan) {
  const irmaosJson = JSON.stringify(plan.irmaos.map((irmao) => ({
    nome: irmao.nome,
    nome_original: irmao.nome_original,
    dia_nascimento: irmao.dia_nascimento,
    mes_nascimento: irmao.mes_nascimento,
    idade_informada_na_importacao: irmao.idade_informada_na_importacao,
    data_iniciacao: irmao.data_iniciacao,
    loja_iniciacao: irmao.loja_iniciacao,
  })));
  const familiaresJson = JSON.stringify(plan.familiares.map((familiar) => ({
    irmao_chave: familiar.irmao_chave,
    nome: familiar.nome,
    nome_original: familiar.nome_original,
    parentesco: familiar.parentesco,
    parentesco_original: familiar.parentesco_original,
    dia_nascimento: familiar.dia_nascimento,
    mes_nascimento: familiar.mes_nascimento,
  })));
  const casamentosJson = JSON.stringify(plan.casamentos.map((casamento) => ({
    irmao_chave: casamento.irmao_chave,
    conjuge_chave: casamento.conjuge_chave,
    data_casamento: casamento.data_casamento,
  })));

  const fundacaoSql = plan.fundacao ? `
insert into public.eventos_internos (
  titulo, descricao, inicia_em, publicado, tipo_evento, data_evento, chave_idempotencia
) values (
  ${sqlLiteral(plan.fundacao.titulo)},
  ${sqlLiteral(plan.fundacao.descricao)},
  (${sqlLiteral(plan.fundacao.data_evento)}::date + time '12:00') at time zone 'America/Sao_Paulo',
  true, 'fundacao', ${sqlLiteral(plan.fundacao.data_evento)}::date,
  ${sqlLiteral(plan.fundacao.chave_idempotencia)}
)
on conflict (chave_idempotencia) do update set
  titulo = excluded.titulo,
  descricao = excluded.descricao,
  data_evento = excluded.data_evento,
  inicia_em = excluded.inicia_em,
  publicado = true;` : "";

  return `
begin;

insert into public.irmaos (
  nome, nome_original, dia_nascimento, mes_nascimento, ano_nascimento,
  idade_informada_na_importacao, data_iniciacao, loja_iniciacao,
  exibir_aniversario, exibir_idade, exibir_iniciacao, origem
)
select
  x.nome, x.nome_original, x.dia_nascimento, x.mes_nascimento, null,
  x.idade_informada_na_importacao, x.data_iniciacao::date, x.loja_iniciacao,
  true, false, true, 'glmerj'
from json_to_recordset(${sqlLiteral(irmaosJson)}::json) as x(
  nome text,
  nome_original text,
  dia_nascimento int,
  mes_nascimento int,
  idade_informada_na_importacao int,
  data_iniciacao text,
  loja_iniciacao text
)
on conflict (nome_normalizado) do update set
  dia_nascimento = coalesce(excluded.dia_nascimento, public.irmaos.dia_nascimento),
  mes_nascimento = coalesce(excluded.mes_nascimento, public.irmaos.mes_nascimento),
  idade_informada_na_importacao = coalesce(excluded.idade_informada_na_importacao, public.irmaos.idade_informada_na_importacao),
  data_iniciacao = coalesce(excluded.data_iniciacao, public.irmaos.data_iniciacao),
  loja_iniciacao = coalesce(excluded.loja_iniciacao, public.irmaos.loja_iniciacao),
  nome_original = coalesce(public.irmaos.nome_original, excluded.nome_original),
  atualizado_em = now();

insert into public.familiares (
  irmao_id, nome, nome_original, parentesco, parentesco_original,
  dia_nascimento, mes_nascimento, ano_nascimento, autorizado_exibicao, origem
)
select
  i.id, x.nome, x.nome_original, x.parentesco, x.parentesco_original,
  x.dia_nascimento, x.mes_nascimento, null, false, 'glmerj'
from json_to_recordset(${sqlLiteral(familiaresJson)}::json) as x(
  irmao_chave text,
  nome text,
  nome_original text,
  parentesco text,
  parentesco_original text,
  dia_nascimento int,
  mes_nascimento int
)
join public.irmaos i on i.nome_normalizado = x.irmao_chave
on conflict (irmao_id, nome_normalizado, parentesco) do update set
  dia_nascimento = excluded.dia_nascimento,
  mes_nascimento = excluded.mes_nascimento,
  parentesco_original = coalesce(public.familiares.parentesco_original, excluded.parentesco_original),
  atualizado_em = now();

insert into public.casamentos (
  irmao_id, conjuge_id, data_casamento, autorizado_exibicao, origem
)
select
  i.id, f.id, x.data_casamento::date, false, 'glmerj'
from json_to_recordset(${sqlLiteral(casamentosJson)}::json) as x(
  irmao_chave text,
  conjuge_chave text,
  data_casamento text
)
join public.irmaos i on i.nome_normalizado = x.irmao_chave
left join public.familiares f
  on f.irmao_id = i.id
  and f.nome_normalizado = x.conjuge_chave
on conflict (irmao_id, data_casamento) do update set
  conjuge_id = coalesce(excluded.conjuge_id, public.casamentos.conjuge_id),
  atualizado_em = now();
${fundacaoSql}

update public.irmaos i
set auth_member_id = a.id
from public.irmaos_autorizados a
where i.auth_member_id is null
  and i.nome_normalizado = upper(regexp_replace(btrim(a.nome), '\\s+', ' ', 'g'));

update public.irmaos i
set auth_member_id = a.id
from public.irmaos_autorizados a
where i.auth_member_id is null
  and i.cim is not null
  and i.cim = a.cim;

update public.irmaos_autorizados a
set irmao_id = i.id
from public.irmaos i
where a.irmao_id is null
  and i.auth_member_id = a.id;

commit;
`;
}

