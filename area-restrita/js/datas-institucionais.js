/**
 * Datas institucionais recorrentes da Loja.
 * O calendário consome esta camada — não o HTML da página.
 * Novas datas (fundação, instalações, jubileus, históricas)
 * entram pelo catálogo ou pela tabela public.datas_institucionais.
 */
export const INSTITUTIONAL_DATE_TYPES = [
  "data_maconica",
  "fundacao",
  "instalacao",
  "jubileu",
  "historica",
  "institucional",
];

export const INSTITUTIONAL_DATES = [
  {
    chave: "dia_do_macom",
    titulo: "Dia do Maçom",
    descricao: "Data comemorativa dedicada aos maçons brasileiros.",
    dia: 20,
    mes: 8,
    tipo: "data_maconica",
    recorrencia: "anual",
    dia_inteiro: true,
    ativo: true,
  },
];

export function resolveInstitutionalDates(rows) {
  const list = rows == null ? INSTITUTIONAL_DATES : rows;
  return (list || []).filter((row) => row && row.ativo !== false && Number(row.dia) >= 1 && Number(row.mes) >= 1);
}

export function toCalendarInstitutionalItem(row) {
  return {
    categoria: "data_maconica",
    titulo: String(row.titulo || "").trim(),
    descricao: String(row.descricao || "").trim(),
    dia: Number(row.dia),
    mes: Number(row.mes),
    year: null,
    allDay: row.dia_inteiro !== false,
    tipo: row.tipo || "data_maconica",
    chave: row.chave || "",
    recorrencia: row.recorrencia || "anual",
  };
}

export function institutionalDatesForCalendar(rows) {
  return resolveInstitutionalDates(rows).map(toCalendarInstitutionalItem);
}

export function institutionalOccursOn(item, month, day) {
  return Number(item.mes) === Number(month) && Number(item.dia) === Number(day);
}

export function institutionalOccursInMonth(item, month) {
  return Number(item.mes) === Number(month);
}
