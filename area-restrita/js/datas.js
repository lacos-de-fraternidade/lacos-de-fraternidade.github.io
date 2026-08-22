const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MONTH_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function monthName(month) {
  return MONTHS[Number(month) - 1] || "";
}

export function monthAbbr(month) {
  return MONTH_ABBR[Number(month) - 1] || "";
}

export function shiftMonth(month, delta) {
  return ((Number(month) - 1 + Number(delta)) % 12 + 12) % 12 + 1;
}

export function padDay(day) {
  return String(day).padStart(2, "0");
}

export function parseIsoDate(value) {
  const raw = String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    iso: raw,
  };
}

export function nextMonthView(view) {
  if (Number(view.month) === 12) return { month: 1, year: Number(view.year) + 1 };
  return { month: Number(view.month) + 1, year: Number(view.year) };
}

export function prevMonthView(view) {
  if (Number(view.month) === 1) return { month: 12, year: Number(view.year) - 1 };
  return { month: Number(view.month) - 1, year: Number(view.year) };
}

export function isOnOrAfterDay(month, day, year, from = new Date()) {
  const today = startOfLocalDay(from);
  const when = new Date(year, month - 1, day);
  if (Number.isNaN(when.getTime()) || when.getDate() !== Number(day)) return false;
  return when >= today;
}

export function occurredInMonth(items, month, year, from = new Date()) {
  return (items || []).filter((item) => Number(item.mes) === Number(month) && !isOnOrAfterDay(month, item.dia, year, from));
}

export function remainingInMonth(items, month, year, from = new Date()) {
  return (items || []).filter((item) => Number(item.mes) === Number(month) && isOnOrAfterDay(month, item.dia, year, from));
}

export function monthIsCurrentOrPast(view, from = new Date()) {
  const today = startOfLocalDay(from);
  const end = new Date(view.year, view.month, 0);
  return end < today || (today.getFullYear() === Number(view.year) && today.getMonth() + 1 === Number(view.month));
}

export function isCurrentMonthView(view, from = new Date()) {
  const today = startOfLocalDay(from);
  return Number(view.year) === today.getFullYear() && Number(view.month) === today.getMonth() + 1;
}

export function nextMonthWithRemaining(view, items, from = new Date()) {
  let current = nextMonthView({ month: Number(view.month), year: Number(view.year) });
  for (let i = 0; i < 12; i += 1) {
    if (remainingInMonth(items, current.month, current.year, from).length) return current;
    current = nextMonthView(current);
  }
  return null;
}

export function ensureUpcomingMonth(view, items, from = new Date()) {
  let current = { month: Number(view.month), year: Number(view.year) };
  if (remainingInMonth(items, current.month, current.year, from).length) return current;
  if (occurredInMonth(items, current.month, current.year, from).length) return current;
  if (!monthIsCurrentOrPast(current, from)) return current;
  for (let i = 0; i < 12; i += 1) {
    current = nextMonthView(current);
    if (remainingInMonth(items, current.month, current.year, from).length) return current;
  }
  return { month: Number(view.month), year: Number(view.year) };
}

export function monthRemainingCopy(count, nextIsOwn = false, monthLabel = "") {
  const when = monthLabel ? ` em ${monthLabel}` : " neste mês";
  if (count <= 0) return `Não restam aniversários${when}.`;
  const restam = count === 1 ? `Ainda resta 1 aniversário${when}.` : `Ainda restam ${count} aniversários${when}.`;
  return nextIsOwn ? `${restam} O próximo será o seu.` : restam;
}

export function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function nextOccurrence(month, day, from = new Date()) {
  const today = startOfLocalDay(from);
  let candidate = new Date(today.getFullYear(), month - 1, day);
  if (Number.isNaN(candidate.getTime()) || candidate.getDate() !== Number(day)) return null;
  if (candidate < today) candidate = new Date(today.getFullYear() + 1, month - 1, day);
  return candidate;
}

export function daysUntil(month, day, from = new Date()) {
  const next = nextOccurrence(month, day, from);
  if (!next) return null;
  const today = startOfLocalDay(from);
  return Math.round((next - today) / 86400000);
}

export function relativeDayLabel(month, day, from = new Date()) {
  const days = daysUntil(month, day, from);
  if (days === null) return "";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `em ${days} dias`;
}

export function completeYears(isoDate, from = new Date()) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return null;
  const today = startOfLocalDay(from);
  let years = today.getFullYear() - parsed.year;
  const reached = today.getMonth() + 1 > parsed.month
    || (today.getMonth() + 1 === parsed.month && today.getDate() >= parsed.day);
  if (!reached) years -= 1;
  return Math.max(0, years);
}

export function anniversaryYears(isoDate, from = new Date()) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return null;
  const next = nextOccurrence(parsed.month, parsed.day, from);
  if (!next) return null;
  return Math.max(0, next.getFullYear() - parsed.year);
}

export function yearsLabel(count, noun) {
  if (count === 0) return `${noun} neste ano`;
  if (count === 1) return `1 ano de ${noun}`;
  return `${count} anos de ${noun}`;
}

export function formatLongDate(isoDate) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return "";
  return `${parsed.day} de ${monthName(parsed.month).toLowerCase()}`;
}

export function upcomingByMonthDay(items, limit = 5, from = new Date()) {
  return [...items]
    .map((item) => ({ ...item, days: daysUntil(item.mes, item.dia, from), from }))
    .filter((item) => item.days !== null)
    .sort((a, b) => a.days - b.days || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limit);
}

export function groupByMonth(items) {
  const groups = new Map();
  for (const item of items) {
    const month = Number(item.mes);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(item);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([mes, registros]) => ({
      mes,
      titulo: monthName(mes),
      registros: registros.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR")),
    }));
}

export function foldSearch(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function filterByName(items, query) {
  const needle = foldSearch(query);
  if (!needle) return items;
  return items.filter((item) => foldSearch(item.nome).includes(needle));
}

export function iconSvg(kind) {
  const icons = {
    irmao: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 19c1.4-3.2 3.8-4.8 7-4.8S17.6 15.8 19 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    cunhada: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-6-3.8-6-8.2A3.8 3.8 0 0 1 12 8.7 3.8 3.8 0 0 1 18 11.8C18 16.2 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    familiar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 19c.8-2.6 2.4-3.8 4.5-3.8s3.7 1.2 4.5 3.8M11.5 19c.8-2.6 2.4-3.8 4.5-3.8s3.7 1.2 4.5 3.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    casamento: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="15" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    iniciacao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.4 6.8H21l-5.4 4.1 2 6.6L12 16.8 6.4 20.5l2-6.6L3 9.8h6.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    data_maconica: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 20h15M6.5 20V11l5.5-5.2L17.5 11V20M10 20v-5h4v5M9 13.5h2M13 13.5h2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    evento: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 7.2 12 12.4 19.5 7.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cim: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="12" r="2.1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13.5 10.6h5M13.5 13.4h3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    loja: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 20h15M6.5 20V11l5.5-5.2L17.5 11V20M10 20v-5h4v5M9 13.5h2M13 13.5h2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    seguranca: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10V8.2a3.5 3.5 0 0 1 7 0V10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  return icons[kind] || icons.evento;
}
