import { bootPage } from "../js/page.js";
import { el, showEmpty, showError, showSkeleton } from "../js/ui-state.js";
import { filterByName, iconSvg, monthAbbr, monthName, padDay, remainingInMonth, occurredInMonth, ensureUpcomingMonth, isCurrentMonthView, monthRemainingCopy, prevMonthView, nextMonthView } from "../js/datas.js";
import { displayPersonName, isOwnIrmao } from "../js/vinculo.js";

const CATEGORIES = {
  irmao: "Irmãos",
  cunhada: "Cunhadas",
  familiar: "Familiares",
  casamento: "Casamentos",
};

const CATEGORY_ORDER = ["irmao", "cunhada", "familiar", "casamento"];

let view = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

await bootPage("Aniversários", async (ctx) => {
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
    option.textContent = `${CATEGORIES[option.value]} (${counts[option.value] || 0})`;
  });
}

function setMonthNavTitle(viewState) {
  const node = document.querySelector("#mes-atual");
  node.replaceChildren(document.createTextNode(`${monthName(viewState.month)} de ${viewState.year}`));
  if (!isCurrentMonthView(viewState)) return;
  node.append(document.createTextNode(" · "));
  node.append(el("span", "month-current", "Mês atual"));
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
  const [irmaosRes, familiaresRes, casamentosRes] = await Promise.all([
    ctx.supabase.from("irmaos").select("id, nome, dia_nascimento, mes_nascimento, exibir_aniversario").eq("ativo", true),
    ctx.supabase.from("familiares").select("id, irmao_id, nome, parentesco, dia_nascimento, mes_nascimento, autorizado_exibicao").eq("ativo", true),
    ctx.supabase.from("casamentos").select("id, irmao_id, data_casamento, autorizado_exibicao").eq("ativo", true),
  ]);
  if (irmaosRes.error || familiaresRes.error || casamentosRes.error) {
    showError(root, () => load(ctx));
    return;
  }
  const irmaoById = new Map((irmaosRes.data || []).map((row) => [row.id, row.nome]));
  const items = [];
  for (const row of irmaosRes.data || []) {
    if (!row.exibir_aniversario || !row.dia_nascimento || !row.mes_nascimento) continue;
    items.push({
      categoria: "irmao",
      id: row.id,
      nome: row.nome,
      dia: row.dia_nascimento,
      mes: row.mes_nascimento,
      proprio: isOwnIrmao(ctx.profile, row.id),
    });
  }
  for (const row of familiaresRes.data || []) {
    if (!row.autorizado_exibicao || !row.dia_nascimento || !row.mes_nascimento) continue;
    items.push({
      categoria: row.parentesco === "esposa" || row.parentesco === "companheira" ? "cunhada" : "familiar",
      nome: row.nome,
      dia: row.dia_nascimento,
      mes: row.mes_nascimento,
      proprio: false,
    });
  }
  for (const row of casamentosRes.data || []) {
    if (!row.autorizado_exibicao || !row.data_casamento) continue;
    const [, month, day] = row.data_casamento.slice(0, 10).split("-").map(Number);
    items.push({
      categoria: "casamento",
      nome: irmaoById.get(row.irmao_id) || "Casamento",
      dia: day,
      mes: month,
      proprio: isOwnIrmao(ctx.profile, row.irmao_id),
    });
  }
  view = ensureUpcomingMonth(view, items);
  const inMonth = remainingInMonth(items, view.month, view.year);
  const pastMonth = occurredInMonth(items, view.month, view.year);
  setMonthNavTitle(view);
  const previous = prevMonthView(view);
  const prevHas = remainingInMonth(items, previous.month, previous.year).length + occurredInMonth(items, previous.month, previous.year).length > 0;
  document.querySelector("#mes-anterior").disabled = !prevHas;
  const counts = Object.fromEntries(CATEGORY_ORDER.map((key) => [key, inMonth.filter((item) => item.categoria === key).length]));
  syncCategoryOptions(counts);
  const sortedMonth = [...inMonth].sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));
  const nextIsOwn = Boolean(sortedMonth[0]?.proprio && sortedMonth[0]?.categoria === "irmao");
  summary.replaceChildren(
    el("p", "month-summary-title", `${monthName(view.month)} de ${view.year}`),
    el("p", "month-summary-copy", monthRemainingCopy(inMonth.length, nextIsOwn, monthName(view.month).toLowerCase())),
  );
  const category = document.querySelector("#filtro-categoria").value;
  let visible = filterByName(inMonth, query);
  if (category !== "todos") visible = visible.filter((item) => item.categoria === category);
  visible.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));
  const hasQuery = Boolean(String(query || "").trim());
  if (hasQuery && visible.length) {
    meta.hidden = false;
    meta.textContent = `${visible.length} resultado${visible.length === 1 ? "" : "s"} encontrado${visible.length === 1 ? "" : "s"}`;
  } else {
    meta.hidden = true;
  }
  if (!visible.length) {
    const pastVisible = filterPast(pastMonth, category, query);
    if (hasQuery || !pastVisible.length) {
      showEmpty(root, hasQuery ? `Nenhum resultado para ‘${String(query).trim()}’.` : "Nenhuma celebração encontrada para este período.", {
        compact: true,
        action: { label: "Limpar filtros", onClick: () => clearFilters(ctx) },
      });
    } else {
      root.replaceChildren();
    }
    renderPast(pastRoot, pastVisible);
    return;
  }
  root.replaceChildren();
  const byCat = new Map();
  for (const item of visible) {
    if (!byCat.has(item.categoria)) byCat.set(item.categoria, []);
    byCat.get(item.categoria).push(item);
  }
  const groups = category === "todos"
    ? CATEGORY_ORDER.filter((key) => byCat.get(key)?.length)
    : [category];
  for (const categoria of groups) {
    const registros = byCat.get(categoria) || [];
    if (!registros.length) continue;
    const heading = el("h3", `category-title cat-${categoria}`);
    heading.insertAdjacentHTML("afterbegin", iconSvg(categoria));
    heading.append(document.createTextNode(CATEGORIES[categoria]));
    root.append(heading);
    const list = el("ul", "celebration-list");
    registros.forEach((item) => list.append(renderItem(item)));
    root.append(list);
  }
  renderPast(pastRoot, filterPast(pastMonth, category, query));
}

function filterPast(items, category, query) {
  let rows = filterByName(items, query);
  if (category !== "todos") rows = rows.filter((item) => item.categoria === category);
  return rows.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));
}

function renderPast(root, rows) {
  if (!rows.length) {
    root.replaceChildren();
    return;
  }
  const details = document.createElement("details");
  details.className = "past-birthdays";
  const summary = document.createElement("summary");
  summary.textContent = `Aniversários já realizados neste mês (${rows.length})`;
  const list = el("ul", "celebration-list");
  rows.forEach((item) => list.append(renderItem(item, false)));
  details.append(summary, list);
  root.replaceChildren(details);
}

function renderItem(item, allowOwn = true) {
  const own = allowOwn && item.proprio && item.categoria === "irmao";
  const li = el("li", own ? "celebration-item is-own" : "celebration-item");
  const date = el("span", "date-block");
  date.append(el("strong", "", padDay(item.dia)), el("span", "", monthAbbr(item.mes)));
  const body = el("div", "celebration-body");
  body.append(el("strong", "person-name", displayPersonName(item.nome)));
  if (own) body.append(el("span", "own-badge", "Seu aniversário"));
  li.append(date, body);
  return li;
}
