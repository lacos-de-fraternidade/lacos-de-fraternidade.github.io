import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyToMemory,
  buildImportPlan,
  emptyStore,
  parseCsv,
  parseIsoDate,
  REQUIRED_FILES,
} from "../scripts/lib/glmerj-import.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "glmerj");
const read = (name) => parseCsv(readFileSync(join(dir, name), "utf8"));

function planFromFixtures() {
  return buildImportPlan({
    irmaosAniversarios: read("irmaos_aniversarios.csv"),
    cunhadas: read("cunhadas_aniversarios.csv"),
    familiares: read("familiares_aniversarios.csv"),
    casamentos: read("casamentos.csv"),
    iniciacoes: read("iniciacoes.csv"),
    fundacao: read("fundacao_loja.csv"),
  });
}

test("lê todos os arquivos de extração fictícios", () => {
  for (const name of REQUIRED_FILES) {
    assert.ok(read(name).length >= 1, name);
  }
});

test("rejeita registros inválidos e datas malformadas", () => {
  const plan = planFromFixtures();
  assert.equal(plan.report.erros.some((item) => item.fonte === "iniciacoes"), true);
  assert.equal(plan.report.erros.some((item) => item.fonte === "casamentos"), true);
  assert.equal(parseIsoDate("2026-04-26"), "2026-04-26");
  assert.equal(parseIsoDate("26/04/2026"), null);
  assert.equal(parseIsoDate("2026-02-31"), null);
});

test("aniversários sem ano não inventam ano a partir da idade", () => {
  const plan = planFromFixtures();
  const alfa = plan.irmaos.find((item) => item.nome === "IRMAO ALFA");
  assert.equal(alfa.ano_nascimento, null);
  assert.equal(alfa.idade_informada_na_importacao, 43);
  assert.equal(alfa.dia_nascimento, 20);
  assert.equal(alfa.mes_nascimento, 1);
});

test("normaliza espaços, preserva acentos e não aplica title case", () => {
  const plan = planFromFixtures();
  const beta = plan.irmaos.find((item) => item.nome === "IRMAO BETA");
  const sergio = plan.irmaos.find((item) => item.nome.includes("SÉRGIO"));
  assert.ok(beta);
  assert.equal(sergio.nome, "SÉRGIO TESTE");
  assert.equal(sergio.nome, sergio.nome.toLocaleUpperCase("pt-BR"));
});

test("vincula familiares por correspondência exata e reporta pendências", () => {
  const plan = planFromFixtures();
  assert.equal(plan.familiares.filter((item) => item.irmao_chave === "IRMAO ALFA").length, 3);
  assert.equal(plan.report.relacionados.naoEncontrados.includes("IRMAO INEXISTENTE"), true);
  assert.equal(plan.report.relacionados.grafiasDivergentes.some((item) => item.informado === "SERGIO TESTE"), true);
  assert.equal(plan.familiares.some((item) => item.nome === "CUNHADA BETA"), false);
  assert.equal(plan.familiares.some((item) => item.parentesco === "filho" && item.nome === "FILHO ALFA"), true);
  assert.equal(plan.familiares.some((item) => item.parentesco === "outro" && item.nome === "GENITOR ALFA"), true);
});

test("importação repetida não duplica registros", () => {
  const plan = planFromFixtures();
  const first = applyToMemory(plan, emptyStore());
  const second = applyToMemory(plan, first);
  assert.equal(second.irmaos.size, first.irmaos.size);
  assert.equal(second.familiares.size, first.familiares.size);
  assert.equal(second.casamentos.size, 1);
  assert.equal(second.eventos.size, 1);
});

test("datas completas permanecem em ISO e fundação usa a data de origem", () => {
  const plan = planFromFixtures();
  assert.equal(plan.irmaos.find((item) => item.nome === "IRMAO ALFA").data_iniciacao, "2025-01-26");
  assert.equal(plan.casamentos[0].data_casamento, "2012-01-06");
  assert.equal(plan.fundacao.data_evento, "2018-08-06");
  assert.equal(plan.fundacao.chave_idempotencia, "fundacao:2018-08-06");
});
