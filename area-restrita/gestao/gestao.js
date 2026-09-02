import { bootPage } from "../js/page.js";
import { invokeFunction } from "../js/client.js";
import { el, showEmpty } from "../js/ui-state.js";
import { bindBrDatePicker, bindBrDateInput, bindBrTimeInput, formatDateTimeBr, isoToBr, joinDateTime, parseFlexibleBrDate, readIsoDate, splitDateTime } from "../js/dates-br.js";
import { createSearchSelect } from "../js/search-select.js";
import { eligibleConjuges, eligibleIrmaos } from "../js/casamento-elegibilidade.js";
import { displayPersonName } from "../js/vinculo.js";
import { bindDialog, syncOverlayLock } from "../js/modal.js";
import { adminNavState, bindLayoutMode, isMobileLayout } from "../js/layout-mode.js";
import { sectionLabel, shouldHideDesktopTabs } from "../js/section-switcher.js";
import { beginSubmit, clearToasts, endSubmit, showToast } from "../js/feedback.js";
import {
  NOTICE_STATUS_LABELS,
  NOTICE_TYPE_LABELS,
  canSeeMigrationTools,
  noticeDisplayStatus,
  noticePeriodLabel,
  rowClickOpensDetails,
  truncateText,
} from "../js/comunicados.js";
import {
  accessCardModel,
  accessDialogModel,
  accessStatus,
  actionToastMessage,
  assignableProfiles,
  birthInputFromParts,
  buildAccessTimeline,
  buildBrotherTimeline,
  canDeleteBrother,
  cimLabel,
  currentMovements,
  DEFAULT_LOJA_INICIACAO,
  DRAWER_SECTIONS,
  familyGroups,
  ficheActions,
  filterGestaoBrothers,
  listMenuActions,
  filtersAreActive,
  formatFicheDate,
  grauLabel,
  mapSaveError,
  MODAL_PROFILE_LABELS,
  movementChoices,
  movementTitle,
  resultsCountLabel,
  roleLabel,
  situacaoAllowed,
  situacaoDotLabel,
  situacaoTone,
  validateBrotherForm,
  validateQuietPlacet,
  validateTransferencia,
} from "../js/gestao-irmaos.js";
import {
  canAssignCargo,
  canManageInstitutionalOffices,
  cargoLabel,
  isStaffProfile,
  officeSelectOptions,
} from "../js/cargos.js";

const EVENT_TYPE_LABELS = {
  sessao_ordinaria: "Sessão ordinária",
  sessao_administrativa: "Sessão administrativa",
  sessao_magna: "Sessão magna",
  reuniao: "Reunião",
  comunicado: "Comunicado",
  outro: "Outro",
};

let ctx;
let irmaos = [];
let cadastro = { irmaos: [], familiares: [], casamentos: [] };
let eventos = [];
let comunicados = [];
let highlightedId = "";
let novoDialog;
let adminDialog;
let irmaosStatus = "loading";
let searchTimer = 0;
let drawerRow = null;
let drawerToken = 0;
let accessDialogRow = null;

await bootPage("Gestão de Irmãos", async (page) => {
  ctx = page;
  ctx.selects = ctx.selects || {};
  try {
    if (!canSeeMigrationTools(page.profile.perfil)) {
      document.querySelectorAll("[data-tab='ferramentas'], [data-panel='ferramentas']").forEach((node) => node.remove());
      document.querySelector("#tabs [data-dropdown]")?.remove();
    }
    if (!isStaffProfile(page.profile.perfil)) {
      document.querySelectorAll("#tabs [data-tab]:not([data-tab='irmaos']), [data-panel]:not([data-panel='irmaos'])").forEach((node) => node.remove());
      document.querySelector("#novo-irmao")?.remove();
    }
    bindTabs();
    bindSectionSwitcher();
    bindRowMenus();
    initializeNewMemberModal();
    novoDialog = bindDialog(document.querySelector("#dialog-novo"), {
      onClose: handleNewMemberModalClosed,
    });
    adminDialog = bindDialog(document.querySelector("#dialog-admin"), {
      onClose: handleAdminDialogClosed,
    });
    document.querySelector("#novo-irmao")?.addEventListener("click", openNewMemberModal);
    document.querySelector("#busca")?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(renderList, 300);
    });
    document.querySelector("#filtro-situacao")?.addEventListener("change", renderList);
    document.querySelector("#filtro-perfil")?.addEventListener("change", renderList);
    document.querySelector("#filtro-acesso")?.addEventListener("change", renderList);
    document.querySelector("#limpar-filtros-irmaos")?.addEventListener("click", clearBrotherFilters);
    fillProfileOptions(page.profile.perfil);
    document.querySelector("#form-novo")?.addEventListener("submit", saveNew);
    document.querySelector("#familiar-form")?.addEventListener("submit", saveFamiliar);
    document.querySelector("#casamento-form")?.addEventListener("submit", saveCasamento);
    document.querySelector("#evento-form")?.addEventListener("submit", saveEvento);
    document.querySelector("#comunicado-form")?.addEventListener("submit", saveComunicado);
    document.querySelector("#evento-descartar")?.addEventListener("click", () => resetForm("#evento-form"));
    document.querySelector("#comunicado-descartar")?.addEventListener("click", () => resetForm("#comunicado-form"));
    document.querySelector("#importar")?.addEventListener("click", importCsv);
    ["#novo-nascimento", "#novo-iniciacao", "#casamento-data", "#evento-data", "#comunicado-inicio-data", "#comunicado-fim-data"].forEach((id) => {
      bindBrDateInput(document.querySelector(id));
    });
    ["#evento-hora", "#comunicado-inicio-hora", "#comunicado-fim-hora"].forEach((id) => {
      bindBrTimeInput(document.querySelector(id));
    });
    const irmaoInput = document.querySelector("#casamento-irmao");
    const irmaoList = document.querySelector("#casamento-irmao-list");
    const conjugeInput = document.querySelector("#casamento-conjuge");
    const conjugeList = document.querySelector("#casamento-conjuge-list");
    const familiarInput = document.querySelector("#familiar-irmao");
    const familiarList = document.querySelector("#familiar-irmao-list");
    if (irmaoInput && irmaoList && conjugeInput && conjugeList && familiarInput && familiarList) {
      const irmaoSelect = createSearchSelect({ input: irmaoInput, list: irmaoList, placeholder: "Buscar Irmão..." });
      const conjugeSelect = createSearchSelect({ input: conjugeInput, list: conjugeList, placeholder: "Buscar cunhada elegível...", emptyText: "Nenhuma cunhada elegível foi encontrada para este Irmão." });
      const familiarIrmaoSelect = createSearchSelect({ input: familiarInput, list: familiarList, placeholder: "Buscar Irmão..." });
      ctx.selects = { irmaoSelect, conjugeSelect, familiarIrmaoSelect };
      irmaoInput.addEventListener("change", syncConjuge);
    }
  } catch {
    /* A lista de Irmãos ainda é carregada abaixo. */
  }
  await refresh();
  const aba = new URLSearchParams(location.search).get("aba");
  if (aba) openTab(aba);
}, { staff: true });

function bindTabs() {
  document.querySelector("#tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    openTab(button.dataset.tab);
  });
}

function bindSectionSwitcher() {
  const trigger = document.querySelector("#section-switcher-trigger");
  const nav = document.querySelector("[data-admin-nav]");
  if (!trigger || !nav) return;
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    nav.classList.toggle("is-open");
    applyAdminNavLayout();
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    nav.classList.add("is-open");
    applyAdminNavLayout();
    document.querySelector("#tabs [aria-selected='true'], #tabs [data-tab]")?.focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSectionMenu();
  });
  bindLayoutMode(() => {
    closeSectionMenu();
    applyAdminNavLayout();
    syncOverlayLock();
  });
  syncSectionSwitcher(document.querySelector("[data-tab][aria-selected='true']")?.dataset.tab || "irmaos");
  applyAdminNavLayout();
}

function bindRowMenus() {
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".overflow-menu")) closeRowMenus();
    if (!event.target.closest("[data-admin-nav]")) closeSectionMenu();
  });
}

function applyAdminNavLayout() {
  const nav = document.querySelector("[data-admin-nav]");
  const tabs = document.querySelector("#tabs");
  const trigger = document.querySelector("#section-switcher-trigger");
  const extraMenu = tabs?.querySelector("[data-dropdown] .nav-dropdown-menu");
  const extraToggle = tabs?.querySelector(".nav-dropdown-toggle");
  const mobile = isMobileLayout();
  const open = Boolean(nav?.classList.contains("is-open"));
  const state = adminNavState({ mobile, open });
  if (tabs) {
    tabs.hidden = shouldHideDesktopTabs(mobile, open) || state.tabBarHidden;
    tabs.setAttribute("aria-hidden", String(tabs.hidden));
  }
  trigger?.setAttribute("aria-expanded", String(mobile && open));
  if (extraToggle) extraToggle.hidden = mobile;
  if (extraMenu) extraMenu.hidden = !mobile && extraToggle?.getAttribute("aria-expanded") !== "true";
}

function closeSectionMenu() {
  const nav = document.querySelector("[data-admin-nav]");
  if (!nav?.classList.contains("is-open")) {
    applyAdminNavLayout();
    return;
  }
  nav.classList.remove("is-open");
  applyAdminNavLayout();
}

function syncSectionSwitcher(name) {
  const current = document.querySelector("#section-switcher-current");
  const tab = document.querySelector(`#tabs [data-tab="${name}"]`);
  if (current) current.textContent = tab?.textContent.trim() || sectionLabel(name);
}

function openTab(name) {
  clearToasts();
  document.querySelectorAll("[data-tab]").forEach((node) => node.setAttribute("aria-selected", String(node.dataset.tab === name)));
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
  syncSectionSwitcher(name);
  closeSectionMenu();
}

function closeRowMenus() {
  document.querySelectorAll(".overflow-menu.is-open").forEach((node) => {
    node.classList.remove("is-open", "is-left", "is-up");
    const panel = node.querySelector(".overflow-menu__panel");
    const toggle = node.querySelector(".overflow-menu__toggle");
    if (panel) panel.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
  });
}

async function staff(body) {
  return invokeFunction("gerenciar-irmao", { site_origin: location.origin, ...body }, ctx.session.access_token);
}

function feedback(ok, message) {
  showToast({ type: ok ? "success" : "error", message, duration: 5000 });
}

function resetForm(selector) {
  const form = document.querySelector(selector);
  form.reset();
  form.querySelectorAll("input[type=hidden]").forEach((input) => { input.value = ""; });
}

async function refresh() {
  if (irmaosStatus !== "success") {
    irmaosStatus = "loading";
    renderList();
  }
  try {
    const gestaoRes = await staff({ acao: "listar_gestao" });
    if (!gestaoRes.data?.irmaos && gestaoRes.data?.ok === false) {
      irmaosStatus = "error";
    } else {
      irmaos = gestaoRes.data?.irmaos || [];
      irmaosStatus = "success";
    }
    renderList();
  } catch {
    irmaosStatus = "error";
    renderList();
  }
  try {
    if (isStaffProfile(ctx.profile.perfil)) {
      const [cadastroRes, eventosRes, comunicadosRes] = await Promise.all([
        staff({ acao: "listar_cadastro" }),
        staff({ acao: "listar_eventos" }),
        staff({ acao: "listar_comunicados" }),
      ]);
      cadastro = cadastroRes.data || cadastro;
      eventos = eventosRes.data?.eventos || [];
      comunicados = comunicadosRes.data?.comunicados || [];
      ctx.selects?.familiarIrmaoSelect?.setOptions((cadastro.irmaos || []).filter((row) => row.ativo !== false).map((row) => ({ value: row.id, nome: row.nome })));
      ctx.selects?.irmaoSelect?.setOptions(eligibleIrmaos(cadastro).map((row) => ({ value: row.id, nome: row.nome })));
      syncConjuge();
      renderFamiliares();
      renderCasamentos();
      renderEventos();
      renderComunicados();
    }
  } catch {
    // A lista de Irmãos já foi resolvida acima.
  }
}

function currentFilters() {
  return {
    q: document.querySelector("#busca")?.value || "",
    situacao: document.querySelector("#filtro-situacao")?.value || "",
    perfil: document.querySelector("#filtro-perfil")?.value || "",
    acessoStatus: document.querySelector("#filtro-acesso")?.value || "",
  };
}

function clearBrotherFilters() {
  document.querySelector("#busca").value = "";
  document.querySelector("#filtro-situacao").value = "";
  document.querySelector("#filtro-perfil").value = "";
  document.querySelector("#filtro-acesso").value = "";
  renderList();
}

function setToolbarDisabled(disabled) {
  ["#busca", "#filtro-situacao", "#filtro-perfil", "#filtro-acesso"].forEach((id) => {
    const node = document.querySelector(id);
    if (node) node.disabled = disabled;
  });
}

function renderList() {
  const root = document.querySelector("#lista-irmaos");
  const count = document.querySelector("#irmaos-count");
  const clear = document.querySelector("#limpar-filtros-irmaos");
  if (!root || !count) return;
  applyAdminNavLayout();
  const filters = currentFilters();
  const filtered = filtersAreActive(filters);
  if (clear) clear.hidden = !filtered;
  setToolbarDisabled(irmaosStatus === "loading");
  root.setAttribute("aria-busy", String(irmaosStatus === "loading"));
  if (irmaosStatus === "loading") {
    count.textContent = "Carregando Irmãos…";
    root.replaceChildren(...brotherSkeletons());
    return;
  }
  if (irmaosStatus === "error") {
    count.textContent = "";
    root.replaceChildren();
    const box = el("div", "irmaos-state");
    box.append(el("p", "empty-state", "Não foi possível carregar os Irmãos."));
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button button-secondary";
    retry.textContent = "Tentar novamente";
    retry.addEventListener("click", () => refresh());
    box.append(retry);
    root.append(box);
    return;
  }
  const alerts = irmaos.filter((row) => row.quiet_placet?.previsao_termino && new Date(row.quiet_placet.previsao_termino) <= new Date());
  const rows = filterGestaoBrothers(irmaos, filters);
  count.textContent = resultsCountLabel(rows.length, filtered);
  root.replaceChildren();
  if (alerts.length) {
    root.append(el("p", "warning-note", `Há ${alerts.length} quiet placet(s) com término previsto vencido. A Secretaria deve reavaliar o retorno.`));
  }
  if (!irmaos.some((row) => row.cargo_institucional === "veneravel_mestre")) {
    root.append(el("p", "muted", "Sem Venerável Mestre vigente"));
  }
  if (!rows.length) {
    const empty = el("div", "irmaos-state");
    empty.append(
      el("p", "empty-state", "Nenhum Irmão encontrado."),
      el("p", "muted", "Ajuste os filtros ou cadastre um novo Irmão."),
    );
    root.append(empty);
    return;
  }
  rows.forEach((row) => root.append(renderBrotherRow(row)));
}

function brotherSkeletons() {
  return Array.from({ length: 7 }, () => {
    const row = el("article", "irmaos-row is-skeleton");
    row.setAttribute("aria-hidden", "true");
    row.append(el("span", "skeleton", ""), el("span", "skeleton", ""), el("span", "skeleton", ""), el("span", "skeleton", ""));
    return row;
  });
}

function renderBrotherRow(row) {
  const card = el("article", `irmaos-row${highlightedId && (row.irmao_id === highlightedId || row.id === highlightedId) ? " is-highlight" : ""}`);
  card.tabIndex = 0;
  card.setAttribute("aria-label", `${displayPersonName(row.nome)}. ${cimLabel(row)}`);
  const identity = el("div", "irmaos-identity");
  identity.append(el("strong", "person-name", displayPersonName(row.nome)));
  const grau = grauLabel(row);
  if (grau) identity.append(el("p", "irmaos-grau", grau));
  if (row.cargo_institucional) identity.append(el("p", "irmaos-cargo", cargoLabel(row.cargo_institucional)));
  identity.append(el("p", "irmaos-cim", cimLabel(row)));
  const situacao = el("div", "irmaos-situacao");
  situacao.append(situacaoMark(row.situacao));
  const access = accessStatus(row);
  const acesso = el("div", "irmaos-acesso");
  if (row.acesso_id && row.perfil) acesso.append(el("p", "irmaos-role", roleLabel(row.perfil)));
  const accessLine = el("p", "irmaos-access-label");
  accessLine.append(el("span", "irmaos-access-prefix", "Acesso: "), document.createTextNode(access.label));
  acesso.append(accessLine);
  const actions = el("div", "irmaos-actions record-actions");
  const details = document.createElement("button");
  details.type = "button";
  details.className = "irmaos-details";
  details.textContent = "Ver detalhes";
  details.addEventListener("click", (event) => {
    event.stopPropagation();
    openDrawer(row);
  });
  actions.append(details, renderOverflowMenu(row));
  card.append(identity, situacao, acesso, actions);
  card.addEventListener("click", (event) => {
    if (!rowClickOpensDetails(event.target)) return;
    openDrawer(row);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDrawer(row);
    }
  });
  return card;
}

function situacaoMark(situacao) {
  const mark = el("span", `situacao-mark is-${situacaoTone(situacao)}`);
  mark.append(el("span", "situacao-dot", ""), el("span", "situacao-text", situacaoDotLabel(situacao)));
  return mark;
}

function runFicheAction(row, actionId) {
  if (actionId === "editar_cadastro") return openEditBrother(row);
  if (actionId === "configurar_acesso") return openAccessDialog(row);
  if (actionId === "registrar_movimentacao") return openMovementDialog(row);
  if (actionId === "excluir_cadastro") return confirmDeleteBrother(row);
}

function onDrawerEscape(event) {
  if (event.key !== "Escape") return;
  if (document.querySelector("#dialog-admin")?.open || document.querySelector("#dialog-novo")?.open) return;
  closeDrawer();
}

function renderOverflowMenu(row) {
  const wrap = el("div", "overflow-menu");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "icon-button overflow-menu__toggle";
  toggle.setAttribute("aria-label", "Mais ações administrativas");
  toggle.setAttribute("aria-haspopup", "true");
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = "⋮";
  const panel = el("div", "overflow-menu__panel");
  panel.hidden = true;
  panel.setAttribute("role", "menu");
  listMenuActions(row, ctx.profile).forEach((action) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `overflow-menu__item${action.id === "excluir_cadastro" ? " is-danger" : ""}`;
    item.setAttribute("role", "menuitem");
    item.textContent = action.label;
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      closeRowMenus();
      if (action.id === "ver_detalhes") openDrawer(row);
      else runFicheAction(row, action.id);
    });
    panel.append(item);
  });
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !wrap.classList.contains("is-open");
    closeRowMenus();
    if (!willOpen) return;
    wrap.classList.add("is-open");
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    const rect = panel.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) wrap.classList.add("is-left");
    if (rect.bottom > window.innerHeight - 8) wrap.classList.add("is-up");
  });
  wrap.append(toggle, panel);
  return wrap;
}

function closeDrawer() {
  drawerToken += 1;
  drawerRow = null;
  document.removeEventListener("keydown", onDrawerEscape);
  document.querySelector("#drawer-root")?.replaceChildren();
  syncOverlayLock();
}

async function openDrawer(row) {
  const token = ++drawerToken;
  drawerRow = row;
  const root = document.querySelector("#drawer-root");
  if (!root) return;
  const mobile = isMobileLayout();
  const backdrop = el("div", `drawer-backdrop${mobile ? " is-fullscreen" : ""}`);
  const drawer = el("aside", `drawer irmaos-drawer${mobile ? " is-fullscreen" : ""}`);
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  const head = el("header", "modal-head irmaos-drawer__head");
  const titleWrap = el("div", "irmaos-drawer__identity");
  const grau = grauLabel(row);
  titleWrap.append(el("h2", "", displayPersonName(row.nome)));
  titleWrap.append(el("p", "irmaos-drawer__cim", grau ? `${cimLabel(row)} · ${grau}` : cimLabel(row)));
  titleWrap.append(situacaoMark(row.situacao));
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = mobile ? "drawer-back" : "icon-button";
  closeBtn.setAttribute("aria-label", "Voltar");
  closeBtn.textContent = mobile ? "← Voltar" : "×";
  closeBtn.addEventListener("click", closeDrawer);
  head.replaceChildren(closeBtn, titleWrap);
  drawer.append(head);
  const body = el("div", "fiche-body");
  renderFicheBody(body, row, []);
  drawer.append(body);
  const actions = el("section", "fiche-actions");
  actions.append(el("h3", "", "Ações"));
  const actionsWrap = el("div", "drawer-actions");
  ficheActions(row, ctx.profile).forEach((action) => {
    if (action.id === "excluir_cadastro") {
      actionsWrap.append(el("div", "fiche-actions__danger-gap", ""));
    }
    actionsWrap.append(ghostButton(
      action.label,
      () => runFicheAction(row, action.id),
      action.id === "excluir_cadastro" ? "button-danger" : "button-secondary",
    ));
  });
  actions.append(actionsWrap);
  drawer.append(actions);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeDrawer();
  });
  document.removeEventListener("keydown", onDrawerEscape);
  document.addEventListener("keydown", onDrawerEscape);
  backdrop.append(drawer);
  root.replaceChildren(backdrop);
  syncOverlayLock();
  closeBtn.focus();

  if (!row.irmao_id) return;
  try {
    const { data } = await staff({ acao: "listar_historico", irmao_id: row.irmao_id });
    if (token !== drawerToken) return;
    renderFicheBody(body, row, data?.historico || []);
  } catch {
    if (token !== drawerToken) return;
  }
}

function renderFicheBody(body, row, historico) {
  body.replaceChildren();
  DRAWER_SECTIONS.forEach((section) => {
    body.append(collapsibleSection(section, ficheSectionContent(section.id, row, historico)));
  });
  const movements = currentMovements(row);
  if (movements.length) {
    body.append(collapsibleSection({ id: "movimentacao", title: "Movimentação atual", open: true }, currentMovementSection(movements)));
  }
}

function collapsibleSection(section, content) {
  const details = document.createElement("details");
  details.className = "fiche-section";
  details.dataset.section = section.id;
  details.open = section.open;
  const summary = document.createElement("summary");
  summary.textContent = section.title;
  details.append(summary, content);
  return details;
}

function ficheSectionContent(id, row, historico) {
  if (id === "institucionais") {
    const wrap = el("div", "fiche-section__body");
    wrap.append(definitionList([
      ["Nome", displayPersonName(row.nome)],
      ["CIM", cimLabel(row)],
      ["E-mail", row.email || "—"],
      ["Nascimento", row.dia_nascimento && row.mes_nascimento ? `${String(row.dia_nascimento).padStart(2, "0")}/${String(row.mes_nascimento).padStart(2, "0")}${row.ano_nascimento ? `/${row.ano_nascimento}` : ""}` : "—"],
      ["Cargo institucional", cargoLabel(row.cargo_institucional)],
    ]));
    wrap.append(cargoEditor(row));
    return wrap;
  }
  if (id === "maconicos") {
    const wrap = el("div", "fiche-section__body");
    wrap.append(definitionList(masonicRows(row)));
    return wrap;
  }
  if (id === "acesso") return accessCard(row);
  if (id === "familia") return familySection(row);
  return timelineSection(row, historico);
}

function masonicRows(row) {
  const rows = [
    ["Situação atual", situacaoDotLabel(row.situacao)],
  ];
  const grau = grauLabel(row);
  if (grau) rows.push(["Grau", grau]);
  rows.push(
    ["Data de iniciação", isoToBr(row.data_iniciacao) || "—"],
    ["Loja de iniciação", row.loja_iniciacao || "—"],
  );
  return rows;
}

function currentMovementSection(movements) {
  const wrap = el("div", "fiche-section__body current-movement");
  movements.forEach((item) => {
    wrap.append(el("h4", "", item.title));
    wrap.append(definitionList(item.rows));
  });
  return wrap;
}

function definitionList(rows) {
  const details = el("dl", "profile-grid");
  rows.forEach(([dt, dd]) => {
    details.append(el("dt", "", dt), el("dd", "", dd || "—"));
  });
  return details;
}

function cargoEditor(row) {
  const wrap = el("div", "cargo-editor");
  if (!row?.irmao_id) return wrap;
  if (!canManageInstitutionalOffices(ctx.profile)) return wrap;
  const current = row.cargo_institucional || "";
  if (row.situacao && row.situacao !== "ativo" && !current) {
    wrap.append(el("p", "muted", "Somente Irmão ativo pode receber cargo institucional."));
    return wrap;
  }
  const field = el("div", "field");
  const label = document.createElement("label");
  label.setAttribute("for", `cargo-${row.irmao_id}`);
  label.textContent = "Definir cargo institucional";
  const select = document.createElement("select");
  select.id = `cargo-${row.irmao_id}`;
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Sem cargo institucional";
  select.append(empty);
  officeSelectOptions(ctx.profile, current).forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    option.disabled = Boolean(item.disabled);
    select.append(option);
  });
  select.value = current;
  field.append(label, select);
  wrap.append(field);
  const actions = el("div", "drawer-actions");
  actions.append(ghostButton("Atribuir cargo", (button) => {
    if (!select.value) {
      showToast({ type: "error", message: "Selecione um cargo institucional." });
      return;
    }
    if (!canAssignCargo(ctx.profile, select.value)) {
      showToast({ type: "error", message: "Não autorizado." });
      return;
    }
    run({ acao: "atribuir_cargo", irmao_id: row.irmao_id, cargo: select.value }, { button, busyLabel: "Salvando..." });
  }));
  if (current && canAssignCargo(ctx.profile, current)) {
    actions.append(ghostButton("Encerrar cargo", (button) => {
      run({ acao: "encerrar_cargo", irmao_id: row.irmao_id }, { button, busyLabel: "Encerrando..." });
    }));
  }
  wrap.append(actions);
  return wrap;
}

function accessCard(row) {
  const card = el("div", "access-card");
  const model = accessCardModel(row);
  card.append(el("h4", "", "Área dos Irmãos"));
  card.append(definitionList(model.rows));
  const timeline = buildAccessTimeline(row);
  if (timeline.length) {
    const list = el("ol", "access-timeline");
    timeline.forEach((item) => {
      const node = el("li", "access-timeline__item");
      node.append(el("strong", "", item.title), el("time", "", formatFicheDate(item.date) || ""));
      list.append(node);
    });
    card.append(list);
  }
  return card;
}

function familySection(row) {
  const groups = familyGroups(cadastro.familiares || [], row.irmao_id);
  const section = el("div", "fiche-section__body");
  if (!row.irmao_id || (!groups.conjuge.length && !groups.filhos.length && !groups.outros.length)) {
    section.append(el("p", "muted", "Nenhum vínculo familiar cadastrado."));
    return section;
  }
  const list = el("ul", "irmaos-family");
  groups.conjuge.forEach((item) => list.append(el("li", "", `Esposa/cunhada: ${displayPersonName(item.nome)}`)));
  groups.filhos.forEach((item) => list.append(el("li", "", `${item.parentesco === "filha" ? "Filha" : "Filho"}: ${displayPersonName(item.nome)}`)));
  groups.outros.forEach((item) => list.append(el("li", "", `${item.parentesco}: ${displayPersonName(item.nome)}`)));
  section.append(list);
  return section;
}

function timelineSection(row, historico) {
  const section = el("div", "fiche-section__body");
  const items = buildBrotherTimeline(row, historico);
  if (!items.length) {
    section.append(el("p", "muted", "Nenhum evento registrado nesta ficha."));
    return section;
  }
  const list = el("ol", "fiche-timeline");
  items.forEach((item) => {
    const node = el("li", "fiche-timeline__item");
    node.append(el("time", "", formatFicheDate(item.date) || "—"), el("strong", "", item.title));
    if (item.ator) node.append(el("p", "muted", item.ator));
    if (item.detalhe) node.append(el("p", "muted", item.detalhe));
    list.append(node);
  });
  section.append(list);
  return section;
}

function handleAdminDialogClosed() {
  accessDialogRow = null;
  if (!document.querySelector("#dialog-novo")?.open) document.body.classList.remove("modal-open");
  document.querySelector("#admin-body")?.replaceChildren();
  resetAdminFooter();
}

function resetAdminFooter() {
  setAdminActions([]);
}

function setAdminActions(buttons = [], { closeLabel = "Cancelar", onCancel } = {}) {
  const foot = document.querySelector("#admin-foot");
  if (!foot) return;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "button button-secondary";
  if (!onCancel) cancel.setAttribute("data-close", "");
  cancel.textContent = closeLabel;
  cancel.addEventListener("click", () => {
    if (typeof onCancel === "function") onCancel();
    else adminDialog.close();
  });
  foot.replaceChildren(cancel, ...buttons);
}

function openAdminDialog({ title, intro, body, actions = [], closeLabel = "Cancelar", onCancel } = {}) {
  document.querySelector("#admin-titulo").textContent = title;
  document.querySelector("#admin-intro").textContent = intro || "";
  const root = document.querySelector("#admin-body");
  root.replaceChildren();
  root.append(body);
  setAdminActions(actions, { closeLabel, onCancel });
  document.body.classList.add("modal-open");
  adminDialog.open();
}

function openMovementDialog(row) {
  const body = el("div", "movement-dialog");
  const options = el("fieldset", "movement-options");
  options.append(el("legend", "", "Registrar movimentação"));
  movementChoices().forEach((choice, index) => {
    const label = el("label", "movement-option");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "tipo-movimentacao";
    radio.value = choice.id;
    radio.id = `mov-tipo-${choice.id}`;
    if (index === 0) radio.checked = false;
    radio.addEventListener("change", () => renderMovementKind(row, choice.id, body, formHost));
    label.append(radio, document.createTextNode(choice.label));
    options.append(label);
  });
  const formHost = el("div", "movement-form");
  body.append(options, formHost);
  openAdminDialog({
    title: "Registrar movimentação",
    intro: displayPersonName(row.nome),
    body,
  });
}

function renderMovementKind(row, kind, body, formHost) {
  document.querySelector("#admin-titulo").textContent = movementTitle(kind);
  formHost.replaceChildren();
  if (kind === "quiet") {
    formHost.append(quietForm(row));
    setAdminActions([]);
    return;
  }
  if (kind === "transfer") {
    formHost.append(transferForm(row));
    setAdminActions([]);
    return;
  }
  if (kind === "afastamento") {
    formHost.append(el("p", "", "A situação maçônica será atualizada para Afastado."));
    setAdminActions([
      ghostButton("Registrar afastamento", () => run({ acao: "afastar_irmao", irmao_id: row.irmao_id }), "button-primary"),
    ]);
    return;
  }
  formHost.append(el("p", "", "O Irmão retornará à situação Ativo."));
  setAdminActions([
    ghostButton("Registrar retorno", () => run({
      acao: row.quiet_placet ? "encerrar_quiet_placet" : "regularizar_situacao",
      irmao_id: row.irmao_id,
    }), "button-primary"),
  ]);
}

function openAccessDialog(row, { step = "status", perfil } = {}) {
  accessDialogRow = row;
  const model = accessDialogModel(row, ctx.profile.perfil, new Date(), irmaos);
  const body = el("div", "access-setup");
  const summary = el("div", "access-setup__summary");
  summary.append(definitionList([
    ["CIM", model.cim || "—"],
    ["E-mail", model.email || "—"],
  ]));
  const select = buildAccessProfileSelect(model);
  if (perfil && [...select.node.options].some((option) => option.value === perfil && !option.disabled)) {
    select.node.value = perfil;
  }
  summary.append(select.field);
  body.append(summary, renderAccessStatusPanel(model, row));

  if (step === "confirm") {
    body.append(renderAccessConfirm(row));
    openAdminDialog({
      title: model.title,
      intro: displayPersonName(row.nome),
      body,
      actions: [ghostButton("Confirmar e enviar", (button) => sendGestaoInvite(row, select.node.value, { button }), "button-primary")],
      closeLabel: "Cancelar",
      onCancel: () => openAccessDialog(row, { perfil: select.node.value }),
    });
    document.querySelector("#admin-foot .button-primary")?.setAttribute("data-initial-focus", "");
    return;
  }

  if (model.primary === "completar_cadastro") {
    openAdminDialog({
      title: model.title,
      intro: displayPersonName(row.nome),
      body,
      actions: [ghostButton("Completar cadastro", () => {
        adminDialog.close();
        openEditBrother(row, {
          focusAccess: true,
          highlight: model.missing.includes("CIM") && model.missing.includes("E-mail")
            ? ["cim", "email"]
            : model.missing.includes("CIM") ? ["cim"]
              : model.missing.includes("E-mail") ? ["email"]
                : [],
        });
      }, "button-primary")],
    });
    return;
  }

  const actions = [];
  if (model.primary === "liberar_acesso") {
    actions.push(ghostButton("Liberar acesso", () => openAccessDialog(row, { step: "confirm", perfil: select.node.value }), "button-primary"));
  }
  if (model.primary === "reenviar_convite") {
    actions.push(ghostButton("Reenviar convite", (button) => sendGestaoInvite(row, select.node.value, { button, resend: true }), "button-primary"));
  }
  if (model.primary === "enviar_novo_convite") {
    actions.push(ghostButton("Enviar novo convite", (button) => sendGestaoInvite(row, select.node.value, { button }), "button-primary"));
  }
  if (model.id === "ativa") {
    if (model.canChangeProfile) actions.push(ghostButton("Alterar perfil", () => saveAccessProfile(row, select.node.value)));
    if (model.canBlock) actions.push(ghostButton("Bloquear acesso", () => run({ acao: "suspender_acesso", acesso_id: row.acesso_id }, { confirm: true, keepAccessDialog: true })));
    if (model.canReset) actions.push(ghostButton("Redefinir acesso", (button) => sendGestaoInvite(row, select.node.value, { button, reset: true })));
  }
  if (model.canUnblock) {
    actions.push(ghostButton("Desbloquear acesso", () => run({
      acao: row.acesso_ativo === false ? "reativar" : "desbloquear",
      acesso_id: row.acesso_id,
      id: row.acesso_id,
    }, { confirm: true, keepAccessDialog: true }), "button-primary"));
  }
  if (model.canRevoke) {
    actions.push(ghostButton("Revogar acesso", () => run({ acao: "revogar", id: row.acesso_id }, { confirm: true, keepAccessDialog: true }), "button-danger"));
  }

  openAdminDialog({
    title: model.title,
    intro: displayPersonName(row.nome),
    body,
    actions,
    closeLabel: model.closeLabel,
  });
}

function buildAccessProfileSelect(model) {
  const field = el("div", "field access-setup__perfil");
  const label = document.createElement("label");
  label.setAttribute("for", "admin-perfil");
  label.textContent = "Perfil de acesso";
  const select = document.createElement("select");
  select.id = "admin-perfil";
  select.setAttribute("data-initial-focus", "");
  (model.profileOptions || []).forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    option.disabled = Boolean(item.disabled);
    select.append(option);
  });
  const options = model.profileOptions || [];
  const selectable = options.filter((item) => !item.disabled).map((item) => item.id);
  select.value = options.some((item) => item.id === model.perfil) ? model.perfil : (selectable[0] || "irmao");
  if (model.id === "incomplete" || options.some((item) => item.id === model.perfil && item.disabled)) {
    select.disabled = true;
  }
  const locked = model.profileOptions.find((item) => item.disabled && item.hint);
  field.append(label, select);
  if (locked) field.append(el("p", "field-hint", locked.hint));
  return { field, node: select };
}

function renderAccessStatusPanel(model, row) {
  const panel = model.panel || {};
  const node = el("section", `access-status-panel is-${panel.tone || "neutral"}`);
  node.setAttribute("aria-live", "polite");
  const heading = el("div", "access-status-panel__head");
  heading.append(el("span", "access-status-panel__indicator", ""), el("p", "access-status-panel__label", panel.label || "Status do acesso"));
  node.append(heading);
  node.append(el("h3", "access-status-panel__title", panel.title || model.access?.label || ""));
  if (panel.description) node.append(el("p", "access-status-panel__desc", panel.description));
  if (panel.detail) node.append(el("p", "access-status-panel__detail", panel.detail));
  if (panel.facts?.length) {
    const facts = el("dl", "access-status-panel__facts");
    panel.facts.forEach((fact) => {
      facts.append(el("dt", "", fact.label), el("dd", "", fact.value));
    });
    node.append(facts);
  }
  if (panel.blockers?.length && (model.id === "incomplete" || model.id === "pronta" || model.id === "revogada")) {
    const box = el("div", "access-setup__blocked");
    box.append(el("p", "", "Não é possível liberar o acesso."));
    box.append(el("p", "", "Complete os seguintes dados:"));
    const list = el("ul", "access-setup__missing");
    panel.blockers.forEach((item) => list.append(el("li", "", item.label)));
    box.append(list);
    node.append(box);
  }
  if (model.canCancelInvite) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "access-setup__quiet";
    cancel.textContent = "Cancelar convite";
    cancel.addEventListener("click", () => run({ acao: "cancelar_convite", id: row.acesso_id }, { keepAccessDialog: true }));
    node.append(cancel);
  }
  return node;
}

function renderAccessConfirm(row) {
  const box = el("div", "access-confirm");
  box.setAttribute("role", "region");
  box.setAttribute("aria-live", "polite");
  box.append(el("p", "access-confirm__title", `Liberar acesso para ${displayPersonName(row.nome)}?`));
  box.append(el("p", "", "O convite será enviado para:"));
  box.append(el("p", "access-confirm__email", row.email || ""));
  box.append(el("p", "", "O Irmão deverá confirmar sua CIM e criar uma senha pessoal."));
  return box;
}

function sendGestaoInvite(row, perfil, { reset = false, resend = false, button } = {}) {
  const payload = reset && row.acesso_id
    ? { acao: "reenviar_convite", id: row.acesso_id }
    : resend && row.acesso_id
      ? { acao: "reenviar_convite", id: row.acesso_id }
      : {
        acao: "convidar_gestao",
        irmao_id: row.irmao_id,
        perfil: perfil || row.perfil || "irmao",
      };
  return run(payload, {
    button,
    busyLabel: "Enviando convite...",
    keepAccessDialog: true,
  });
}

async function saveAccessProfile(row, perfil) {
  const resolved = assignableProfiles(ctx.profile.perfil);
  if (!resolved.includes(perfil)) {
    feedback(false, "Perfil não autorizado.");
    return;
  }
  if (ctx.profile.perfil === "administrador" && row.acesso_id) {
    return run({ acao: "alterar_perfil", id: row.acesso_id, perfil });
  }
  return run({
    acao: "salvar_gestao_irmao",
    irmao_id: row.irmao_id,
    nome: row.nome,
    cim: row.cim || "",
    email: row.email || "",
    perfil,
    situacao: situacaoAllowed(row.situacao),
    dia_nascimento: row.dia_nascimento,
    mes_nascimento: row.mes_nascimento,
    ano_nascimento: row.ano_nascimento,
    data_iniciacao: row.data_iniciacao,
    loja_iniciacao: row.loja_iniciacao,
  });
}

function ghostButton(label, onClick, extraClass = "button-secondary") {
  const node = document.createElement("button");
  node.type = "button";
  node.className = `button ${extraClass}`;
  node.textContent = label;
  node.addEventListener("click", (event) => onClick(event.currentTarget));
  return node;
}

function fieldBlock(id, label, control, { required = false } = {}) {
  const field = el("div", "field");
  const node = document.createElement("label");
  node.setAttribute("for", id);
  node.textContent = label;
  control.id = id;
  if (required) control.setAttribute("aria-required", "true");
  const error = el("p", "field-error");
  error.id = `erro-${id}`;
  error.hidden = true;
  control.setAttribute("aria-describedby", error.id);
  field.append(node, control, error);
  return field;
}

function showFormFieldErrors(form, errors) {
  form.querySelectorAll(".field-error").forEach((node) => {
    const key = node.id.replace(/^erro-mov-/, "").replace(/^erro-/, "");
    const message = errors[key] || errors[node.dataset.field] || "";
    node.textContent = message;
    node.hidden = !message;
  });
  Object.entries(errors).forEach(([key, message]) => {
    const input = form.querySelector(`[name="${key}"]`);
    input?.setAttribute("aria-invalid", String(Boolean(message)));
  });
}

function quietForm(row) {
  const form = document.createElement("form");
  form.className = "form-grid";
  const inicio = document.createElement("input");
  inicio.name = "inicio_em";
  inicio.placeholder = "dd/mm/aaaa";
  const termino = document.createElement("input");
  termino.name = "previsao_termino";
  termino.placeholder = "dd/mm/aaaa";
  const motivo = document.createElement("textarea");
  motivo.name = "motivo";
  motivo.rows = 3;
  const observacao = document.createElement("textarea");
  observacao.name = "observacao";
  observacao.rows = 2;
  form.append(
    fieldBlock("mov-inicio", "Início", inicio, { required: true }),
    fieldBlock("mov-termino", "Término previsto", termino, { required: true }),
    fieldBlock("mov-motivo", "Motivo", motivo, { required: true }),
    fieldBlock("mov-observacao", "Observação administrativa", observacao),
  );
  const check = el("label", "check");
  const suspend = document.createElement("input");
  suspend.type = "checkbox";
  suspend.name = "suspender_acesso";
  check.append(suspend, document.createTextNode(" Suspender acesso durante o afastamento"));
  const actions = el("div", "form-actions");
  const submit = document.createElement("button");
  submit.className = "button button-primary";
  submit.type = "submit";
  submit.textContent = "Registrar Quiet Placet";
  actions.append(submit);
  form.append(check, actions);
  form.querySelector("#erro-mov-inicio").dataset.field = "inicio_em";
  form.querySelector("#erro-mov-termino").dataset.field = "previsao_termino";
  form.querySelector("#erro-mov-motivo").dataset.field = "motivo";
  bindBrDatePicker(inicio);
  bindBrDatePicker(termino);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = {
      inicio_em: inicio.value,
      previsao_termino: termino.value,
      motivo: motivo.value,
    };
    const errors = validateQuietPlacet(values);
    showFormFieldErrors(form, {
      inicio_em: errors.inicio_em,
      previsao_termino: errors.previsao_termino,
      motivo: errors.motivo,
    });
    if (Object.keys(errors).length) return;
    await run({
      acao: "quiet_placet",
      irmao_id: row.irmao_id,
      inicio_em: readIsoDate(inicio),
      previsao_termino: readIsoDate(termino),
      motivo: motivo.value,
      observacao: observacao.value,
      suspender_acesso: suspend.checked,
    });
  });
  return form;
}

function transferForm(row) {
  const form = document.createElement("form");
  form.className = "form-grid";
  const loja = document.createElement("input");
  loja.name = "loja_destino";
  const oriente = document.createElement("input");
  oriente.name = "oriente_destino";
  const data = document.createElement("input");
  data.name = "data_solicitacao";
  data.placeholder = "dd/mm/aaaa";
  const observacao = document.createElement("textarea");
  observacao.name = "observacao";
  observacao.rows = 2;
  form.append(
    fieldBlock("mov-loja", "Loja de destino", loja, { required: true }),
    fieldBlock("mov-oriente", "Oriente", oriente, { required: true }),
    fieldBlock("mov-data", "Data da solicitação", data, { required: true }),
    fieldBlock("mov-obs-transfer", "Observação", observacao),
  );
  form.querySelector("#erro-mov-loja").dataset.field = "loja_destino";
  form.querySelector("#erro-mov-oriente").dataset.field = "oriente_destino";
  form.querySelector("#erro-mov-data").dataset.field = "data_solicitacao";
  const actions = el("div", "form-actions");
  const submit = document.createElement("button");
  submit.className = "button button-primary";
  submit.type = "submit";
  submit.textContent = "Registrar transferência";
  actions.append(submit);
  form.append(actions);
  bindBrDatePicker(data);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = {
      loja_destino: loja.value,
      oriente_destino: oriente.value,
      data_solicitacao: data.value,
    };
    const errors = validateTransferencia(values);
    showFormFieldErrors(form, errors);
    if (Object.keys(errors).length) return;
    await run({
      acao: "transferencia",
      irmao_id: row.irmao_id,
      data_solicitacao: readIsoDate(data),
      loja_destino: loja.value,
      oriente_destino: oriente.value,
      observacao: observacao.value,
    });
  });
  return form;
}

async function confirmDeleteBrother(row) {
  if (!canDeleteBrother(row, ctx.profile)) {
    feedback(false, "Cadastro não pode ser excluído.");
    return;
  }
  const nome = displayPersonName(row.nome);
  if (!window.confirm(`Excluir o cadastro de ${nome}? Esta ação não pode ser desfeita.`)) return;
  await run({ acao: "excluir_irmao", irmao_id: row.irmao_id });
}

async function run(payload, confirmAction) {
  const options = confirmAction && typeof confirmAction === "object" ? confirmAction : { confirm: Boolean(confirmAction) };
  if (options.confirm && !window.confirm("Confirmar esta ação administrativa?")) return;
  if (options.button && !beginSubmit(options.button, options.busyLabel || "Enviando convite...")) return;
  if (options.button) {
    document.querySelectorAll("#admin-foot button, #admin-body button").forEach((node) => {
      node.disabled = true;
    });
  }
  try {
    const { data } = await staff(payload);
    const ok = Boolean(data?.ok);
    feedback(ok, ok ? actionToastMessage(payload.acao, true) : (data?.error || "Não foi possível concluir."));
    if (ok && payload.acao === "excluir_irmao") {
      if (adminDialog?.isOpen()) adminDialog.close();
      closeDrawer();
      await refresh();
      return;
    }
    const keepDrawer = Boolean(document.querySelector("#drawer-root")?.children.length);
    const keepId = drawerRow?.irmao_id || drawerRow?.id;
    const keepAccess = Boolean(options.keepAccessDialog && accessDialogRow);
    const accessId = accessDialogRow?.irmao_id || accessDialogRow?.id;
    if (ok) {
      await refresh();
      if (keepDrawer && keepId) {
        const nextDrawer = irmaos.find((row) => row.irmao_id === keepId || row.id === keepId);
        if (nextDrawer) openDrawer(nextDrawer);
      }
      if (keepAccess && accessId) {
        const nextAccess = irmaos.find((row) => row.irmao_id === accessId || row.id === accessId);
        if (nextAccess) {
          openAccessDialog(nextAccess);
          return;
        }
      }
    }
    if (adminDialog?.isOpen() && !keepAccess) adminDialog.close();
  } finally {
    if (options.button) {
      endSubmit(options.button);
      document.querySelectorAll("#admin-foot button, #admin-body button").forEach((node) => {
        node.disabled = false;
      });
    }
  }
}

function fillProfileOptions(actorPerfil) {
  const select = document.querySelector("#novo-perfil");
  if (!select) return;
  const current = select.value || "irmao";
  select.replaceChildren(...assignableProfiles(actorPerfil).map((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = MODAL_PROFILE_LABELS[id];
    return option;
  }));
  select.value = assignableProfiles(actorPerfil).includes(current) ? current : "irmao";
}

function brotherFormValues() {
  return {
    nome: document.querySelector("#novo-nome").value,
    nascimento: document.querySelector("#novo-nascimento").value,
    iniciacao: document.querySelector("#novo-iniciacao").value,
    cim: document.querySelector("#novo-cim").value,
    email: document.querySelector("#novo-email").value,
    perfil: document.querySelector("#novo-perfil").value,
  };
}

function showFieldErrors(errors) {
  ["nome", "nascimento", "iniciacao", "cim", "email", "perfil"].forEach((key) => {
    const node = document.querySelector(`#erro-novo-${key}`);
    const field = document.querySelector(`#novo-${key}`);
    const message = errors[key] || "";
    if (!node || !field) return;
    node.textContent = message;
    node.hidden = !message;
    field.setAttribute("aria-invalid", String(Boolean(message)));
    if (message) field.setAttribute("aria-describedby", node.id);
  });
}

function resetBrotherForm() {
  const form = document.querySelector("#form-novo");
  if (!form) return;
  form.reset();
  const id = document.querySelector("#novo-id");
  const title = document.querySelector("#novo-titulo");
  const save = document.querySelector("#novo-salvar");
  const situacao = document.querySelector("#novo-situacao");
  const loja = document.querySelector("#novo-loja");
  const perfil = document.querySelector("#novo-perfil");
  if (id) id.value = "";
  if (title) title.textContent = "Novo Irmão";
  if (save) save.textContent = "Salvar Irmão";
  if (situacao) situacao.value = "ativo";
  if (loja) loja.value = DEFAULT_LOJA_INICIACAO;
  if (perfil) perfil.value = "irmao";
  ["#novo-cim", "#novo-email"].forEach((id) => {
    document.querySelector(id)?.classList.remove("is-pending");
    document.querySelector(id)?.closest(".field")?.classList.remove("is-pending");
  });
  showFieldErrors({});
}

function initializeNewMemberModal() {
  const modal = document.querySelector("#dialog-novo");
  if (modal?.open) modal.close();
  document.body.classList.remove("modal-open");
}

function openNewMemberModal() {
  resetBrotherForm();
  document.body.classList.add("modal-open");
  novoDialog.open(document.querySelector("#novo-irmao"));
}

function closeNewMemberModal() {
  const modal = document.querySelector("#dialog-novo");
  if (modal?.open) modal.close();
  else handleNewMemberModalClosed();
}

function handleNewMemberModalClosed() {
  document.body.classList.remove("modal-open");
  resetBrotherForm();
  const button = document.querySelector("#novo-salvar");
  if (button?.disabled) endSubmit(button);
}

function openEditBrother(row, { focusAccess = false, highlight = [] } = {}) {
  const current = irmaos.find((item) => item.irmao_id === row.irmao_id || item.id === row.id) || row;
  resetBrotherForm();
  document.querySelector("#novo-id").value = current.irmao_id || "";
  document.querySelector("#novo-titulo").textContent = "Editar Irmão";
  document.querySelector("#novo-nome").value = current.nome || "";
  document.querySelector("#novo-nascimento").value = birthInputFromParts(current);
  document.querySelector("#novo-iniciacao").value = isoToBr(current.data_iniciacao);
  document.querySelector("#novo-loja").value = current.loja_iniciacao || DEFAULT_LOJA_INICIACAO;
  document.querySelector("#novo-situacao").value = situacaoAllowed(current.situacao);
  document.querySelector("#novo-email").value = current.email || "";
  document.querySelector("#novo-cim").value = current.cim || "";
  const allowed = assignableProfiles(ctx.profile.perfil);
  document.querySelector("#novo-perfil").value = allowed.includes(current.perfil) ? current.perfil : "irmao";
  highlight.forEach((key) => {
    const field = document.querySelector(`#novo-${key}`);
    field?.classList.add("is-pending");
    field?.closest(".field")?.classList.add("is-pending");
  });
  document.body.classList.add("modal-open");
  novoDialog.open();
  if (focusAccess) {
    document.querySelector("#secao-acesso")?.scrollIntoView({ block: "start" });
    const first = highlight[0] || "cim";
    document.querySelector(`#novo-${first}`)?.focus();
  }
}

async function saveNew(event) {
  event.preventDefault();
  const button = document.querySelector("#novo-salvar");
  const editingId = document.querySelector("#novo-id").value;
  const errors = validateBrotherForm(brotherFormValues(), { brothers: irmaos, editingId, actorPerfil: ctx.profile.perfil });
  showFieldErrors(errors);
  if (Object.keys(errors).length) return;
  if (!beginSubmit(button)) return;
  try {
    const birth = parseFlexibleBrDate(document.querySelector("#novo-nascimento").value);
    const { data } = await staff({
      acao: "salvar_gestao_irmao",
      irmao_id: editingId || undefined,
      nome: document.querySelector("#novo-nome").value,
      cim: document.querySelector("#novo-cim").value,
      email: document.querySelector("#novo-email").value,
      perfil: document.querySelector("#novo-perfil").value,
      conceder_acesso: false,
      dia_nascimento: birth.day || null,
      mes_nascimento: birth.month || null,
      ano_nascimento: birth.year || null,
      data_iniciacao: readIsoDate(document.querySelector("#novo-iniciacao")) || null,
      loja_iniciacao: document.querySelector("#novo-loja").value,
      situacao: situacaoAllowed(document.querySelector("#novo-situacao").value),
    });
    if (!data?.ok) {
      feedback(false, mapSaveError(data?.error));
      return;
    }
    highlightedId = data.irmao_id || "";
    event.target.reset();
    closeNewMemberModal();
    const keepOpen = Boolean(document.querySelector("#drawer-root")?.children.length);
    await refresh();
    feedback(true, editingId ? "Cadastro atualizado com sucesso." : "Irmão cadastrado com sucesso.");
    if (keepOpen && (editingId || highlightedId)) {
      const next = irmaos.find((row) => row.irmao_id === editingId || row.irmao_id === highlightedId || row.id === editingId);
      if (next) openDrawer(next);
    }
    setTimeout(() => {
      highlightedId = "";
      document.querySelector(".irmaos-row.is-highlight")?.classList.remove("is-highlight");
    }, 2400);
  } finally {
    endSubmit(button);
  }
}

function syncConjuge() {
  if (!ctx.selects?.irmaoSelect || !ctx.selects?.conjugeSelect) return;
  const irmaoId = ctx.selects.irmaoSelect.value();
  const hint = document.querySelector("#casamento-hint");
  const options = eligibleConjuges({ ...cadastro, irmaoId });
  ctx.selects.conjugeSelect.setOptions(options.map((row) => ({ value: row.id, nome: row.nome })));
  if (hint) hint.textContent = irmaoId && !options.length ? "Nenhuma cunhada elegível foi encontrada para este Irmão." : "";
}

function renderFamiliares() {
  const root = document.querySelector("#familiares-lista");
  const rows = cadastro.familiares || [];
  if (!rows.length) return showEmpty(root, "Nenhum familiar cadastrado.", { compact: true });
  root.replaceChildren();
  rows.forEach((row) => {
    const card = el("article", "record-row record-row-simple");
    const main = el("div", "record-main");
    main.append(el("strong", "person-name", displayPersonName(row.nome)), el("p", "muted", `${row.parentesco} · ${displayPersonName(row.irmao_nome || "")}`));
    card.append(main);
    root.append(card);
  });
}

function renderCasamentos() {
  const root = document.querySelector("#casamentos-lista");
  const rows = cadastro.casamentos || [];
  if (!rows.length) return showEmpty(root, "Nenhum casamento cadastrado.", { compact: true });
  root.replaceChildren();
  rows.forEach((row) => {
    const card = el("article", "record-row record-row-simple");
    const main = el("div", "record-main");
    main.append(el("strong", "person-name", displayPersonName(row.irmao_nome || "")), el("p", "muted", isoToBr(row.data_casamento)));
    card.append(main);
    root.append(card);
  });
}

function renderEventos() {
  const root = document.querySelector("#eventos-lista");
  if (!eventos.length) return showEmpty(root, "Nenhum evento interno cadastrado.", { compact: true });
  root.replaceChildren();
  eventos.forEach((row) => {
    const card = el("article", "agenda-event-card record-row");
    const main = el("div", "record-main agenda-event-card__main");
    main.append(
      el("strong", "agenda-event-card__title", row.titulo),
      el("p", "muted agenda-event-card__when", formatDateTimeBr(row.inicia_em)),
    );
    const meta = el("div", "record-meta agenda-event-card__meta");
    meta.append(el("span", `status-pill${row.ativo === false ? " is-inactive" : ""}`, row.ativo === false ? "Cancelada" : (EVENT_TYPE_LABELS[row.tipo_evento] || row.tipo_evento)));
    if (row.gerado_automaticamente) meta.append(el("p", "muted agenda-event-card__origin", "Gerada automaticamente"));
    const actions = el("div", "record-actions agenda-event-card__actions");
    actions.append(ghostButton("Editar", () => fillEvento(row)));
    if (row.ativo !== false) {
      actions.append(ghostButton("Cancelar sessão", () => run({ acao: "cancelar_evento", id: row.id }, true), "button-danger"));
    }
    card.append(main, meta, actions);
    root.append(card);
  });
}

function fillEvento(row) {
  const parts = splitDateTime(row.inicia_em);
  document.querySelector("#evento-id").value = row.id;
  document.querySelector("#evento-titulo").value = row.titulo || "";
  document.querySelector("#evento-tipo").value = row.tipo_evento || "outro";
  document.querySelector("#evento-data").value = parts.date;
  document.querySelector("#evento-hora").value = parts.time;
  document.querySelector("#evento-descricao").value = row.descricao || "";
  document.querySelector("#evento-presenca").checked = Boolean(row.presenca_obrigatoria);
  document.querySelector("#evento-destaque").checked = Boolean(row.destaque);
  openTab("eventos");
}

function renderComunicados() {
  const root = document.querySelector("#comunicados-lista");
  if (!comunicados.length) return showEmpty(root, "Nenhum comunicado cadastrado.", { compact: true });
  root.replaceChildren();
  comunicados.forEach((row) => {
    const status = noticeDisplayStatus(row);
    const card = el("article", "notice-card");
    const badges = el("div", "badge-row");
    badges.append(el("span", `status-pill status-${status}`, NOTICE_STATUS_LABELS[status]));
    badges.append(el("span", "chip", NOTICE_TYPE_LABELS[row.tipo] || row.tipo || "Informativo"));
    if (row.destaque) badges.append(el("span", "chip chip-gold", "Destaque"));
    if (row.presenca_obrigatoria) badges.append(el("span", "chip", "Presença obrigatória"));
    const actions = el("div", "record-actions");
    actions.append(ghostButton("Editar", () => fillComunicado(row)));
    if (row.publicado !== false && status !== "desativado") {
      actions.append(ghostButton("Desativar comunicado", () => deactivateComunicado(row), "button-danger"));
    }
    card.append(
      el("strong", "", row.titulo),
      badges,
      el("p", "notice-body", truncateText(row.corpo, 280)),
      el("p", "muted", noticePeriodLabel(row) ? `Exibição: ${noticePeriodLabel(row)}` : "Sem período definido"),
      actions,
    );
    root.append(card);
  });
}

function fillComunicado(row) {
  const start = splitDateTime(row.inicio_exibicao);
  const end = splitDateTime(row.fim_exibicao);
  document.querySelector("#comunicado-id").value = row.id;
  document.querySelector("#comunicado-titulo").value = row.titulo || "";
  document.querySelector("#comunicado-tipo").value = row.tipo || "informativo";
  document.querySelector("#comunicado-corpo").value = row.corpo || "";
  document.querySelector("#comunicado-inicio-data").value = start.date;
  document.querySelector("#comunicado-inicio-hora").value = start.time;
  document.querySelector("#comunicado-fim-data").value = end.date;
  document.querySelector("#comunicado-fim-hora").value = end.time;
  document.querySelector("#comunicado-destaque").checked = Boolean(row.destaque);
  document.querySelector("#comunicado-presenca").checked = Boolean(row.presenca_obrigatoria);
  document.querySelector("#comunicado-salvar").textContent = "Salvar comunicado";
  openTab("comunicados");
}

async function deactivateComunicado(row) {
  await run({
    acao: "salvar_comunicado",
    id: row.id,
    titulo: row.titulo,
    corpo: row.corpo,
    tipo: row.tipo,
    inicio_exibicao: row.inicio_exibicao,
    fim_exibicao: row.fim_exibicao,
    destaque: row.destaque,
    presenca_obrigatoria: row.presenca_obrigatoria,
    publicado: false,
  }, true);
}

async function submitForm(event, button, task, successMessage) {
  event.preventDefault();
  const submitButton = button || event.submitter || event.target.querySelector("[type=submit]");
  if (!beginSubmit(submitButton)) return;
  try {
    const { data } = await task();
    if (!data?.ok) {
      feedback(false, data?.error || "Não foi possível salvar.");
      return;
    }
    event.target.reset();
    event.target.querySelectorAll("input[type=hidden]").forEach((input) => { input.value = ""; });
    await refresh();
    feedback(true, successMessage);
  } finally {
    endSubmit(submitButton);
  }
}

async function saveFamiliar(event) {
  await submitForm(event, event.submitter, () => staff({
    acao: "salvar_familiar",
    id: document.querySelector("#familiar-id").value || undefined,
    irmao_id: ctx.selects.familiarIrmaoSelect.value(),
    nome: document.querySelector("#familiar-nome").value,
    parentesco: document.querySelector("#familiar-parentesco").value,
    dia_nascimento: Number(document.querySelector("#familiar-dia").value) || null,
    mes_nascimento: Number(document.querySelector("#familiar-mes").value) || null,
    autorizado_exibicao: document.querySelector("#familiar-exibir").checked,
  }), "Familiar salvo.");
}

async function saveCasamento(event) {
  await submitForm(event, event.submitter, () => staff({
    acao: "salvar_casamento",
    irmao_id: ctx.selects.irmaoSelect.value(),
    conjuge_id: ctx.selects.conjugeSelect.value() || null,
    data_casamento: readIsoDate(document.querySelector("#casamento-data")),
    autorizado_exibicao: document.querySelector("#casamento-exibir").checked,
  }), "Casamento salvo.");
}

async function saveEvento(event) {
  await submitForm(event, event.submitter, () => staff({
    acao: "salvar_evento",
    id: document.querySelector("#evento-id").value || undefined,
    titulo: document.querySelector("#evento-titulo").value,
    tipo_evento: document.querySelector("#evento-tipo").value,
    inicia_em: joinDateTime(document.querySelector("#evento-data").value, document.querySelector("#evento-hora").value),
    descricao: document.querySelector("#evento-descricao").value,
    presenca_obrigatoria: document.querySelector("#evento-presenca").checked,
    destaque: document.querySelector("#evento-destaque").checked,
  }), "Evento salvo.");
}

async function saveComunicado(event) {
  const button = document.querySelector("#comunicado-salvar");
  await submitForm(event, button, () => staff({
    acao: "salvar_comunicado",
    id: document.querySelector("#comunicado-id").value || undefined,
    titulo: document.querySelector("#comunicado-titulo").value,
    tipo: document.querySelector("#comunicado-tipo").value,
    corpo: document.querySelector("#comunicado-corpo").value,
    inicio_exibicao: joinDateTime(document.querySelector("#comunicado-inicio-data").value, document.querySelector("#comunicado-inicio-hora").value) || null,
    fim_exibicao: joinDateTime(document.querySelector("#comunicado-fim-data").value, document.querySelector("#comunicado-fim-hora").value) || null,
    destaque: document.querySelector("#comunicado-destaque").checked,
    presenca_obrigatoria: document.querySelector("#comunicado-presenca").checked,
    prioridade: document.querySelector("#comunicado-tipo").value === "urgente" ? 100 : 0,
  }), "Comunicado publicado com sucesso.");
  button.textContent = "Publicar comunicado";
}

async function importCsv() {
  const button = document.querySelector("#importar");
  if (!beginSubmit(button, "Importando...")) return;
  try {
    const itens = document.querySelector("#csv").value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [cim, tipo, mes, dia, nome] = line.split(";");
      return { cim, tipo, mes: Number(mes), dia: Number(dia), nome_exibicao: nome };
    });
    const { data } = await staff({ acao: "importar_celebracoes", itens });
    feedback(Boolean(data?.ok), data?.ok ? `${data.importados} registro(s) importado(s).` : "Não foi possível importar.");
  } finally {
    endSubmit(button);
  }
}

