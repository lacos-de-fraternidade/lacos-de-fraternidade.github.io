import test from "node:test";
import assert from "node:assert/strict";
import { duesReminder, filterBrothers, isNoticeVisible, logContainsSecret, pickDashboardNotice, noticeDisplayStatus, noticePeriodLabel, noticePublicDateLabel, relatedEventForNotice, canSeeMigrationTools, rowClickOpensDetails, relatedSessionNotice, relatedSessionNotices, sessionNoticeCopy } from "../area-restrita/js/comunicados.js";

test("aviso de mensalidade aparece só entre os dias 5 e 20", () => {
  assert.equal(duesReminder(new Date(2026, 7, 4)), null);
  assert.equal(duesReminder(new Date(2026, 7, 5)).titulo, "Lembrete de mensalidade");
  assert.equal(duesReminder(new Date(2026, 7, 20)).titulo, "Lembrete de mensalidade");
  assert.equal(duesReminder(new Date(2026, 7, 21)), null);
});

test("comunicado urgente substitui o lembrete de mensalidade", () => {
  const from = new Date(2026, 7, 10, 12, 0, 0);
  const notice = pickDashboardNotice({
    from,
    comunicados: [{ titulo: "Aviso urgente", corpo: "Presença imediata.", tipo: "urgente", publicado: true }],
  });
  assert.equal(notice.titulo, "Aviso urgente");
});

test("sessão administrativa obrigatória tem prioridade sobre a mensalidade", () => {
  const from = new Date(2026, 7, 10, 12, 0, 0);
  const notice = pickDashboardNotice({
    from,
    comunicados: [],
    eventos: [{
      tipo_evento: "sessao_administrativa",
      inicia_em: new Date(2026, 7, 18, 19, 30).toISOString(),
      presenca_obrigatoria: true,
      destaque: true,
      publicado: true,
      ativo: true,
    }],
  });
  assert.equal(notice.titulo, "Sessão administrativa");
});

test("em 21/08 não há aviso de mensalidade e o estado vazio permanece", () => {
  const notice = pickDashboardNotice({ from: new Date(2026, 7, 21, 8, 0, 0), comunicados: [], eventos: [] });
  assert.equal(notice, null);
});

test("logs não expõem senha, token ou CIM completa", () => {
  assert.equal(logContainsSecret({ evento: "login_sucesso", usuario: "Paulo" }), false);
  assert.equal(logContainsSecret({ evento: "login_sucesso", password: "x" }), true);
  assert.equal(logContainsSecret({ refresh_token: "abc" }), true);
});

test("busca e filtros da gestão de Irmãos", () => {
  const rows = [
    { nome: "Fábio Boa Morte da Silva", cim_mascarada: "12••34", email: "fabio@loja.org", situacao: "quiet_placet", perfil: "irmao", conta_ativada: false, acesso_id: "a1" },
    { nome: "Taylor Teodoro Maia Vital", cim_mascarada: "45••67", email: "taylor@loja.org", situacao: "transferencia", perfil: "irmao", conta_ativada: true, acesso_id: "a2" },
    { nome: "Paulo Henrique Braga", cim_mascarada: "26••52", email: "paulo@loja.org", situacao: "ativo", perfil: "administrador", conta_ativada: true, acesso_id: "a3" },
  ];
  assert.equal(filterBrothers(rows, { q: "fábio" })[0].nome.includes("Fábio"), true);
  assert.equal(filterBrothers(rows, { q: "1234" })[0].cim_mascarada, "12••34");
  assert.equal(filterBrothers(rows, { q: "paulo@loja.org" }).length, 1);
  assert.equal(filterBrothers(rows, { situacao: "quiet_placet" }).length, 1);
  assert.equal(filterBrothers(rows, { perfil: "administrador" }).length, 1);
  assert.equal(filterBrothers(rows, { acesso: "nao" }).length, 0);
});

test("comunicado ativo, agendado, encerrado e desativado", () => {
  const from = new Date(2026, 7, 21, 12, 0, 0);
  assert.equal(noticeDisplayStatus({ publicado: true }, from), "ativo");
  assert.equal(noticeDisplayStatus({ publicado: true, inicio_exibicao: "2026-08-22T12:00:00" }, from), "agendado");
  assert.equal(noticeDisplayStatus({ publicado: true, fim_exibicao: "2026-08-20T12:00:00" }, from), "encerrado");
  assert.equal(noticeDisplayStatus({ publicado: false, titulo: "X" }, from), "desativado");
});

test("ferramentas de migração ficam restritas ao administrador", () => {
  assert.equal(canSeeMigrationTools("administrador"), true);
  assert.equal(canSeeMigrationTools("secretario"), false);
  assert.equal(canSeeMigrationTools("irmao"), false);
});

test("clique na linha abre detalhes, mas o menu de ações não", () => {
  assert.equal(rowClickOpensDetails({ closest: () => null }), true);
  assert.equal(rowClickOpensDetails({ closest: (sel) => (sel === ".record-actions" ? {} : null) }), false);
});

test("comunicado de sessão aparece associado à próxima sessão", () => {
  const when = new Date(2026, 7, 26, 19, 30);
  const rows = [{
    tipo: "sessao",
    publicado: true,
    titulo: "O nosso V∴ M∴ vos convida",
    inicio_exibicao: "2026-08-21T00:00:00",
    fim_exibicao: "2026-08-26T23:59:00",
  }, {
    tipo: "sessao",
    publicado: true,
    titulo: "Segundo aviso",
    inicio_exibicao: "2026-08-21T00:00:00",
    fim_exibicao: "2026-08-26T23:59:00",
  }];
  const notice = relatedSessionNotice(rows, { when }, new Date(2026, 7, 21, 12));
  assert.equal(notice.titulo, "O nosso V∴ M∴ vos convida");
  assert.equal(relatedSessionNotices(rows, { when }, new Date(2026, 7, 21, 12)).length, 2);
  assert.equal(sessionNoticeCopy(1), "A próxima sessão possui um comunicado importante publicado pela Secretaria.");
  assert.equal(sessionNoticeCopy(2), "Existem comunicados importantes relacionados à próxima sessão.");
  assert.equal(sessionNoticeCopy(0), "");
});

test("dashboard mostra a data da sessão e não a janela administrativa", () => {
  const from = new Date(2026, 7, 21, 12, 0, 0);
  const notice = {
    tipo: "sessao",
    publicado: true,
    titulo: "O nosso V∴ M∴ vos convida",
    inicio_exibicao: "2026-08-21T00:00:00",
    fim_exibicao: "2026-08-26T23:59:00",
  };
  assert.equal(noticePeriodLabel(notice), "21/08/2026 a 26/08/2026");
  assert.equal(isNoticeVisible(notice, from), true);
  const event = relatedEventForNotice(notice, [{
    tipo_evento: "sessao_ordinaria",
    inicia_em: new Date(2026, 7, 26, 19, 30).toISOString(),
    publicado: true,
    ativo: true,
  }], from);
  const label = noticePublicDateLabel(event);
  assert.match(label, /Sessão em 26 de agosto/);
  assert.match(label, /19h30/);
  assert.equal(label.includes("21/08/2026"), false);
  assert.equal(relatedEventForNotice({
    tipo: "informativo",
    publicado: true,
    inicio_exibicao: "2026-08-21T00:00:00",
    fim_exibicao: "2026-08-26T23:59:00",
  }, [{
    tipo_evento: "sessao_ordinaria",
    inicia_em: new Date(2026, 7, 26, 19, 30).toISOString(),
    publicado: true,
    ativo: true,
  }], from), null);
});
