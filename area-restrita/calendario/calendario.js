import { bootPage } from "../js/page.js";
import { el, showEmpty, showError, showSkeleton } from "../js/ui-state.js";
import {
  completeYears,
  iconSvg,
  isCurrentMonthView,
  monthAbbr,
  monthName,
  yearsLabel,
} from "../js/datas.js";
import { caminhadaLabel } from "../js/datas-maconicas.js";
import { institutionalDatesForCalendar } from "../js/datas-institucionais.js";
import {
  CALENDAR_FILTER_GROUPS,
  agendaListKind,
  agendaListLabel,
  agendaListTitle,
  categoryLabel,
  categoryMark,
  cellAriaLabel,
  cellMobilePreview,
  cellPreview,
  dayHeading,
  emptyDayCopy,
  emptyDayNextHeading,
  filterCalendarItems,
  filterTriggerLabel,
  findNextSessionItem,
  formatHourBr,
  groupCheckState,
  isSameCalendarDay,
  itemsInMonth,
  itemsOnDay,
  monthContextCopy,
  monthSummaryMarks,
  nextSessionAnchor,
  nextSessionCardCopy,
  sessionPresenceCopy,
  setCategoryHidden,
  setGroupHidden,
  sortAgendaItems,
} from "../js/calendario-agenda.js";
import { displayMainName, displayPersonName } from "../js/vinculo.js";
import { bindLayoutMode, isMobileLayout } from "../js/layout-mode.js";
import { isLodgeSessionType, LODGE_NAME, sessionTitle } from "../js/sessoes.js";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const COLORS = {
  irmao: "#123a74",
  cunhada: "#6b3a6d",
  familiar: "#1f5f4a",
  casamento: "#8a5a12",
  iniciacao: "#0b2858",
  data_maconica: "#8a5a12",
  evento: "#13415f",
  sessao: "#0b2858",
};

let view = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
let selectedDay = new Date().getDate();
let cache = [];
let hiddenTypes = new Set();
let filterOpen = false;

await bootPage("Calendário", async (ctx) => {
  document.querySelector("#mes-anterior").addEventListener("click", () => shift(-1));
  document.querySelector("#mes-seguinte").addEventListener("click", () => shift(1));
  document.addEventListener("click", (event) => {
    const wrap = document.querySelector("#filtro-calendario");
    if (!filterOpen || wrap?.contains(event.target)) return;
    filterOpen = false;
    renderFilter();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !filterOpen) return;
    filterOpen = false;
    renderFilter();
  });
  bindLayoutMode(() => {
    if (cache.length) renderMonth();
  });
  await load(ctx);
});

function shift(delta) {
  view.month += delta;
  if (view.month < 1) { view.month = 12; view.year -= 1; }
  if (view.month > 12) { view.month = 1; view.year += 1; }
  selectedDay = 1;
  renderMonth();
}

function setMonthNavTitle() {
  const node = document.querySelector("#mes-atual");
  node.replaceChildren(document.createTextNode(`${monthName(view.month)} de ${view.year}`));
  if (!isCurrentMonthView(view)) return;
  node.append(document.createTextNode(" · "));
  node.append(el("span", "month-current", "Mês atual"));
}

async function load(ctx) {
  const root = document.querySelector("#calendario");
  showSkeleton(root, 8);
  const [irmaosRes, familiaresRes, casamentosRes, eventosRes, institucionaisRes] = await Promise.all([
    ctx.supabase.from("irmaos").select("id, nome, dia_nascimento, mes_nascimento, data_iniciacao, exibir_aniversario, exibir_iniciacao").eq("ativo", true),
    ctx.supabase.from("familiares").select("nome, parentesco, dia_nascimento, mes_nascimento, autorizado_exibicao").eq("ativo", true),
    ctx.supabase.from("casamentos").select("irmao_id, data_casamento, autorizado_exibicao").eq("ativo", true),
    ctx.supabase.from("eventos_internos").select("titulo, descricao, data_evento, inicia_em, tipo_evento, publicado, ativo, presenca_obrigatoria").eq("publicado", true).eq("ativo", true),
    ctx.supabase.from("datas_institucionais").select("chave, titulo, descricao, dia, mes, tipo, recorrencia, dia_inteiro, ativo").eq("ativo", true),
  ]);
  if (irmaosRes.error || familiaresRes.error || casamentosRes.error || eventosRes.error) {
    showError(root, () => load(ctx));
    return;
  }
  const irmaoById = new Map((irmaosRes.data || []).map((row) => [row.id, row.nome]));
  cache = [];
  for (const row of irmaosRes.data || []) {
    if (row.exibir_aniversario && row.dia_nascimento && row.mes_nascimento) {
      cache.push({
        categoria: "irmao",
        titulo: displayPersonName(row.nome),
        tituloCurto: displayMainName(row.nome),
        descricao: "Aniversário do Irmão",
        dia: row.dia_nascimento,
        mes: row.mes_nascimento,
        year: null,
      });
    }
    if (row.exibir_iniciacao && row.data_iniciacao) {
      const [, month, day] = row.data_iniciacao.slice(0, 10).split("-").map(Number);
      cache.push({
        categoria: "iniciacao",
        titulo: displayPersonName(row.nome),
        tituloCurto: displayMainName(row.nome),
        descricao: caminhadaLabel(completeYears(row.data_iniciacao)),
        dia: day,
        mes: month,
        year: null,
      });
    }
  }
  for (const row of familiaresRes.data || []) {
    if (!row.autorizado_exibicao || !row.dia_nascimento) continue;
    cache.push({
      categoria: row.parentesco === "esposa" || row.parentesco === "companheira" ? "cunhada" : "familiar",
      titulo: displayPersonName(row.nome),
      tituloCurto: displayMainName(row.nome),
      descricao: row.parentesco === "esposa" || row.parentesco === "companheira" ? "Aniversário de cunhada" : "Aniversário familiar",
      dia: row.dia_nascimento,
      mes: row.mes_nascimento,
      year: null,
    });
  }
  for (const row of casamentosRes.data || []) {
    if (!row.autorizado_exibicao || !row.data_casamento) continue;
    const [, month, day] = row.data_casamento.slice(0, 10).split("-").map(Number);
    cache.push({
      categoria: "casamento",
      titulo: displayPersonName(irmaoById.get(row.irmao_id) || "Casamento"),
      tituloCurto: displayMainName(irmaoById.get(row.irmao_id) || "Casamento"),
      descricao: yearsLabel(completeYears(row.data_casamento), "casamento"),
      dia: day,
      mes: month,
      year: null,
    });
  }
  for (const row of eventosRes.data || []) {
    if (row.inicia_em) {
      const when = new Date(row.inicia_em);
      cache.push({
        categoria: isLodgeSessionType(row.tipo_evento) ? "sessao" : "evento",
        tipoEvento: row.tipo_evento,
        titulo: sessionTitle(row),
        descricao: row.descricao || LODGE_NAME,
        horario: formatHourBr(when),
        dia: when.getDate(),
        mes: when.getMonth() + 1,
        year: when.getFullYear(),
        when,
        presencaObrigatoria: row.presenca_obrigatoria === true,
        loja: LODGE_NAME,
      });
      continue;
    }
    const source = row.data_evento || "";
    if (!source) continue;
    const [, month, day] = source.slice(0, 10).split("-").map(Number);
    cache.push({
      categoria: "evento",
      titulo: row.titulo,
      descricao: row.tipo_evento === "fundacao" ? yearsLabel(completeYears(source), "fundação") : (row.descricao || "Evento da Loja"),
      dia: day,
      mes: month,
      year: null,
    });
  }
  cache.push(...institutionalDatesForCalendar(institucionaisRes.error ? null : institucionaisRes.data));
  renderMonth();
}

function visibleOn(day) {
  return filterCalendarItems(itemsOnDay(cache, view.month, day, view.year), hiddenTypes);
}

function renderMonth() {
  setMonthNavTitle();
  renderContext();
  renderSummary();
  renderFilter();
  renderGrid();
  renderAgenda();
  renderDay();
}

function renderContext() {
  const node = document.querySelector("#contexto-mes");
  const copy = monthContextCopy({ items: filterCalendarItems(cache, hiddenTypes), view });
  node.replaceChildren();
  const title = el("p", "calendar-next-summary__title");
  title.insertAdjacentHTML("afterbegin", iconSvg("evento"));
  title.append(el("strong", "", copy.kicker || "Próximo compromisso"));
  node.append(title);
  if (copy.text) node.append(el("p", "calendar-next-summary__text", copy.text));
}

function renderSummary() {
  const node = document.querySelector("#resumo-mes");
  const marks = monthSummaryMarks(itemsInMonth(cache, view.month, view.year));
  if (!marks.length) {
    node.replaceChildren(el("p", "month-summary-copy", "Nenhum compromisso ou celebração neste mês."));
    return;
  }
  const list = el("div", "calendar-summary-list");
  marks.forEach((mark) => {
    const item = el("span", `calendar-summary-item cat-${mark.categoria}`);
    item.insertAdjacentHTML("afterbegin", iconSvg(mark.icon));
    item.append(el("span", "", mark.label));
    list.append(item);
  });
  node.replaceChildren(list);
}

function renderFilter() {
  const toggle = document.querySelector("#filtro-toggle");
  const panel = document.querySelector("#filtro-painel");
  toggle.textContent = `${filterTriggerLabel(hiddenTypes)} ▾`;
  toggle.setAttribute("aria-expanded", String(filterOpen));
  toggle.onclick = (event) => {
    event.stopPropagation();
    filterOpen = !filterOpen;
    renderFilter();
  };
  if (!filterOpen) {
    panel.hidden = true;
    panel.replaceChildren();
    return;
  }
  panel.hidden = false;
  const list = el("div", "calendar-filter-groups");
  CALENDAR_FILTER_GROUPS.forEach((group) => {
    const block = el("fieldset", "calendar-filter-group");
    const legend = el("label", "calendar-filter-group-title");
    const groupBox = document.createElement("input");
    groupBox.type = "checkbox";
    const state = groupCheckState(hiddenTypes, group);
    groupBox.checked = state === "all";
    groupBox.indeterminate = state === "some";
    groupBox.addEventListener("change", () => {
      hiddenTypes = setGroupHidden(hiddenTypes, group, groupBox.checked);
      renderMonth();
    });
    legend.append(groupBox, document.createTextNode(group.label));
    block.append(legend);
    group.items.forEach((id) => {
      const row = el("label", `calendar-filter-item cat-${id}`);
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = !hiddenTypes.has(id);
      box.addEventListener("change", () => {
        hiddenTypes = setCategoryHidden(hiddenTypes, id, box.checked);
        renderMonth();
      });
      const mark = el("span", "cal-chip-dot");
      mark.style.background = COLORS[id] || COLORS.evento;
      row.append(box, mark, document.createTextNode(categoryLabel(id)));
      block.append(row);
    });
    list.append(block);
  });
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "calendar-filter-clear";
  clear.textContent = "Exibir todos";
  clear.hidden = hiddenTypes.size === 0;
  clear.addEventListener("click", () => {
    hiddenTypes = new Set();
    renderMonth();
  });
  panel.replaceChildren(list, clear);
}

function renderGrid() {
  const root = document.querySelector("#calendario");
  const first = new Date(view.year, view.month - 1, 1);
  const start = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month, 0).getDate();
  const grid = el("div", "cal-grid");
  WEEKDAYS.forEach((label) => grid.append(el("div", "cal-dow", label)));
  const today = new Date();
  const nextSession = findNextSessionItem(cache);
  for (let i = 0; i < start; i += 1) grid.append(el("div", "cal-day calendar-day--empty is-muted", ""));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = el("button", "cal-day");
    cell.type = "button";
    const items = visibleOn(day);
    const isToday = day === today.getDate() && view.month === today.getMonth() + 1 && view.year === today.getFullYear();
    const isNext = isSameCalendarDay(nextSession, view, day);
    cell.classList.add(items.length ? "calendar-day--has-events" : "calendar-day--empty");
    if (isToday) {
      cell.classList.add("is-today", "calendar-day--today");
      cell.setAttribute("aria-current", "date");
    }
    if (day === selectedDay) cell.classList.add("is-selected", "calendar-day--selected");
    if (items.some((item) => item.categoria === "sessao")) cell.classList.add("has-session", "calendar-day--session");
    if (isNext) cell.classList.add("is-next-session");
    cell.setAttribute("aria-pressed", String(day === selectedDay));
    cell.setAttribute("aria-label", cellAriaLabel(day, view.month, items, { isToday, isNext }));
    if (isToday) cell.append(el("span", "cal-today-badge calendar-day__today-badge", "Hoje"));
    const head = el("span", "cal-day-head calendar-day__number");
    head.append(el("strong", "", String(day)));
    cell.append(head);
    const events = el("div", "calendar-day__events");
    appendCellPreview(events, items, isNext);
    cell.append(events);
    cell.addEventListener("click", () => {
      selectedDay = day;
      renderMonth();
    });
    grid.append(cell);
  }
  root.replaceChildren(grid);
}

function appendEventIcon(node, categoria) {
  node.insertAdjacentHTML("afterbegin", iconSvg(categoryMark(categoria)));
}

function appendCellPreview(host, items, isNext = false) {
  if (isMobileLayout()) {
    appendMobileCellMarks(host, items);
    return;
  }
  const preview = cellPreview(items);
  if (preview.mode === "empty") return;
  preview.lines.forEach((line) => {
    const isSession = line.categoria === "sessao";
    const mark = el("div", `calendar-event calendar-event--${line.categoria}${isSession ? " calendar-event--session" : ""}`);
    const icon = el("span", "calendar-event__icon");
    icon.setAttribute("aria-hidden", "true");
    appendEventIcon(icon, line.categoria);
    const label = el("span", "calendar-event__label");
    label.append(document.createTextNode(line.title));
    if (line.time) {
      const sep = el("span", "calendar-event__separator", "·");
      sep.setAttribute("aria-hidden", "true");
      label.append(document.createTextNode(" "), sep, document.createTextNode(` ${line.time}`));
    }
    if (line.fullTitle) {
      mark.title = line.fullTitle;
      mark.setAttribute("aria-label", line.time ? `${line.fullTitle} às ${line.time}` : line.fullTitle);
    }
    mark.append(icon, label);
    host.append(mark);
    if (isNext && isSession) host.append(el("span", "calendar-event-badge", "Próxima"));
  });
  if (preview.more) host.append(el("span", "cal-more", preview.label));
}

function appendMobileCellMarks(host, items) {
  const compact = cellMobilePreview(items);
  if (compact.mode === "empty") return;
  const mark = el("span", `calendar-day__mark calendar-day__mark--${compact.mode}`);
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = compact.text;
  host.append(mark);
}

function renderAgenda() {
  const node = document.querySelector("#agenda-lista");
  const monthItems = sortAgendaItems(filterCalendarItems(itemsInMonth(cache, view.month, view.year), hiddenTypes));
  if (!monthItems.length) {
    showEmpty(node, "Nenhum compromisso ou celebração neste mês.", { compact: true });
    return;
  }
  const list = el("ul", "calendar-agenda-list");
  monthItems.forEach((item) => {
    const li = el("li", `calendar-agenda-item cat-${item.categoria}`);
    const date = el("span", "date-block");
    date.append(el("strong", "", String(item.dia).padStart(2, "0")), el("span", "", monthAbbr(item.mes)));
    const body = el("div", "celebration-body");
    body.append(el("strong", "person-name", agendaListTitle(item)));
    if (item.horario) body.append(el("p", "celebration-meta", agendaListLabel(item)));
    else body.append(el("p", "celebration-date", agendaListKind(item)));
    li.append(date, body);
    li.addEventListener("click", () => {
      selectedDay = item.dia;
      renderMonth();
      document.querySelector("#dia-detalhe")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    list.append(li);
  });
  node.replaceChildren(list);
}

function renderDay() {
  const node = document.querySelector("#dia-detalhe");
  const items = sortAgendaItems(visibleOn(selectedDay));
  if (!items.length) {
    const next = findNextSessionItem(cache, nextSessionAnchor(view, selectedDay));
    const copy = nextSessionCardCopy(next, { isNext: true });
    const wrap = el("div", "day-agenda-empty-card");
    wrap.append(el("h2", "day-agenda-empty", emptyDayCopy()));
    if (!copy) {
      wrap.append(renderQuietAgendaCard());
      node.replaceChildren(wrap);
      return;
    }
    wrap.append(el("p", "day-agenda-next-kicker", emptyDayNextHeading()));
    wrap.append(renderNextSessionCard(copy));
    node.replaceChildren(wrap);
    return;
  }
  const onlySession = items.length === 1 && items[0].categoria === "sessao";
  if (onlySession) {
    const next = findNextSessionItem(cache, nextSessionAnchor(view, selectedDay));
    const isNext = isSameCalendarDay(next, view, selectedDay);
    node.replaceChildren(renderNextSessionCard(nextSessionCardCopy(items[0], { isNext })));
    return;
  }
  node.replaceChildren(el("h2", "", dayHeading(selectedDay, view.month)));
  const list = el("ul", "day-agenda-list");
  items.forEach((item) => {
    const li = el("li", `day-agenda-item cat-${item.categoria}`);
    const mark = el("span", "day-agenda-icon");
    mark.insertAdjacentHTML("afterbegin", iconSvg(categoryMark(item.categoria)));
    const body = el("div", "day-agenda-body");
    const title = el("strong", "person-name");
    title.append(document.createTextNode(item.titulo));
    if (item.horario) {
      const sep = el("span", "cal-event-sep", "·");
      sep.setAttribute("aria-hidden", "true");
      title.append(document.createTextNode(" "), sep, document.createTextNode(` ${item.horario}`));
    }
    body.append(title);
    if (item.categoria === "sessao" && item.loja) {
      body.append(el("p", "day-agenda-place", item.loja));
    }
    if (item.descricao && item.descricao !== item.loja) {
      body.append(el("p", "day-agenda-copy", item.descricao));
    }
    const presence = sessionPresenceCopy(item);
    if (presence) body.append(el("p", "day-agenda-presence", presence));
    li.append(mark, body);
    list.append(li);
  });
  node.append(list);
}

function renderNextSessionCard(copy) {
  const card = document.createElement("section");
  card.className = "next-session-card";
  card.setAttribute("aria-labelledby", "next-session-title");
  const main = el("div", "next-session-card__main");
  const event = el("p", "next-session-card__event");
  event.insertAdjacentHTML("afterbegin", iconSvg("evento"));
  const title = document.createElement("strong");
  title.id = "next-session-title";
  title.textContent = copy.eventLabel;
  event.append(title);
  main.append(event);
  if (copy.dateLabel) main.append(el("p", "next-session-card__date", copy.dateLabel));
  if (copy.place) main.append(el("p", "next-session-card__place", copy.place));
  if (copy.presence) main.append(el("p", "next-session-card__attendance", copy.presence));
  card.append(main);
  if (copy.program?.length) {
    const side = el("div", "next-session-card__program");
    side.append(el("p", "next-session-card__program-title", copy.programHeading));
    const list = el("ul", "next-session-card__list");
    copy.program.forEach((step) => list.append(el("li", "next-session-card__item", step)));
    side.append(list);
    card.append(side);
  }
  return card;
}

function renderQuietAgendaCard() {
  const card = document.createElement("section");
  card.className = "next-session-card is-quiet";
  card.setAttribute("aria-labelledby", "next-session-title");
  const main = el("div", "next-session-card__main");
  const event = el("p", "next-session-card__event");
  event.insertAdjacentHTML("afterbegin", iconSvg("evento"));
  const title = document.createElement("strong");
  title.id = "next-session-title";
  title.textContent = "Próxima sessão";
  event.append(title);
  main.append(event);
  main.append(el("p", "next-session-card__place", "A Secretaria ainda não publicou a próxima sessão da Loja."));
  card.append(main);
  return card;
}

