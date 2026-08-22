import { monthAbbr, monthName, nextMonthView, padDay, remainingInMonth, startOfLocalDay } from "./datas.js";
import { sessionProgramHeading, sessionProgramItems } from "./sessoes.js";

export const CALENDAR_LEGEND = [
  { id: "irmao", label: "Irmãos", icon: "irmao" },
  { id: "cunhada", label: "Cunhadas", icon: "cunhada" },
  { id: "familiar", label: "Familiares", icon: "familiar" },
  { id: "casamento", label: "Casamentos", icon: "casamento" },
  { id: "iniciacao", label: "Aniversários de Iniciação", icon: "iniciacao" },
  { id: "data_maconica", label: "Datas Maçônicas institucionais", icon: "data_maconica" },
  { id: "sessao", label: "Sessões da Loja", icon: "evento" },
  { id: "evento", label: "Eventos da Loja", icon: "evento" },
];

export const CALENDAR_FILTER_GROUPS = [
  { id: "aniversarios", label: "Aniversários", items: ["irmao", "cunhada", "familiar"] },
  { id: "comemorativas", label: "Datas comemorativas", items: ["casamento", "iniciacao"] },
  { id: "agenda", label: "Agenda da Loja", items: ["sessao", "evento"] },
  { id: "maconicas", label: "Datas Maçônicas", items: ["data_maconica"] },
];

const SUMMARY = [
  { keys: ["sessao"], one: "1 sessão", many: (n) => `${n} sessões` },
  { keys: ["irmao"], one: "1 aniversário", many: (n) => `${n} aniversários` },
  { keys: ["iniciacao"], one: "1 aniversário de iniciação", many: (n) => `${n} aniversários de iniciação` },
  { keys: ["data_maconica"], one: "1 data maçônica", many: (n) => `${n} datas maçônicas` },
  { keys: ["cunhada"], one: "1 aniversário de cunhada", many: (n) => `${n} aniversários de cunhadas` },
  { keys: ["familiar"], one: "1 aniversário familiar", many: (n) => `${n} aniversários familiares` },
  { keys: ["casamento"], one: "1 aniversário de casamento", many: (n) => `${n} aniversários de casamento` },
  { keys: ["evento"], one: "1 evento da Loja", many: (n) => `${n} eventos da Loja` },
];

export function formatHourBr(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`;
}

export function monthSummaryLines(items) {
  const list = items || [];
  return SUMMARY
    .map((group) => {
      const count = list.filter((item) => group.keys.includes(item.categoria)).length;
      if (!count) return "";
      return count === 1 ? group.one : group.many(count);
    })
    .filter(Boolean);
}

export function monthSummaryCopy(items) {
  return monthSummaryLines(items).join(" · ");
}

export function monthSummaryHeadline(items) {
  return monthSummaryMarks(items).map((mark) => mark.label).join(" · ");
}

const SUMMARY_MARKS = [
  { keys: ["sessao"], icon: "evento", noun: "Sessão", nouns: "Sessões" },
  { keys: ["irmao"], icon: "irmao", noun: "Aniversário", nouns: "Aniversários" },
  { keys: ["iniciacao"], icon: "iniciacao", noun: "Aniversário de Iniciação", nouns: "Aniversários de Iniciação" },
  { keys: ["data_maconica"], icon: "data_maconica", noun: "Data Maçônica", nouns: "Datas Maçônicas" },
  { keys: ["cunhada"], icon: "cunhada", noun: "Cunhada", nouns: "Cunhadas" },
  { keys: ["familiar"], icon: "familiar", noun: "Familiar", nouns: "Familiares" },
  { keys: ["casamento"], icon: "casamento", noun: "Casamento", nouns: "Casamentos" },
  { keys: ["evento"], icon: "evento", noun: "Evento", nouns: "Eventos" },
];

export function monthSummaryMarks(items) {
  const list = items || [];
  return SUMMARY_MARKS
    .map((group) => {
      const count = list.filter((item) => group.keys.includes(item.categoria)).length;
      if (!count) return null;
      return {
        icon: group.icon,
        categoria: group.keys[0],
        label: `${count} ${count === 1 ? group.noun : group.nouns}`,
      };
    })
    .filter(Boolean);
}

export function categoryMark(id) {
  return {
    irmao: "irmao",
    cunhada: "cunhada",
    familiar: "familiar",
    casamento: "casamento",
    iniciacao: "iniciacao",
    data_maconica: "data_maconica",
    sessao: "evento",
    evento: "evento",
  }[id] || "evento";
}

export function filterCalendarItems(items, hidden = new Set()) {
  if (!hidden.size) return items || [];
  return (items || []).filter((item) => !hidden.has(item.categoria));
}

export function categoryLabel(id) {
  return CALENDAR_LEGEND.find((entry) => entry.id === id)?.label || id;
}

export function setCategoryHidden(hidden, id, visible) {
  const next = new Set(hidden);
  if (visible) next.delete(id);
  else next.add(id);
  return next;
}

export function setGroupHidden(hidden, group, visible) {
  const next = new Set(hidden);
  for (const id of group.items) {
    if (visible) next.delete(id);
    else next.add(id);
  }
  return next;
}

export function groupCheckState(hidden, group) {
  const selected = group.items.filter((id) => !hidden.has(id)).length;
  if (selected === 0) return "none";
  if (selected === group.items.length) return "all";
  return "some";
}

export function filterTriggerLabel(hidden) {
  if (!hidden?.size) return "Todos os registros";
  const selected = CALENDAR_LEGEND.filter((entry) => !hidden.has(entry.id));
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const exclusive = CALENDAR_FILTER_GROUPS.find((group) => (
    group.items.length === selectedIds.size
    && group.items.every((id) => selectedIds.has(id))
  ));
  if (exclusive) return exclusive.label;
  if (selected.length === 1) return categoryLabel(selected[0].id);
  return `${selected.length} categorias selecionadas`;
}

export function itemsOnDay(items, month, day, year) {
  return (items || []).filter((item) => (
    Number(item.mes) === Number(month)
    && Number(item.dia) === Number(day)
    && (item.year == null || Number(item.year) === Number(year))
  ));
}

export function itemsInMonth(items, month, year) {
  return (items || []).filter((item) => (
    Number(item.mes) === Number(month)
    && (item.year == null || Number(item.year) === Number(year))
  ));
}

export function shortCalendarTitle(item) {
  if (!item) return "";
  if (item.tituloCurto) return item.tituloCurto;
  return item.titulo || "";
}

function remainingInView(items, view, from) {
  return remainingInMonth(items, view.month, view.year, from)
    .filter((item) => item.year == null || Number(item.year) === Number(view.year));
}

function nextViewWithRemaining(view, items, from) {
  let current = nextMonthView({ month: Number(view.month), year: Number(view.year) });
  for (let i = 0; i < 12; i += 1) {
    if (remainingInView(items, current, from).length) return current;
    current = nextMonthView(current);
  }
  return null;
}

function contextWhen(item, view) {
  const month = monthName(view.month).toLowerCase();
  return item.horario
    ? `${item.titulo} em ${item.dia} de ${month} às ${item.horario}.`
    : `${item.titulo} em ${item.dia} de ${month}.`;
}

export function monthContextCopy({ items, view, from = new Date() } = {}) {
  const monthItems = remainingInView(items, view, from)
    .sort((a, b) => a.dia - b.dia || String(a.horario || "").localeCompare(String(b.horario || "")));
  const nextSession = monthItems.find((item) => item.categoria === "sessao");
  const nextEvent = monthItems.find((item) => item.categoria === "evento");
  const nextHonor = monthItems.find((item) => item.categoria === "data_maconica");
  const nextAny = monthItems[0];
  if (nextSession) {
    return { kicker: "Próximo compromisso", text: contextWhen(nextSession, view) };
  }
  if (nextEvent) {
    return { kicker: "Próximo compromisso", text: contextWhen(nextEvent, view) };
  }
  const celebration = nextHonor || nextAny;
  if (celebration) {
    return { kicker: "Próxima celebração", text: contextWhen(celebration, view) };
  }
  const upcoming = nextViewWithRemaining(view, items, from);
  return {
    kicker: "",
    text: upcoming
      ? `Não há mais compromissos previstos neste mês. A próxima atividade ocorrerá em ${monthName(upcoming.month).toLowerCase()}.`
      : "Não há mais compromissos previstos neste mês.",
  };
}

export function cellLineLabel(item) {
  const title = shortCalendarTitle(item);
  if (!title) return "";
  return item?.horario ? `${title} · ${item.horario}` : title;
}

export function overflowLabel(more) {
  const count = Number(more) || 0;
  if (count < 1) return "";
  return `+${count} ${count === 1 ? "registro" : "registros"}`;
}

export function cellAriaLabel(day, month, items, { isToday = false, isNext = false } = {}) {
  const parts = [dayHeading(day, month)];
  (items || []).forEach((item) => {
    const title = item.titulo || shortCalendarTitle(item);
    parts.push(item.horario ? `${title} às ${item.horario}` : title);
  });
  if (isToday) parts.push("hoje");
  if (isNext) parts.push("próxima sessão");
  return parts.filter(Boolean).join(". ");
}

export function cellPreview(items) {
  const list = items || [];
  if (!list.length) return { mode: "empty", lines: [], more: 0 };
  const lines = list.slice(0, 2).map((item) => ({
    title: shortCalendarTitle(item),
    fullTitle: item.titulo || shortCalendarTitle(item),
    time: item.horario || "",
    label: cellLineLabel(item),
    categoria: item.categoria,
  }));
  const more = Math.max(0, list.length - 2);
  if (list.length === 1) {
    return {
      mode: "single",
      title: lines[0].title,
      time: lines[0].time,
      label: lines[0].label,
      categoria: lines[0].categoria,
      lines,
      more: 0,
    };
  }
  if (list.length === 2) {
    return {
      mode: "two",
      titles: lines.map((line) => line.title),
      categorias: lines.map((line) => line.categoria),
      lines,
      more: 0,
    };
  }
  return {
    mode: "overflow",
    titles: lines.map((line) => line.title),
    categorias: lines.map((line) => line.categoria),
    lines,
    more,
    count: list.length,
    label: overflowLabel(more),
  };
}

export function findNextSessionItem(items, from = new Date()) {
  const today = startOfLocalDay(from);
  return (items || [])
    .filter((item) => item.categoria === "sessao" && item.year != null)
    .map((item) => ({
      ...item,
      when: item.when instanceof Date ? item.when : new Date(item.year, item.mes - 1, item.dia, 19, 30),
    }))
    .filter((item) => !Number.isNaN(item.when.getTime()) && startOfLocalDay(item.when) >= today)
    .sort((a, b) => a.when - b.when)[0] || null;
}

export function isSameCalendarDay(item, view, day) {
  return item
    && Number(item.dia) === Number(day)
    && Number(item.mes) === Number(view.month)
    && (item.year == null || Number(item.year) === Number(view.year));
}

export function emptyDayCopy() {
  return "Nenhum compromisso programado.";
}

export function emptyDayHint() {
  return "Aproveite este dia para organizar sua agenda para a próxima sessão.";
}

export function dayHeading(day, month) {
  return `${Number(day)} de ${monthName(month).toLowerCase()}`;
}

export function agendaListLabel(item) {
  const date = `${padDay(item.dia)} ${monthAbbr(item.mes)}`;
  if (item.categoria === "sessao" && item.horario) return `${date} · ${item.horario}`;
  return date;
}

export function agendaListTitle(item) {
  if (item.categoria === "irmao") return `Aniversário de ${item.titulo}`;
  if (item.categoria === "iniciacao") return `Aniversário de Iniciação de ${item.titulo}`;
  if (item.categoria === "cunhada") return `Aniversário de ${item.titulo}`;
  if (item.categoria === "familiar") return `Aniversário de ${item.titulo}`;
  if (item.categoria === "casamento") return `Aniversário de casamento de ${item.titulo}`;
  return item.titulo;
}

export function agendaListKind(item) {
  const found = CALENDAR_LEGEND.find((entry) => entry.id === item.categoria);
  return found?.label || "Evento";
}

export function sessionPresenceCopy(item) {
  if (item?.categoria !== "sessao") return "";
  return item.presencaObrigatoria ? "Presença necessária" : "Presença recomendada";
}

export function nextSessionAnchor(view, day, from = new Date()) {
  const selected = new Date(view.year, view.month - 1, Number(day));
  const today = startOfLocalDay(from);
  if (Number.isNaN(selected.getTime())) return today;
  return selected > today ? selected : today;
}

export function nextSessionCardCopy(item, { isNext = true } = {}) {
  if (!item) return null;
  const when = item.when instanceof Date ? item.when : new Date(item.year, item.mes - 1, item.dia);
  const time = item.horario || formatHourBr(when);
  return {
    dateLabel: `${Number(item.dia)} de ${monthName(item.mes).toLowerCase()}`,
    eventLabel: time ? `${item.titulo} · ${time}` : item.titulo,
    place: item.loja || "",
    presence: sessionPresenceCopy(item),
    programHeading: sessionProgramHeading(isNext),
    program: sessionProgramItems(item),
  };
}

export function sortAgendaItems(items) {
  return [...(items || [])].sort((a, b) => {
    if (a.dia !== b.dia) return a.dia - b.dia;
    if (Boolean(a.horario) !== Boolean(b.horario)) return a.horario ? 1 : -1;
    return String(a.horario || "").localeCompare(String(b.horario || ""))
      || String(a.titulo || "").localeCompare(String(b.titulo || ""), "pt-BR");
  });
}
