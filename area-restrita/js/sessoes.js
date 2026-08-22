export const SESSION_HOUR = 19;
export const SESSION_MINUTE = 30;
export const LODGE_NAME = "ARLS Laços de Fraternidade 357 nº 251";

export function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  const last = new Date(year, month, 0).getDate();
  if (day < 1 || day > last) return null;
  return new Date(year, month - 1, day, SESSION_HOUR, SESSION_MINUTE, 0, 0);
}

export function lodgeSessionsForMonth(year, month) {
  return [2, 4]
    .map((n) => nthWeekdayOfMonth(year, month, 3, n))
    .filter(Boolean);
}

export function sessionKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `sessao_ordinaria:${year}-${month}-${day}`;
}

export function isLodgeSessionType(tipo) {
  return ["sessao_ordinaria", "sessao_administrativa", "sessao_magna"].includes(String(tipo || ""));
}

export function isActiveEvent(evento, from = new Date()) {
  if (!evento) return false;
  if (evento.ativo === false || evento.publicado === false || evento.cancelado === true) return false;
  const when = evento.inicia_em ? new Date(evento.inicia_em) : null;
  if (!when || Number.isNaN(when.getTime())) return false;
  return when >= from;
}

export function nextLodgeSession(eventos = [], from = new Date()) {
  const now = from instanceof Date ? from : new Date(from);
  const sessions = (eventos || [])
    .filter((evento) => isLodgeSessionType(evento.tipo_evento) || isLodgeSessionType(evento.tipo))
    .filter((evento) => isActiveEvent(evento, now))
    .map((evento) => ({ ...evento, when: new Date(evento.inicia_em) }))
    .sort((a, b) => a.when - b.when);
  return sessions[0] || null;
}

export function daysUntilDate(date, from = new Date()) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target - start) / 86400000);
}

export function formatSessionTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`;
}

export function sessionTitle(evento) {
  if (!evento) return "Sessão Ordinária";
  if (evento.tipo_evento === "sessao_administrativa") return evento.titulo || "Sessão Administrativa";
  if (evento.tipo_evento === "sessao_magna") return evento.titulo || "Sessão Magna";
  if (evento.tipo_evento === "sessao_economica") return evento.titulo || "Sessão Econômica";
  return evento.titulo || "Sessão Ordinária";
}

export const ORDINARY_SESSION_PROGRAM = [
  "Café fraternal às 18h45",
  "Sessão no grau 1",
  "Leitura da pauta administrativa",
];

export function sessionProgramItems(item) {
  if (!item || item.categoria !== "sessao") return [];
  const tipo = item.tipoEvento || item.tipo_evento || "sessao_ordinaria";
  if (tipo !== "sessao_ordinaria") return [];
  return ORDINARY_SESSION_PROGRAM;
}

export function sessionProgramHeading(isNext = false) {
  return isNext ? "Na próxima sessão" : "Nesta sessão";
}

export function relativeDaysLabel(days) {
  if (days === 0) return "É hoje";
  if (days === 1) return "Falta 1 dia";
  return `Faltam ${days} dias`;
}
