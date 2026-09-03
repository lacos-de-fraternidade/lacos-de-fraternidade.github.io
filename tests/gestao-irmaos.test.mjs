import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  accessCardModel,
  accessDialogModel,
  accessSetupState,
  accessStatus,
  accessStatusPanel,
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
  missingAccessFields,
  movementChoices,
  movementTitle,
  resolveAssignableProfile,
  profileSelectOptions,
  resultsCountLabel,
  sortBrothers,
  syncedMemberView,
  validateBrotherForm,
  validateQuietPlacet,
  validateTransferencia,
} from "../area-restrita/js/gestao-irmaos.js";
import { maskBrDate, parseFlexibleBrDate } from "../area-restrita/js/dates-br.js";
import { normalizeCim } from "../area-restrita/js/cim.js";
import { beginSubmit, endSubmit } from "../area-restrita/js/feedback.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const rows = [
  { irmao_id: "1", nome: "Paulo Henrique Braga", cim_mascarada: "26••52", email: "paulo@loja.org", situacao: "ativo", perfil: "administrador", conta_ativada: true, acesso_id: "a1", acesso_ativo: true, ultimo_acesso_em: "2026-08-21T20:00:00.000Z" },
  { irmao_id: "2", nome: "Agadir Zampirolli", cim_mascarada: "", email: "", situacao: "ativo", perfil: null, conta_ativada: false, acesso_id: null },
  { irmao_id: "3", nome: "Taylor Teodoro", cim_mascarada: "45••67", email: "taylor@loja.org", situacao: "inativo", perfil: "irmao", conta_ativada: true, acesso_id: "a3", acesso_ativo: false },
];

test("lista, busca e ordenação da aba Irmãos", () => {
  assert.equal(cimLabel(rows[0]), "CIM 26••52");
  assert.equal(cimLabel(rows[1]), "CIM não cadastrada");
  assert.equal(accessStatus(rows[0]).label, "Conta ativa");
  assert.equal(accessStatus(rows[1]).label, "Sem acesso");
  assert.equal(accessStatus(rows[2]).label, "Conta bloqueada");
  assert.equal(resultsCountLabel(31, false), "31 Irmãos cadastrados");
  assert.equal(resultsCountLabel(4, true), "4 Irmãos encontrados");
  assert.equal(resultsCountLabel(1, true), "1 Irmão encontrado");
  assert.equal(resultsCountLabel(1, false), "1 Irmão cadastrado");
  assert.equal(resultsCountLabel(0, true), "Nenhum Irmão encontrado");
  assert.equal(resultsCountLabel(0, false), "Nenhum Irmão cadastrado");
  assert.equal(filtersAreActive({ q: "paulo" }), true);
  assert.equal(filtersAreActive({}), false);
  assert.equal(sortBrothers(rows, "nome-az")[0].nome, "Agadir Zampirolli");
  assert.equal(filterGestaoBrothers(rows, { q: "26.52" })[0].irmao_id, "1");
  assert.equal(filterGestaoBrothers(rows, { acessoStatus: "sem_acesso" }).length, 1);
  assert.equal(filterGestaoBrothers(rows, { q: "paulo", situacao: "ativo", perfil: "administrador" })[0].irmao_id, "1");
  assert.equal(filterGestaoBrothers(rows, { q: "paulo", situacao: "inativo" }).length, 0);
});

test("ficha da gestão concentra ações e omite o menu da lista", () => {
  const secretary = ficheActions(rows[0], { perfil: "secretario" }).map((item) => item.id);
  assert.deepEqual(secretary, ["editar_cadastro", "configurar_acesso", "registrar_movimentacao"]);
  assert.equal(secretary.includes("ver_detalhes"), false);
  const noAccess = ficheActions(rows[1], { perfil: "secretario" }).map((item) => item.id);
  assert.deepEqual(noAccess, ["editar_cadastro", "configurar_acesso", "registrar_movimentacao"]);
  const adminOnAdmin = ficheActions(rows[0], { perfil: "administrador", id: "a1" }).map((item) => item.id);
  assert.equal(adminOnAdmin.includes("excluir_cadastro"), false);
  const adminOnBrother = ficheActions(rows[1], { perfil: "administrador", id: "a1" }).map((item) => item.id);
  assert.equal(adminOnBrother.includes("excluir_cadastro"), true);
  assert.equal(canDeleteBrother(rows[0], { perfil: "administrador", id: "a1" }), false);
  assert.equal(canDeleteBrother(rows[1], { perfil: "secretario", id: "a2" }), false);
  assert.equal(canDeleteBrother(rows[1], { perfil: "administrador", id: "a1" }), true);
  assert.deepEqual(listMenuActions(rows[1], { perfil: "administrador", id: "a1" }).map((item) => item.id), [
    "ver_detalhes",
    "editar_cadastro",
    "configurar_acesso",
    "registrar_movimentacao",
    "excluir_cadastro",
  ]);
  const choices = movementChoices().map((item) => item.id);
  assert.deepEqual(choices, ["quiet", "transfer", "afastamento", "retorno"]);
  assert.equal(movementTitle("quiet"), "Registrar quiet placet");
  assert.equal(movementTitle("transfer"), "Registrar transferência");
  assert.equal(grauLabel({}), "");
  assert.equal(grauLabel({ grau: "mestre" }), "Mestre");
  assert.equal(formatFicheDate("2018-11-24"), "24/11/2018");
  const timeline = buildBrotherTimeline({ data_iniciacao: "2018-11-24", loja_iniciacao: "Loja" }, [
    { evento: "convite_aceito", criado_em: "2025-05-02T10:00:00.000Z", detalhe: "" },
  ]);
  assert.equal(timeline[0].title, "Iniciação");
  assert.equal(timeline[1].title, "Convite aceito");
  assert.equal(DRAWER_SECTIONS.filter((section) => section.open).map((section) => section.id).join(","), "institucionais,maconicos,acesso");
  assert.equal(DRAWER_SECTIONS.find((section) => section.id === "historico").open, false);
});

test("validação do cadastro usa português e não exige CIM", () => {
  const empty = validateBrotherForm({});
  assert.equal(empty.nome, "Informe o nome completo do Irmão.");
  assert.equal(empty.cim, undefined);
  assert.equal(validateBrotherForm({ nome: "Paulo Henrique", nascimento: "31/02/1990" }).nascimento, "Informe uma data de nascimento válida.");
  assert.equal(validateBrotherForm({ nome: "Paulo Henrique", nascimento: "24/08/2099" }, { from: new Date(2026, 7, 22) }).nascimento, "Informe uma data de nascimento válida.");
  assert.equal(validateBrotherForm({ nome: "Paulo Henrique", nascimento: "24/08/1985" }).nascimento, undefined);
  assert.equal(validateBrotherForm({ nome: "Paulo Henrique", nascimento: "24/08" }).nascimento, undefined);
  assert.equal(validateBrotherForm({ nome: "Paulo Henrique", iniciacao: "31/02/2020" }).iniciacao, "Informe uma data de iniciação válida.");
  assert.equal(validateBrotherForm({ nome: "Paulo Henrique", iniciacao: "24/08/2099" }, { from: new Date(2026, 7, 22) }).iniciacao, "Informe uma data de iniciação válida.");
  assert.equal(validateBrotherForm({ nome: "Paulo Henrique", email: "x" }).email, "Informe um e-mail válido.");
  assert.equal(validateBrotherForm({ nome: "Outro", email: "paulo@loja.org" }, { brothers: rows }).email, "Este e-mail já está vinculado a outro acesso.");
  assert.equal(mapSaveError("duplicate key cim"), "Esta CIM já está vinculada a outro Irmão.");
  const family = familyGroups([{ irmao_id: "1", parentesco: "esposa", nome: "Maria" }, { irmao_id: "1", parentesco: "filho", nome: "João" }], "1");
  assert.equal(family.conjuge.length, 1);
  assert.equal(family.filhos.length, 1);
});

test("perfil e Loja do modal respeitam a regra institucional", () => {
  assert.equal(DEFAULT_LOJA_INICIACAO, "ARLS Laços de Fraternidade 357 nº 251");
  assert.deepEqual(assignableProfiles("administrador"), ["irmao", "secretario", "veneravel_mestre", "administrador"]);
  assert.deepEqual(assignableProfiles("veneravel_mestre"), ["irmao", "secretario"]);
  assert.deepEqual(assignableProfiles("secretario"), ["irmao", "secretario"]);
  assert.equal(resolveAssignableProfile("administrador", "secretario").ok, true);
  assert.equal(resolveAssignableProfile("secretario", "administrador").ok, false);
  assert.equal(resolveAssignableProfile("secretario", "irmao").perfil, "irmao");
  assert.equal(validateBrotherForm({ nome: "Paulo", perfil: "administrador" }, { actorPerfil: "secretario" }).perfil, "Perfil não autorizado.");
  assert.equal(validateBrotherForm({ nome: "Paulo", perfil: "administrador" }, { actorPerfil: "administrador" }).perfil, undefined);
  assert.equal(maskBrDate("24081985"), "24/08/1985");
  assert.equal(parseFlexibleBrDate("24/08/1985").iso, "1985-08-24");
  assert.equal(birthInputFromParts({ dia_nascimento: 24, mes_nascimento: 8, ano_nascimento: 1985 }), "24/08/1985");
  assert.equal(normalizeCim("012345"), "012345");
});

test("página da gestão prepara a aba Irmãos sem esvaziar o layout", () => {
  const html = read("area-restrita/gestao/index.html");
  const js = read("area-restrita/gestao/gestao.js");
  const css = read("area-restrita/css/area.css");
  assert.match(html, /Todas as situações/);
  assert.match(html, /Todos os perfis/);
  assert.match(html, /Todos os acessos/);
  assert.match(html, /Buscar por nome, CIM ou e-mail/);
  assert.match(html, /<label for="busca">Buscar por nome, CIM ou e-mail<\/label>/);
  assert.match(html, /section-switcher/);
  assert.match(html, /Seção administrativa/);
  assert.doesNotMatch(html, />Buscar irmão</);
  assert.doesNotMatch(html, /Nome • CIM • e-mail/);
  assert.match(html, /members-toolbar/);
  assert.match(html, /members-results-summary/);
  assert.match(js, /initializeNewMemberModal/);
  assert.match(js, /openNewMemberModal/);
  assert.match(js, /#novo-irmao/);
  assert.match(css, /height: 50px/);
  assert.match(css, /align-items: end/);
  assert.doesNotMatch(html, /ordenar-irmaos/);
  assert.match(html, /dialog-admin/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Conta ativa/);
  assert.match(html, /Convite enviado/);
  assert.match(html, /novalidate/);
  assert.match(html, /is-skeleton/);
  assert.match(html, /A liberação do acesso à Área dos Irmãos será realizada posteriormente pela Secretaria/);
  assert.match(js, /Ver detalhes/);
  assert.doesNotMatch(js, /actionsMenu/);
  assert.match(js, /listar_historico/);
  assert.match(js, /listar_gestao/);
  assert.match(js, /A lista de Irmãos já foi resolvida acima/);
  assert.match(js, /Irmão cadastrado com sucesso/);
  assert.match(js, /Não foi possível carregar os Irmãos/);
  assert.match(js, /irmaosStatus === "loading"/);
  assert.doesNotMatch(js, /alert\(/);
  assert.match(css, /minmax\(260px, 2fr\)/);
  assert.match(css, /min\(820px, calc\(100vh - 40px\)\)/);
  assert.match(css, /\.situacao-dot/);
  assert.match(css, /\.fiche-section/);
  assert.match(css, /\.area-main \{[^}]*flex: 1/);
  assert.match(read("supabase/functions/_shared/staff-actions.ts"), /listar_historico/);
  assert.match(read("supabase/functions/_shared/staff-actions.ts"), /convidar_gestao/);
  assert.match(read("supabase/functions/_shared/gestao.ts"), /regularizar_situacao/);
  assert.match(read("supabase/functions/_shared/gestao.ts"), /excluir_irmao/);
  assert.match(js, /confirmDeleteBrother/);
  assert.match(read("supabase/functions/_shared/staff-actions.ts"), /excluir_irmao/);
  assert.doesNotMatch(html, /opcional nesta etapa/);
  assert.match(html, /<label for="novo-cim">CIM<\/label>/);
  assert.match(html, /<label for="novo-email">E-mail<\/label>/);
  assert.match(js, /convidar_gestao/);
  assert.match(js, /bindBrDatePicker/);
  assert.match(js, /current\.cim/);
  assert.match(js, /Movimentação atual/);
  assert.match(js, /actionToastMessage/);
  assert.doesNotMatch(js, /Ação concluída\./);
  assert.match(css, /\.br-datepicker/);
  assert.match(read("area-restrita/js/dates-br.js"), /showPicker/);
});

test("configurar acesso distingue cadastro incompleto, convite e conta ativa", () => {
  const ready = { irmao_id: "r1", cim: "247779", cim_mascarada: "24••79", email: "email@dominio.com", situacao: "ativo" };
  const noCim = { irmao_id: "n1", email: "email@dominio.com", situacao: "ativo" };
  const noEmail = { irmao_id: "n2", cim: "247779", cim_mascarada: "24••79", situacao: "ativo" };
  const none = { irmao_id: "n3", situacao: "ativo" };
  const pending = { ...ready, acesso_id: "a1", convite_enviado_em: "2026-08-19T12:00:00.000Z", convite_expira_em: "2026-08-26T12:00:00.000Z", perfil: "irmao" };
  const expired = { ...ready, acesso_id: "a2", convite_enviado_em: "2026-08-01T12:00:00.000Z", convite_expira_em: "2026-08-02T12:00:00.000Z", perfil: "irmao" };
  const active = { ...ready, acesso_id: "a3", conta_ativada: true, acesso_ativo: true, perfil: "irmao", ultimo_acesso_em: "2026-08-21T20:00:00.000Z", conta_ativada_em: "2026-08-20T10:00:00.000Z" };
  const blocked = { ...active, acesso_id: "a4", acesso_ativo: false };
  const revoked = { ...ready, acesso_id: "a5", acesso_ativo: false, conta_ativada: false };
  const from = new Date("2026-08-22T12:00:00.000Z");

  assert.deepEqual(missingAccessFields(ready), []);
  assert.deepEqual(missingAccessFields(noCim), ["CIM"]);
  assert.deepEqual(missingAccessFields(noEmail), ["E-mail"]);
  assert.deepEqual(missingAccessFields(none), ["CIM", "E-mail"]);
  assert.equal(accessSetupState(ready, from).id, "pronta");
  assert.equal(accessSetupState(noCim, from).id, "incomplete");
  assert.equal(accessSetupState(pending, from).id, "pendente");
  assert.equal(accessSetupState(expired, from).id, "expirado");
  assert.equal(accessSetupState(active, from).id, "ativa");
  assert.equal(accessSetupState(blocked, from).id, "bloqueada");
  assert.equal(accessSetupState(revoked, from).id, "revogada");
  assert.equal(accessStatus(revoked).label, "Acesso revogado");

  const readyModel = accessDialogModel(ready, "secretario", from);
  assert.equal(readyModel.primary, "liberar_acesso");
  assert.equal(readyModel.showInvite, true);
  assert.equal(readyModel.panel.title, "Sem acesso");
  assert.equal(accessDialogModel(noCim, "secretario", from).primary, "completar_cadastro");
  assert.equal(accessDialogModel(noEmail, "secretario", from).primary, "completar_cadastro");
  assert.equal(accessDialogModel(pending, "secretario", from).primary, "reenviar_convite");
  assert.equal(accessDialogModel(pending, "secretario", from).canCancelInvite, true);
  assert.equal(accessDialogModel(expired, "secretario", from).primary, "enviar_novo_convite");
  const activeModel = accessDialogModel(active, "administrador", from);
  assert.equal(activeModel.showInvite, false);
  assert.equal(activeModel.canBlock, true);
  assert.equal(activeModel.canRevoke, true);
  assert.equal(activeModel.canReset, true);
  assert.equal(activeModel.panel.title, "Conta ativa");
  assert.equal(accessDialogModel(blocked, "secretario", from).canUnblock, true);
  assert.equal(accessDialogModel(blocked, "secretario", from).panel.title, "Conta bloqueada");
  assert.equal(accessDialogModel(active, "secretario", from).canRevoke, false);
  assert.deepEqual(accessDialogModel(ready, "secretario", from).profiles, ["irmao", "secretario"]);
  assert.deepEqual(accessDialogModel(ready, "administrador", from).profiles, ["irmao", "secretario", "veneravel_mestre", "administrador"]);
  assert.equal(resolveAssignableProfile("secretario", "administrador").ok, false);
  assert.equal(profileSelectOptions("secretario", "administrador").some((item) => item.id === "administrador" && item.disabled), true);
  assert.equal(profileSelectOptions("secretario", "irmao").some((item) => item.id === "administrador"), false);

  const readyPanel = accessStatusPanel(ready, "secretario", from);
  assert.equal(readyPanel.label, "Status do acesso");
  assert.match(readyPanel.detail, /convite no e-mail cadastrado/);
  const pendingPanel = accessStatusPanel(pending, "secretario", from);
  assert.match(pendingPanel.description, /Enviado em/);
  assert.match(pendingPanel.facts[0].value, /Expira em/);
  const card = accessCardModel(pending, from);
  assert.equal(card.rows[0][1], "Convite enviado");
  assert.equal(card.rows.find((row) => row[0] === "Ativação")[1], "Aguardando");
  assert.deepEqual(buildAccessTimeline({
    cadastrado_em: "2026-08-22",
    convite_enviado_em: "2026-08-23",
    conta_ativada_em: "2026-08-24",
    ultimo_acesso_em: "2026-08-26",
  }).map((item) => item.title), [
    "Cadastro institucional concluído",
    "Convite enviado",
    "Conta ativada",
    "Último acesso",
  ]);
  assert.equal(buildAccessTimeline({}).length, 0);
});

test("edição carrega CIM e e-mail e impede duplicidade", () => {
  const current = { irmao_id: "1", nome: "Paulo Henrique Braga", cim: "2652", email: "paulo@loja.org", perfil: "irmao" };
  assert.equal(current.cim, "2652");
  assert.equal(validateBrotherForm({ nome: current.nome, cim: current.cim, email: current.email }, { brothers: rows, editingId: "1" }).cim, undefined);
  assert.equal(validateBrotherForm({ nome: "Outro", cim: "2652" }, { brothers: [{ ...rows[0], cim: "2652" }] }).cim, "Esta CIM já está vinculada a outro Irmão.");
  assert.equal(validateBrotherForm({ nome: "Outro", email: "x" }).email, "Informe um e-mail válido.");
  assert.equal(validateBrotherForm({ nome: "Paulo", perfil: "secretario" }, { actorPerfil: "secretario" }).perfil, undefined);
  assert.equal(actionToastMessage("salvar_gestao_irmao", true), "Cadastro atualizado com sucesso.");
});

test("quiet placet e transferência validam datas e sincronizam lista e drawer", () => {
  assert.equal(validateQuietPlacet({}).inicio_em, "Informe a data de início.");
  assert.equal(validateQuietPlacet({ inicio_em: "22/08/2026" }).previsao_termino, "Informe o término previsto.");
  assert.equal(validateQuietPlacet({ inicio_em: "22/08/2026", previsao_termino: "21/08/2026", motivo: "Viagem" }).previsao_termino, "O término deve ser posterior ao início.");
  assert.equal(validateQuietPlacet({ inicio_em: "22/08/2026", previsao_termino: "22/08/2027" }).motivo, "Informe o motivo do quiet placet.");
  assert.deepEqual(validateQuietPlacet({ inicio_em: "22/08/2026", previsao_termino: "22/08/2027", motivo: "Viagem" }), {});
  assert.equal(validateTransferencia({}).loja_destino, "Informe a Loja de destino.");
  assert.equal(validateTransferencia({ loja_destino: "ARLS Harmonia" }).oriente_destino, "Informe o Oriente.");
  assert.equal(validateTransferencia({ loja_destino: "ARLS Harmonia", oriente_destino: "Duque de Caxias" }).data_solicitacao, "Informe a data da solicitação.");
  assert.deepEqual(validateTransferencia({ loja_destino: "ARLS Harmonia", oriente_destino: "Duque de Caxias", data_solicitacao: "22/08/2026" }), {});
  assert.equal(actionToastMessage("quiet_placet", true), "Quiet placet registrado com sucesso.");
  assert.equal(actionToastMessage("transferencia", true), "Transferência registrada com sucesso.");
  assert.equal(actionToastMessage("convidar_gestao", true), "Convite enviado com sucesso.");
  assert.equal(actionToastMessage("reenviar_convite", true), "Convite reenviado com sucesso.");
  assert.equal(actionToastMessage("suspender_acesso", true), "Acesso bloqueado com sucesso.");
  assert.equal(actionToastMessage("desbloquear", true), "Acesso desbloqueado com sucesso.");
  assert.equal(actionToastMessage("alterar_perfil", true), "Perfil atualizado com sucesso.");
  assert.equal(actionToastMessage("excluir_irmao", true), "Cadastro excluído com sucesso.");

  const before = [{ irmao_id: "9", nome: "Agadir", situacao: "ativo" }];
  const afterTransfer = { irmao_id: "9", nome: "Agadir", situacao: "transferencia", transferencia: { loja_destino: "ARLS Harmonia", oriente_destino: "Duque de Caxias", data_solicitacao: "2026-08-22" } };
  const synced = syncedMemberView(before, afterTransfer, "9");
  assert.equal(synced.list[0].situacao, "transferencia");
  assert.equal(synced.drawer.situacao, "transferencia");
  assert.equal(synced.matchesList, true);
  assert.equal(filterGestaoBrothers(synced.list, { situacao: "transferencia" }).length, 1);
  const afterQuiet = { irmao_id: "9", nome: "Agadir", situacao: "quiet_placet", quiet_placet: { inicio_em: "2026-08-22", previsao_termino: "2027-08-22", motivo: "Viagem", suspender_acesso: true } };
  const quietSynced = syncedMemberView(before, afterQuiet, "9");
  assert.equal(quietSynced.drawer.situacao, "quiet_placet");
  assert.equal(filterGestaoBrothers(quietSynced.list, { situacao: "quiet_placet" }).length, 1);
  const movements = currentMovements(afterTransfer);
  assert.equal(movements[0].title, "Transferência");
  assert.equal(currentMovements(afterQuiet)[0].title, "Quiet placet");
});

test("toasts administrativos usam mensagens específicas e desaparecem sozinhos", () => {
  const js = read("area-restrita/gestao/gestao.js");
  const feedback = read("area-restrita/js/feedback.js");
  assert.match(js, /actionToastMessage/);
  assert.match(js, /duration: 5000/);
  assert.match(js, /Liberar acesso/);
  assert.match(js, /keepAccessDialog/);
  assert.match(js, /Enviando convite/);
  assert.match(js, /access-status-panel/);
  assert.match(js, /beginSubmit/);
  assert.match(feedback, /TOAST_DEFAULT_DURATION = 4000/);
  assert.match(feedback, /aria-live/);
  assert.match(feedback, /toast-close/);
  assert.match(js, /clearToasts/);
  assert.doesNotMatch(js, /Ação concluída\./);
  assert.match(read("supabase/functions/gerenciar-irmao/index.ts"), /convidar_gestao/);
  assert.match(read("supabase/functions/_shared/gestao.ts"), /irmao \? String\(irmao.situacao/);
  assert.match(read("supabase/functions/_shared/gestao.ts"), /cim: cim \|\| ""/);
  assert.match(read("supabase/functions/_shared/gestao.ts"), /conta_ativada_em/);
});

test("clique duplo em liberar acesso é bloqueado e o estado imediato vira convite enviado", () => {
  const button = {
    dataset: {},
    disabled: false,
    classList: { add() {}, remove() {} },
    textContent: "Liberar acesso",
  };
  assert.equal(beginSubmit(button, "Enviando convite..."), true);
  assert.equal(button.textContent, "Enviando convite...");
  assert.equal(beginSubmit(button, "Enviando convite..."), false);
  endSubmit(button);
  const afterSend = {
    irmao_id: "r1",
    cim: "247779",
    cim_mascarada: "24••79",
    email: "email@dominio.com",
    situacao: "ativo",
    acesso_id: "a9",
    convite_enviado_em: "2026-08-22T22:30:00.000Z",
    convite_expira_em: "2026-08-24T22:30:00.000Z",
    perfil: "irmao",
  };
  const next = accessDialogModel(afterSend, "secretario", new Date("2026-08-22T22:31:00.000Z"));
  assert.equal(next.access.id, "pendente");
  assert.equal(next.primary, "reenviar_convite");
  assert.equal(next.panel.title, "Convite enviado");
});

test("interface do modal, drawer e toasts permanece acessível", () => {
  const js = read("area-restrita/gestao/gestao.js");
  const modal = read("area-restrita/js/modal.js");
  const css = read("area-restrita/css/area.css");
  const html = read("area-restrita/gestao/index.html");
  assert.match(modal, /data-initial-focus/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /previous\?\.focus/);
  assert.match(html, /aria-labelledby="admin-titulo"/);
  assert.match(js, /accessCardModel/);
  assert.match(js, /buildAccessTimeline/);
  assert.match(js, /model\.rows/);
  assert.match(css, /access-status-panel/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /grid-template-columns: minmax\(0, 0\.95fr\)/);
  assert.match(read("area-restrita/js/password-ui.js"), /atendido/);
  assert.match(read("area-restrita/js/password-ui.js"), /is-score-/);
});
