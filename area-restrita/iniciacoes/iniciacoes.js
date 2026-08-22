import { bootPage } from "../js/page.js";
import { el, showEmpty, showError, showSkeleton } from "../js/ui-state.js";
import { isoToBr } from "../js/dates-br.js";
import {
  filterByName,
  iconSvg,
  monthAbbr,
  monthName,
  padDay,
  remainingInMonth,
  occurredInMonth,
  ensureUpcomingMonth,
  isCurrentMonthView,
  nextMonthWithRemaining,
  prevMonthView,
  nextMonthView,
} from "../js/datas.js";
import { displayLodgeName, displayPersonName, isOwnIrmao } from "../js/vinculo.js";
import {
  MACONIC_FILTER_ORDER,
  MACONIC_TYPE_ORDER,
  collectMasonicDates,
  detalheForMasonicDate,
  daysUntilNext,
  masonicCompletedNotice,
  masonicMonthCopy,
  masonicType,
} from "../js/datas-maconicas.js";

let view = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

await bootPage("Datas Maçônicas", async (ctx) => {
  fillCategorySelect();
  document.querySelector("#filtros").addEventListener("submit", (event) => event.preventDefault());
  document.querySelector("#filtros").addEventListener("input", () => load(ctx));
  document.querySelector("#limpar-busca").addEventListener("click", () => {
    document.querySelector("#filtro-nome").value = "";
    load(ctx);
  });
  document.querySelector("#mes-anterior").addEventListener("click", () => {
    view = prevMonthView(view);
    load(ctx);
  });
  document.querySelector("#mes-seguinte").addEventListener("click", () => {
    view = nextMonthView(view);
    load(ctx);
  });
  await load(ctx);
});

function fillCategorySelect() {
  const select = document.querySelector("#filtro-categoria");
  const current = select.value || "todos";
  select.replaceChildren(new Option("Todos", "todos"));
  for (const id of MACONIC_FILTER_ORDER) {
    const type = masonicType(id);
    if (!type) continue;
    const option = new Option(type.ativo ? type.label : `${type.label} · em breve`, type.id);
    option.disabled = !type.ativo;
    select.append(option);
  }
  select.value = [...select.options].some((option) => option.value === current && !option.disabled) ? current : "todos";
}

function clearFilters(ctx) {
  document.querySelector("#filtro-categoria").value = "todos";
  document.querySelector("#filtro-nome").value = "";
  load(ctx);
}

function syncCategoryOptions(counts) {
  document.querySelectorAll("#filtro-categoria option").forEach((option) => {
    if (option.value === "todos") {
      option.textContent = "Todos";
      return;
    }
    const type = masonicType(option.value);
    if (!type?.ativo) {
      option.disabled = true;
      option.textContent = `${type?.label || option.value} · em breve`;
      return;
    }
    option.disabled = false;
    option.textContent = `${type.label} (${counts[option.value] || 0})`;
  });
}

function setMonthNavTitle(viewState) {
  const node = document.querySelector("#mes-atual");
  node.replaceChildren(document.createTextNode(`${monthName(viewState.month)} de ${viewState.year}`));
  if (!isCurrentMonthView(viewState)) return;
  node.append(document.createTextNode(" · "));
  node.append(el("span", "month-current", "Mês atual"));
}

function categoryHeading(tipo) {
  const kind = masonicType(tipo);
  const heading = el("h3", `category-title cat-${tipo}`);
  heading.insertAdjacentHTML("afterbegin", iconSvg(kind?.icon || tipo));
  heading.append(document.createTextNode(kind?.label || tipo));
  return heading;
}

async function load(ctx) {
  const root = document.querySelector("#lista");
  const meta = document.querySelector("#lista-meta");
  const query = document.querySelector("#filtro-nome").value;
  const clear = document.querySelector("#limpar-busca");
  const summary = document.querySelector("#resumo-mes");
  const pastRoot = document.querySelector("#passados");
  clear.hidden = !String(query || "").trim();
  showSkeleton(root, 4);
  meta.hidden = true;
  pastRoot.replaceChildren();
  const { data, error } = await ctx.supabase
    .from("irmaos")
    .select("id, nome, data_iniciacao, loja_iniciacao, exibir_iniciacao")
    .eq("ativo", true);
  if (error) {
    showError(root, () => load(ctx));
    return;
  }
  const items = collectMasonicDates({ irmaos: data || [] }, { isOwn: (id) => isOwnIrmao(ctx.profile, id) });
  view = ensureUpcomingMonth(view, items);
  const inMonth = remainingInMonth(items, view.month, view.year);
  const pastMonth = occurredInMonth(items, view.month, view.year);
  setMonthNavTitle(view);
  const previous = prevMonthView(view);
  const prevHas = remainingInMonth(items, previous.month, previous.year).length + occurredInMonth(items, previous.month, previous.year).length > 0;
  document.querySelector("#mes-anterior").disabled = !prevHas;
  const counts = Object.fromEntries(MACONIC_TYPE_ORDER.map((key) => [key, inMonth.filter((item) => item.tipo === key).length]));
  syncCategoryOptions(counts);
  const monthLabel = monthName(view.month);
  const upcoming = nextMonthWithRemaining(view, items);
  summary.replaceChildren(
    el("p", "month-summary-title", `${monthLabel} de ${view.year}`),
    el("p", "month-summary-copy", masonicMonthCopy({
      remaining: inMonth.length,
      occurred: pastMonth.length,
      nextDays: daysUntilNext(inMonth),
      monthLabel,
    })),
  );
  const category = document.querySelector("#filtro-categoria").value;
  let visible = filterByName(inMonth, query);
  if (category !== "todos") visible = visible.filter((item) => item.tipo === category);
  visible.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));
  const pastVisible = filterPast(pastMonth, category, query);
  const hasQuery = Boolean(String(query || "").trim());
  if (hasQuery && visible.length) {
    meta.hidden = false;
    meta.textContent = `${visible.length} resultado${visible.length === 1 ? "" : "s"} encontrado${visible.length === 1 ? "" : "s"}`;
  } else {
    meta.hidden = true;
  }
  if (!visible.length) {
    if (hasQuery || !pastVisible.length) {
      showEmpty(root, hasQuery ? `Nenhum resultado para ‘${String(query).trim()}’.` : "Nenhuma data maçônica encontrada para este período.", {
        compact: true,
        action: { label: "Limpar filtros", onClick: () => clearFilters(ctx) },
      });
    } else {
      root.replaceChildren();
      const types = category === "todos"
        ? MACONIC_TYPE_ORDER.filter((key) => pastVisible.some((item) => item.tipo === key))
        : [category];
      types.forEach((tipo) => root.append(categoryHeading(tipo)));
      root.append(renderCompletedNotice({
        monthLabel,
        nextMonthLabel: upcoming ? monthName(upcoming.month) : "",
      }));
    }
    renderPast(pastRoot, pastVisible);
    return;
  }
  root.replaceChildren();
  const byType = new Map();
  for (const item of visible) {
    if (!byType.has(item.tipo)) byType.set(item.tipo, []);
    byType.get(item.tipo).push(item);
  }
  const groups = category === "todos"
    ? MACONIC_TYPE_ORDER.filter((key) => byType.get(key)?.length)
    : [category];
  for (const tipo of groups) {
    const registros = byType.get(tipo) || [];
    if (!registros.length) continue;
    root.append(categoryHeading(tipo));
    const list = el("ul", "celebration-list");
    registros.forEach((item) => list.append(renderItem(item)));
    root.append(list);
  }
  renderPast(pastRoot, pastVisible);
}

function filterPast(items, category, query) {
  let rows = filterByName(items, query);
  if (category !== "todos") rows = rows.filter((item) => item.tipo === category);
  return rows.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));
}

function renderCompletedNotice({ monthLabel, nextMonthLabel }) {
  const block = el("div", "month-complete");
  const icon = el("span", "month-complete-icon", "✓");
  icon.setAttribute("aria-hidden", "true");
  const copy = el("div", "month-complete-copy");
  masonicCompletedNotice({ monthLabel, nextMonthLabel }).forEach((line, index) => {
    copy.append(el("p", index === 0 ? "month-complete-title" : "", line));
  });
  block.append(icon, copy);
  return block;
}

function renderPast(root, rows) {
  if (!rows.length) {
    root.replaceChildren();
    return;
  }
  const details = document.createElement("details");
  details.className = "past-birthdays";
  const summary = document.createElement("summary");
  summary.textContent = `Ver datas já comemoradas neste mês (${rows.length})`;
  const list = el("ul", "celebration-list");
  rows.forEach((item) => list.append(renderItem(item, { past: true, allowOwn: false })));
  details.append(summary, list);
  root.replaceChildren(details);
}

function renderItem(item, { past = false, allowOwn = true } = {}) {
  const kind = masonicType(item.tipo);
  const own = allowOwn && item.proprio && Boolean(kind?.ownBadge);
  const li = el("li", own ? "celebration-item is-own" : "celebration-item");
  const date = el("span", "date-block");
  date.append(el("strong", "", padDay(item.dia)), el("span", "", monthAbbr(item.mes)));
  const body = el("div", "celebration-body");
  const identity = el("div", "celebration-identity");
  identity.append(el("strong", "person-name", displayPersonName(item.nome)));
  if (own) identity.append(el("span", "own-badge", kind.ownBadge));
  body.append(identity);
  const detalhe = detalheForMasonicDate(item, { past });
  if (detalhe) body.append(el("p", "celebration-meta", detalhe));
  if (item.tipo === "iniciacao" && item.data) {
    body.append(el("p", "celebration-date", `Iniciado em ${isoToBr(item.data)}`));
  }
  if (item.local) {
    const lodge = el("div", "celebration-local");
    lodge.append(
      el("span", "celebration-local-label", "Loja de iniciação"),
      el("span", "celebration-local-name", displayLodgeName(item.local)),
    );
    body.append(lodge);
  }
  li.append(date, body);
  return li;
}
