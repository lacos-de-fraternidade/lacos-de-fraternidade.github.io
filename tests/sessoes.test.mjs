import test from "node:test";
import assert from "node:assert/strict";
import {
  lodgeSessionsForMonth,
  nextLodgeSession,
  nthWeekdayOfMonth,
  sessionKey,
  sessionProgramHeading,
  sessionProgramItems,
} from "../area-restrita/js/sessoes.js";

test("calcula a segunda e a quarta quarta-feira de agosto de 2026", () => {
  const second = nthWeekdayOfMonth(2026, 8, 3, 2);
  const fourth = nthWeekdayOfMonth(2026, 8, 3, 4);
  assert.equal(second.getFullYear(), 2026);
  assert.equal(second.getMonth(), 7);
  assert.equal(second.getDate(), 12);
  assert.equal(fourth.getDate(), 26);
  assert.equal(second.getHours(), 19);
  assert.equal(second.getMinutes(), 30);
  const sessions = lodgeSessionsForMonth(2026, 8);
  assert.deepEqual(sessions.map((item) => item.getDate()), [12, 26]);
});

test("a próxima sessão depois de 21/08/2026 é 26/08/2026", () => {
  const from = new Date(2026, 7, 21, 12, 0, 0);
  const eventos = lodgeSessionsForMonth(2026, 8).map((when) => ({
    tipo_evento: "sessao_ordinaria",
    inicia_em: when.toISOString(),
    publicado: true,
    ativo: true,
    chave_idempotencia: sessionKey(when),
  }));
  const next = nextLodgeSession(eventos, from);
  assert.equal(next.when.getDate(), 26);
  assert.equal(next.when.getMonth(), 7);
});

test("não duplica chaves e ignora sessão cancelada", () => {
  const a = sessionKey(nthWeekdayOfMonth(2026, 8, 3, 2));
  const b = sessionKey(nthWeekdayOfMonth(2026, 8, 3, 2));
  assert.equal(a, b);
  const from = new Date(2026, 7, 21, 12, 0, 0);
  const eventos = [
    { tipo_evento: "sessao_ordinaria", inicia_em: new Date(2026, 7, 26, 19, 30).toISOString(), ativo: false, publicado: false },
    { tipo_evento: "sessao_ordinaria", inicia_em: new Date(2026, 8, 9, 19, 30).toISOString(), ativo: true, publicado: true },
  ];
  const next = nextLodgeSession(eventos, from);
  assert.equal(next.when.getMonth(), 8);
  assert.equal(next.when.getDate(), 9);
});

test("sessão excepcional editada continua sendo a próxima se estiver ativa", () => {
  const from = new Date(2026, 7, 21, 12, 0, 0);
  const eventos = [{
    tipo_evento: "sessao_administrativa",
    inicia_em: new Date(2026, 7, 24, 19, 30).toISOString(),
    ativo: true,
    publicado: true,
    excepcional: true,
  }];
  const next = nextLodgeSession(eventos, from);
  assert.equal(next.when.getDate(), 24);
});

test("o programa da sessão descreve café, grau e pauta persistidos", () => {
  assert.deepEqual(sessionProgramItems({
    categoria: "sessao",
    tipoEvento: "sessao_ordinaria",
    cafe_fraternal: true,
    cafe_horario: "18:45",
    grau: 1,
    pauta: [{ titulo: "Leitura da pauta administrativa", ordem: 1 }],
  }), [
    "Café fraternal às 18h45",
    "Sessão no grau 1",
    "Leitura da pauta administrativa",
  ]);
  assert.deepEqual(sessionProgramItems({ categoria: "sessao", tipo_evento: "sessao_administrativa" }), []);
  assert.equal(sessionProgramHeading(true), "Na próxima sessão");
  assert.equal(sessionProgramHeading(false), "Nesta sessão");
});
