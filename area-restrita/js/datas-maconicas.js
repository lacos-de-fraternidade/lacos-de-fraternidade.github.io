import {
  anniversaryYears,
  completeYears,
  daysUntil,
  parseIsoDate,
} from "./datas.js";

/**
 * Catálogo de tipos de Data Maçônica.
 * Tipos com `ativo: false` ficam reservados para evolução futura
 * (fundação, instalação, jubileus, datas históricas, eventos institucionais)
 * sem mudar navegação nem o layout da página.
 */
export const MACONIC_DATE_TYPES = {
  iniciacao: {
    id: "iniciacao",
    label: "Aniversários de iniciação",
    ownBadge: "Seu aniversário de iniciação",
    icon: "iniciacao",
    ativo: true,
  },
  instalacao: {
    id: "instalacao",
    label: "Instalações",
    ownBadge: "",
    icon: "evento",
    ativo: false,
  },
  fundacao: {
    id: "fundacao",
    label: "Fundação da Loja",
    ownBadge: "",
    icon: "evento",
    ativo: false,
  },
  jubileu: {
    id: "jubileu",
    label: "Jubileus",
    ownBadge: "",
    icon: "iniciacao",
    ativo: false,
  },
  historica: {
    id: "historica",
    label: "Datas históricas",
    ownBadge: "",
    icon: "evento",
    ativo: false,
  },
  institucional: {
    id: "institucional",
    label: "Eventos institucionais",
    ownBadge: "",
    icon: "evento",
    ativo: false,
  },
};

export const MACONIC_FILTER_ORDER = Object.keys(MACONIC_DATE_TYPES);
export const ACTIVE_MACONIC_TYPES = MACONIC_FILTER_ORDER.map((id) => MACONIC_DATE_TYPES[id]).filter((type) => type.ativo);
export const MACONIC_TYPE_ORDER = ACTIVE_MACONIC_TYPES.map((type) => type.id);

const COLLECTORS = {
  iniciacao: collectInitiationAnniversaries,
};

export function masonicType(id) {
  return MACONIC_DATE_TYPES[id] || null;
}

export function createMasonicDate({
  tipo,
  id = null,
  nome,
  dia,
  mes,
  data = null,
  local = "",
  proprio = false,
  detalhe = "",
} = {}) {
  const kind = masonicType(tipo);
  if (!kind?.ativo) return null;
  return {
    tipo: kind.id,
    categoria: kind.id,
    id,
    nome: String(nome || "").trim(),
    dia: Number(dia),
    mes: Number(mes),
    data: data || null,
    local: String(local || "").trim(),
    proprio: Boolean(proprio),
    detalhe: String(detalhe || "").trim(),
  };
}

export function collectMasonicDates({ irmaos = [] } = {}, { isOwn = () => false, from = new Date() } = {}) {
  const items = [];
  for (const type of ACTIVE_MACONIC_TYPES) {
    const collect = COLLECTORS[type.id];
    if (!collect) continue;
    items.push(...collect({ irmaos }, { isOwn, from }));
  }
  return items.filter(Boolean);
}

function collectInitiationAnniversaries({ irmaos }, { isOwn, from }) {
  return (irmaos || [])
    .map((row) => fromInitiationAnniversary(row, { proprio: Boolean(isOwn(row.id)), from }))
    .filter(Boolean);
}

export function fromInitiationAnniversary(row, { proprio = false, from = new Date() } = {}) {
  if (!row?.exibir_iniciacao) return null;
  const parsed = parseIsoDate(row.data_iniciacao);
  if (!parsed) return null;
  return createMasonicDate({
    tipo: "iniciacao",
    id: row.id,
    nome: row.nome,
    dia: parsed.day,
    mes: parsed.month,
    data: parsed.iso,
    local: row.loja_iniciacao,
    proprio,
    detalhe: caminhadaLabel(anniversaryYears(parsed.iso, from)),
  });
}

export function caminhadaLabel(years) {
  if (years == null || years < 0) return "";
  if (years === 0) return "Iniciado neste ano";
  if (years === 1) return "1 ano de caminhada maçônica";
  return `${years} anos de caminhada maçônica`;
}

export function yearsForMasonicDate(item, { past = false, from = new Date() } = {}) {
  if (!item?.data) return null;
  return past ? completeYears(item.data, from) : anniversaryYears(item.data, from);
}

export function detalheForMasonicDate(item, options = {}) {
  if (item?.tipo === "iniciacao") return caminhadaLabel(yearsForMasonicDate(item, options));
  return item?.detalhe || "";
}

export function capitalizeMonth(label) {
  const value = String(label || "").trim();
  if (!value) return "Este mês";
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

export function nextCelebrationCopy(days) {
  if (days == null) return "";
  if (days === 0) return "A próxima celebração ocorre hoje.";
  if (days === 1) return "A próxima celebração ocorrerá amanhã.";
  return `A próxima celebração ocorrerá em ${days} dias.`;
}

export function masonicMonthCopy({ remaining = 0, occurred = 0, nextDays = null, monthLabel = "" } = {}) {
  const month = capitalizeMonth(monthLabel);
  if (remaining > 0) {
    const count = remaining === 1 ? "1 data maçônica" : `${remaining} datas maçônicas`;
    const next = nextCelebrationCopy(nextDays);
    return next ? `${month} possui ${count}. ${next}` : `${month} possui ${count}.`;
  }
  if (occurred > 0) return "Todas as datas maçônicas deste mês já foram celebradas.";
  return `${month} ainda não possui datas maçônicas cadastradas.`;
}

export function masonicCompletedNotice({ monthLabel = "", nextMonthLabel = "" } = {}) {
  const month = capitalizeMonth(monthLabel).toLocaleLowerCase("pt-BR");
  const lines = [
    `Todas as datas maçônicas de ${month} já foram celebradas.`,
    "Os aniversários de iniciação deste mês continuam disponíveis abaixo para consulta.",
  ];
  if (nextMonthLabel) {
    lines.push(`A próxima celebração acontecerá em ${String(nextMonthLabel).toLocaleLowerCase("pt-BR")}.`);
  }
  return lines;
}

export function daysUntilNext(items, from = new Date()) {
  const next = [...(items || [])].sort((a, b) => a.dia - b.dia)[0];
  if (!next) return null;
  return daysUntil(next.mes, next.dia, from);
}
