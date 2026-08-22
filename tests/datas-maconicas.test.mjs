import test from "node:test";
import assert from "node:assert/strict";
import { remainingInMonth, occurredInMonth, nextMonthWithRemaining } from "../area-restrita/js/datas.js";
import {
  ACTIVE_MACONIC_TYPES,
  MACONIC_DATE_TYPES,
  MACONIC_FILTER_ORDER,
  caminhadaLabel,
  collectMasonicDates,
  createMasonicDate,
  masonicCompletedNotice,
  masonicMonthCopy,
} from "../area-restrita/js/datas-maconicas.js";

test("catálogo de datas maçônicas reserva tipos futuros sem exibi-los", () => {
  assert.equal(MACONIC_DATE_TYPES.iniciacao.ativo, true);
  assert.equal(MACONIC_DATE_TYPES.fundacao.ativo, false);
  assert.equal(MACONIC_DATE_TYPES.instalacao.ativo, false);
  assert.deepEqual(ACTIVE_MACONIC_TYPES.map((type) => type.id), ["iniciacao"]);
  assert.equal(createMasonicDate({ tipo: "fundacao", nome: "Loja", dia: 6, mes: 8 }), null);
});

test("aniversários de iniciação viram datas maçônicas genéricas", () => {
  const from = new Date(2026, 7, 21);
  const items = collectMasonicDates({
    irmaos: [
      { id: "a", nome: "Paulo Henrique Braga", data_iniciacao: "2017-08-24", loja_iniciacao: "Laços de Fraternidade", exibir_iniciacao: true },
      { id: "b", nome: "Oculto", data_iniciacao: "2018-04-02", exibir_iniciacao: false },
      { id: "c", nome: "Denis Batista Cipriano", data_iniciacao: "2017-08-13", loja_iniciacao: "Laços de Fraternidade", exibir_iniciacao: true },
    ],
  }, { isOwn: (id) => id === "a", from });
  assert.equal(items.length, 2);
  assert.equal(items[0].tipo, "iniciacao");
  assert.equal(items[0].categoria, "iniciacao");
  assert.equal(items[0].proprio, true);
  assert.equal(items[0].local, "Laços de Fraternidade");
  assert.equal(items[0].detalhe, "9 anos de caminhada maçônica");
  assert.equal(remainingInMonth(items, 8, 2026, from).length, 1);
  assert.equal(occurredInMonth(items, 8, 2026, from)[0].nome, "Denis Batista Cipriano");
});

test("resumo do mês descreve as datas maçônicas restantes", () => {
  assert.equal(
    masonicMonthCopy({ remaining: 3, nextDays: 4, monthLabel: "agosto" }),
    "Agosto possui 3 datas maçônicas. A próxima celebração ocorrerá em 4 dias.",
  );
  assert.equal(
    masonicMonthCopy({ remaining: 1, nextDays: 0, monthLabel: "Agosto" }),
    "Agosto possui 1 data maçônica. A próxima celebração ocorre hoje.",
  );
  assert.equal(
    masonicMonthCopy({ remaining: 0, occurred: 3, monthLabel: "agosto" }),
    "Todas as datas maçônicas deste mês já foram celebradas.",
  );
  assert.deepEqual(
    masonicCompletedNotice({ monthLabel: "agosto", nextMonthLabel: "setembro" }),
    [
      "Todas as datas maçônicas de agosto já foram celebradas.",
      "Os aniversários de iniciação deste mês continuam disponíveis abaixo para consulta.",
      "A próxima celebração acontecerá em setembro.",
    ],
  );
  const next = nextMonthWithRemaining({ month: 8, year: 2026 }, [
    { dia: 13, mes: 8 },
    { dia: 5, mes: 9 },
  ], new Date(2026, 7, 21));
  assert.equal(next.month, 9);
  assert.equal(caminhadaLabel(0), "Iniciado neste ano");
  assert.equal(caminhadaLabel(1), "1 ano de caminhada maçônica");
  assert.equal(caminhadaLabel(11), "11 anos de caminhada maçônica");
  assert.deepEqual(MACONIC_FILTER_ORDER.slice(0, 5), ["iniciacao", "instalacao", "fundacao", "jubileu", "historica"]);
  assert.equal(MACONIC_DATE_TYPES.instalacao.ativo, false);
});
