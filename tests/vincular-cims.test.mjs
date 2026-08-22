import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCimVinculo,
  diagnoseCimVinculo,
  normalizeNomeVinculo,
} from "../scripts/lib/vincular-cims.mjs";
import { filterGestaoBrothers, accessStatus, cimLabel } from "../area-restrita/js/gestao-irmaos.js";
import { matchesBrotherQuery } from "../area-restrita/js/comunicados.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");
const gestao = read("supabase/functions/_shared/gestao.ts");
const gitignore = read(".gitignore");

const FIXTURE_CIMS = [
  ["IRMAO ALFA", "100001"],
  ["DIOGO PAULO TEOTONIO", "100002"],
  ["PAULO HENRIQUE BRAGA DA SILVA", "100003"],
  ["SERGIO TESTE", "100004"],
];

function maskCim(cim) {
  if (!cim) return "";
  if (cim.length <= 4) return "••••";
  return `${cim.slice(0, 2)}${"•".repeat(Math.max(2, cim.length - 4))}${cim.slice(-2)}`;
}

function sampleIrmaos() {
  return FIXTURE_CIMS.map(([nome, cim], index) => ({
    id: `id-${index + 1}`,
    nome: index === 1 ? "Diogo Paulo Teotônio" : nome.replace(/\s+/g, " ").toLocaleLowerCase("pt-BR").replace(/(^|\s)\S/g, (part) => part.toLocaleUpperCase("pt-BR")),
    cim: nome === "PAULO HENRIQUE BRAGA DA SILVA" ? String(cim) : null,
    email: nome === "PAULO HENRIQUE BRAGA DA SILVA" ? "paulo@loja.org" : null,
  }));
}

test("lista fictícia de vínculo tem CIM como texto", () => {
  assert.equal(FIXTURE_CIMS.length, 4);
  assert.equal(new Set(FIXTURE_CIMS.map(([, cim]) => cim)).size, 4);
  for (const [, cim] of FIXTURE_CIMS) {
    assert.equal(typeof cim, "string");
    assert.match(cim, /^[0-9]{4,12}$/);
  }
});

test("nome com acento corresponde ao nome normalizado", () => {
  assert.equal(normalizeNomeVinculo("  Paulo   Henrique Braga da Silva "), "PAULO HENRIQUE BRAGA DA SILVA");
  assert.equal(normalizeNomeVinculo("Diogo Paulo Teotônio"), normalizeNomeVinculo("DIOGO PAULO TEOTONIO"));
  assert.equal(normalizeNomeVinculo("Sérgio Teste"), "SERGIO TESTE");
});

test("atualiza CIM do nome correspondente e aceita execução repetida", () => {
  const first = applyCimVinculo(FIXTURE_CIMS, sampleIrmaos());
  assert.equal(first.atualizados, 3);
  assert.equal(first.plan.totais.encontrados, 4);
  assert.equal(first.plan.totais.atualizados, 1);
  assert.deepEqual(first.plan.totais.naoEncontrados, []);
  const paulo = first.irmaos.find((row) => normalizeNomeVinculo(row.nome) === "PAULO HENRIQUE BRAGA DA SILVA");
  assert.equal(paulo.cim, "100003");
  const diogo = first.irmaos.find((row) => normalizeNomeVinculo(row.nome) === "DIOGO PAULO TEOTONIO");
  assert.equal(diogo.cim, "100002");

  const second = applyCimVinculo(FIXTURE_CIMS, first.irmaos);
  assert.equal(second.atualizados, 0);
  assert.equal(second.plan.totais.atualizados, 4);
  assert.equal(second.irmaos.filter((row) => row.cim).length, 4);
});

test("CIM existente e correta permanece igual", () => {
  const irmaos = sampleIrmaos();
  const before = irmaos.find((row) => row.cim === "100003");
  const { irmaos: next } = applyCimVinculo(FIXTURE_CIMS, irmaos);
  const after = next.find((row) => row.id === before.id);
  assert.equal(after.cim, "100003");
  assert.equal(after.email, before.email);
});

test("CIM existente e divergente interrompe a operação", () => {
  const irmaos = sampleIrmaos();
  irmaos[0].cim = "000001";
  assert.throws(() => applyCimVinculo(FIXTURE_CIMS, irmaos), /CIM existente e diferente/);
  const plan = diagnoseCimVinculo(FIXTURE_CIMS, irmaos);
  assert.equal(plan.ok, false);
  assert.equal(irmaos[0].cim, "000001");
});

test("CIM já usada por outro membro interrompe a operação", () => {
  const irmaos = sampleIrmaos();
  irmaos.push({ id: "outro", nome: "Irmão Visitante", cim: "100001" });
  assert.throws(() => applyCimVinculo(FIXTURE_CIMS, irmaos), /já usada por outro Irmão/);
});

test("nome inexistente não gera novo Irmão", () => {
  const irmaos = sampleIrmaos().slice(1);
  const plan = diagnoseCimVinculo(FIXTURE_CIMS, irmaos);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.totais.naoEncontrados, ["IRMAO ALFA"]);
  const { irmaos: next, atualizados } = applyCimVinculo(FIXTURE_CIMS, irmaos);
  assert.equal(next.length, irmaos.length);
  assert.equal(atualizados, 2);
  assert.equal(next.some((row) => normalizeNomeVinculo(row.nome) === "IRMAO ALFA"), false);
});

test("dois nomes normalizados iguais interrompem a operação", () => {
  const irmaos = [
    { id: "a", nome: "Sérgio Teste", cim: null },
    { id: "b", nome: "Sergio Teste", cim: null },
  ];
  assert.throws(
    () => applyCimVinculo([["SÉRGIO TESTE", "100004"]], irmaos),
    /mais de uma correspondência/,
  );
});

test("lista oficial de CIM permanece fora do repositório e a gestão mascara o valor", () => {
  assert.match(gitignore, /202608220002_vincular_cims_irmaos\.sql/);
  assert.match(gitignore, /auditar-vinculo-cims\.sql/);
  assert.doesNotMatch(read("scripts/lib/vincular-cims.mjs"), /OFFICIAL_BROTHER_CIMS/);
  assert.match(gestao, /acesso\?\.cim \|\| irmao\?\.cim/);
  assert.match(gestao, /cim_mascarada: maskCim\(cim\)/);
});

test("busca por CIM na Gestão localiza o registro mascarado e sem acesso", () => {
  const { irmaos } = applyCimVinculo(FIXTURE_CIMS, sampleIrmaos());
  const rows = irmaos.map((irmao) => ({
    irmao_id: irmao.id,
    nome: irmao.nome,
    cim_mascarada: maskCim(irmao.cim),
    acesso_id: irmao.cim === "100003" ? "acesso-paulo" : null,
    conta_ativada: irmao.cim === "100003",
    situacao: "ativo",
  }));
  const alfa = rows.find((row) => normalizeNomeVinculo(row.nome) === "IRMAO ALFA");
  assert.equal(cimLabel(alfa), "CIM 10••01");
  assert.equal(matchesBrotherQuery(alfa, "100001"), true);
  assert.equal(filterGestaoBrothers(rows, { q: "100001" })[0].irmao_id, alfa.irmao_id);
  assert.equal(accessStatus(alfa).id, "sem_acesso");
  assert.equal(filterGestaoBrothers(rows, { acessoStatus: "sem_acesso" }).length, 3);
  assert.equal(JSON.stringify(alfa).includes("100001"), false);
});
