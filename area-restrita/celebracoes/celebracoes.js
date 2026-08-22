import { bootPage } from "../js/page.js";
import { invokeFunction } from "../js/client.js";
import { el, showEmpty, showError, showSkeleton } from "../js/ui-state.js";
import { bindBrDateInput, isoToBr, readIsoDate } from "../js/dates-br.js";
import { createSearchSelect } from "../js/search-select.js";
import { eligibleConjuges, eligibleIrmaos } from "../js/casamento-elegibilidade.js";
import { displayPersonName } from "../js/vinculo.js";

let cadastro = { irmaos: [], familiares: [], casamentos: [] };
let irmaoSelect;
let conjugeSelect;
let familiarIrmaoSelect;

await bootPage("Cadastro institucional", async (ctx) => {
  document.querySelector("#tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    document.querySelectorAll("[data-tab]").forEach((node) => node.setAttribute("aria-selected", String(node === button)));
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== button.dataset.tab;
    });
  });
  document.querySelector("#irmao-form").addEventListener("submit", (event) => saveIrmao(event, ctx));
  document.querySelector("#familiar-form").addEventListener("submit", (event) => saveFamiliar(event, ctx));
  document.querySelector("#casamento-form").addEventListener("submit", (event) => saveCasamento(event, ctx));
  document.querySelector("#importar")?.addEventListener("click", () => importCsv(ctx));
  document.querySelector("#cadastrar-familiar")?.addEventListener("click", () => {
    document.querySelector("[data-tab='familiares']")?.click();
  });
  bindBrDateInput(document.querySelector("#irmao-iniciacao"));
  bindBrDateInput(document.querySelector("#casamento-data"));
  irmaoSelect = createSearchSelect({
    input: document.querySelector("#casamento-irmao"),
    list: document.querySelector("#casamento-irmao-list"),
    placeholder: "Buscar Irmão...",
  });
  conjugeSelect = createSearchSelect({
    input: document.querySelector("#casamento-conjuge"),
    list: document.querySelector("#casamento-conjuge-list"),
    placeholder: "Buscar cunhada elegível...",
    emptyText: "Nenhuma cunhada elegível foi encontrada para este Irmão.",
  });
  familiarIrmaoSelect = createSearchSelect({
    input: document.querySelector("#familiar-irmao"),
    list: document.querySelector("#familiar-irmao-list"),
    placeholder: "Buscar Irmão...",
  });
  document.querySelector("#casamento-irmao").addEventListener("change", syncConjugeOptions);
  await refresh(ctx);
}, { staff: true });

async function refresh(ctx) {
  const { data } = await staff(ctx, { acao: "listar_cadastro" });
  if (!data?.ok) return;
  cadastro = data;
  syncSelects();
  await Promise.all([loadIrmaos(ctx, data), loadFamiliares(ctx, data), loadCasamentos(ctx, data)]);
}

async function staff(ctx, body) {
  return invokeFunction("gerenciar-irmao", body, ctx.session.access_token);
}

function syncSelects() {
  familiarIrmaoSelect.setOptions((cadastro.irmaos || []).filter((row) => row.ativo !== false).map((row) => ({
    value: row.id,
    nome: row.nome,
  })));
  irmaoSelect.setOptions(eligibleIrmaos(cadastro).map((row) => ({ value: row.id, nome: row.nome })));
  syncConjugeOptions();
}

function syncConjugeOptions() {
  const irmaoId = irmaoSelect.value();
  const hint = document.querySelector("#casamento-hint");
  const options = eligibleConjuges({ ...cadastro, irmaoId });
  conjugeSelect.setOptions(options.map((row) => ({ value: row.id, nome: row.nome })));
  if (!irmaoId) {
    hint.textContent = "";
    return;
  }
  if (!options.length) {
    hint.textContent = "Nenhuma cunhada elegível foi encontrada para este Irmão.";
    return;
  }
  hint.textContent = "";
  if (options.length === 1) conjugeSelect.setValue(options[0].id);
}

function setStatus(id, ok, text) {
  const node = document.querySelector(id);
  node.classList.toggle("is-ok", ok);
  node.textContent = text;
}

async function loadIrmaos(ctx, data) {
  const root = document.querySelector("#irmaos-lista");
  const irmaos = data.irmaos || [];
  if (!irmaos.length) {
    showEmpty(root, "Nenhum Irmão institucional cadastrado.");
    return;
  }
  root.replaceChildren();
  irmaos.forEach((row) => {
    const card = el("article", "member-card");
    const body = el("div");
    body.append(
      el("strong", "person-name", displayPersonName(row.nome)),
      el("p", "muted", `${row.dia_nascimento || "—"}/${row.mes_nascimento || "—"} · iniciação ${isoToBr(row.data_iniciacao) || "—"}`),
    );
    const actions = el("div");
    actions.append(
      button("Editar", () => fillIrmao(row)),
      button(row.ativo ? "Desativar" : "Reativar", async () => {
        await staff(ctx, { acao: "salvar_irmao", id: row.id, ativo: !row.ativo, nome: row.nome });
        await refresh(ctx);
      }),
    );
    card.append(body, actions);
    root.append(card);
  });
}

async function loadFamiliares(ctx, data) {
  const root = document.querySelector("#familiares-lista");
  const rows = data.familiares || [];
  if (!rows.length) {
    showEmpty(root, "Nenhum familiar cadastrado.");
    return;
  }
  root.replaceChildren();
  rows.forEach((row) => {
    const card = el("article", "member-card");
    const body = el("div");
    body.append(
      el("strong", "person-name", displayPersonName(row.nome)),
      el("p", "muted", `${parentescoLabel(row.parentesco)} · ${displayPersonName(row.irmao_nome || "")}`),
    );
    const actions = el("div");
    actions.append(
      button("Editar", () => fillFamiliar(row)),
      button(row.autorizado_exibicao ? "Ocultar" : "Autorizar", async () => {
        await staff(ctx, { acao: "salvar_familiar", id: row.id, irmao_id: row.irmao_id, nome: row.nome, parentesco: row.parentesco, autorizado_exibicao: !row.autorizado_exibicao });
        await refresh(ctx);
      }),
    );
    card.append(body, actions);
    root.append(card);
  });
}

async function loadCasamentos(ctx, data) {
  const root = document.querySelector("#casamentos-lista");
  const rows = data.casamentos || [];
  if (!rows.length) {
    showEmpty(root, "Nenhum casamento cadastrado.");
    return;
  }
  root.replaceChildren();
  rows.forEach((row) => {
    const card = el("article", "member-card");
    const body = el("div");
    body.append(
      el("strong", "person-name", displayPersonName(row.irmao_nome || "")),
      el("p", "muted", isoToBr(row.data_casamento) || row.data_casamento),
    );
    const actions = el("div");
    actions.append(
      button(row.ativo === false ? "Reativar" : "Encerrar", async () => {
        await staff(ctx, { acao: "remover_casamento", id: row.id });
        await refresh(ctx);
      }),
    );
    card.append(body, actions);
    root.append(card);
  });
}

function parentescoLabel(value) {
  return {
    esposa: "Cunhada (esposa)",
    companheira: "Cunhada (companheira)",
    filho: "Filho",
    filha: "Filha",
    pai: "Pai",
    mae: "Mãe",
    outro: "Outro",
  }[value] || value;
}

function button(label, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "button button-secondary table-action";
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function fillIrmao(row) {
  document.querySelector("#irmao-id").value = row.id;
  document.querySelector("#irmao-nome").value = row.nome;
  document.querySelector("#irmao-dia").value = row.dia_nascimento || "";
  document.querySelector("#irmao-mes").value = row.mes_nascimento || "";
  document.querySelector("#irmao-iniciacao").value = isoToBr(row.data_iniciacao);
  document.querySelector("#irmao-loja").value = row.loja_iniciacao || "";
  document.querySelector("#irmao-exibir-niver").checked = row.exibir_aniversario !== false;
  document.querySelector("#irmao-exibir-inic").checked = row.exibir_iniciacao !== false;
}

function fillFamiliar(row) {
  document.querySelector("#familiar-id").value = row.id;
  familiarIrmaoSelect.setValue(row.irmao_id);
  document.querySelector("#familiar-nome").value = row.nome;
  document.querySelector("#familiar-parentesco").value = row.parentesco;
  document.querySelector("#familiar-dia").value = row.dia_nascimento || "";
  document.querySelector("#familiar-mes").value = row.mes_nascimento || "";
  document.querySelector("#familiar-exibir").checked = row.autorizado_exibicao === true;
}

async function saveIrmao(event, ctx) {
  event.preventDefault();
  const body = {
    acao: "salvar_irmao",
    id: document.querySelector("#irmao-id").value || undefined,
    nome: document.querySelector("#irmao-nome").value,
    dia_nascimento: Number(document.querySelector("#irmao-dia").value) || null,
    mes_nascimento: Number(document.querySelector("#irmao-mes").value) || null,
    data_iniciacao: readIsoDate(document.querySelector("#irmao-iniciacao")) || null,
    loja_iniciacao: document.querySelector("#irmao-loja").value || null,
    exibir_aniversario: document.querySelector("#irmao-exibir-niver").checked,
    exibir_iniciacao: document.querySelector("#irmao-exibir-inic").checked,
    exibir_idade: false,
  };
  const { data } = await staff(ctx, body);
  setStatus("#irmao-status", Boolean(data?.ok), data?.ok ? "Irmão salvo." : "Não foi possível salvar.");
  if (data?.ok) {
    event.target.reset();
    document.querySelector("#irmao-id").value = "";
    await refresh(ctx);
  }
}

async function saveFamiliar(event, ctx) {
  event.preventDefault();
  const body = {
    acao: "salvar_familiar",
    id: document.querySelector("#familiar-id").value || undefined,
    irmao_id: familiarIrmaoSelect.value(),
    nome: document.querySelector("#familiar-nome").value,
    parentesco: document.querySelector("#familiar-parentesco").value,
    dia_nascimento: Number(document.querySelector("#familiar-dia").value) || null,
    mes_nascimento: Number(document.querySelector("#familiar-mes").value) || null,
    autorizado_exibicao: document.querySelector("#familiar-exibir").checked,
  };
  const { data } = await staff(ctx, body);
  setStatus("#familiar-status", Boolean(data?.ok), data?.ok ? "Familiar salvo." : "Não foi possível salvar.");
  if (data?.ok) {
    event.target.reset();
    familiarIrmaoSelect.clear();
    await refresh(ctx);
  }
}

async function saveCasamento(event, ctx) {
  event.preventDefault();
  const body = {
    acao: "salvar_casamento",
    irmao_id: irmaoSelect.value(),
    conjuge_id: conjugeSelect.value() || null,
    data_casamento: readIsoDate(document.querySelector("#casamento-data")),
    autorizado_exibicao: document.querySelector("#casamento-exibir").checked,
  };
  const { data } = await staff(ctx, body);
  setStatus("#casamento-status", Boolean(data?.ok), data?.ok ? "Casamento salvo." : (data?.error || "Não foi possível salvar."));
  if (data?.ok) {
    event.target.reset();
    irmaoSelect.clear();
    conjugeSelect.clear();
    await refresh(ctx);
  }
}

async function importCsv(ctx) {
  const itens = document.querySelector("#csv").value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [cim, tipo, mes, dia, nome] = line.split(";");
    return { cim, tipo, mes: Number(mes), dia: Number(dia), nome_exibicao: nome };
  });
  const { data } = await staff(ctx, { acao: "importar_celebracoes", itens });
  setStatus("#csv-status", Boolean(data?.ok), data?.ok ? `${data.importados} registro(s) importado(s) na tabela antiga.` : "Não foi possível importar.");
}
