import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  eligibleConjuges,
  eligibleIrmaos,
  isConjugeParentesco,
  validateCasamento,
} from "../area-restrita/js/casamento-elegibilidade.js";
import { brToIso, isoToBr } from "../area-restrita/js/dates-br.js";

const IRMAO = { id: "irmao-1", nome: "IRMAO ALFA", ativo: true };
const OUTRO = { id: "irmao-2", nome: "IRMAO BETA", ativo: true };
const INATIVO = { id: "irmao-3", nome: "IRMAO GAMA", ativo: false };
const ESPOSA = { id: "fam-1", irmao_id: "irmao-1", nome: "ESPOSA ALFA", parentesco: "esposa", ativo: true };
const FILHO = { id: "fam-2", irmao_id: "irmao-1", nome: "FILHO ALFA", parentesco: "filho", ativo: true };
const PAI = { id: "fam-3", irmao_id: "irmao-1", nome: "PAI ALFA", parentesco: "pai", ativo: true };
const MAE = { id: "fam-4", irmao_id: "irmao-1", nome: "MAE ALFA", parentesco: "mae", ativo: true };
const OUTRO_FAM = { id: "fam-5", irmao_id: "irmao-1", nome: "OUTRO ALFA", parentesco: "outro", ativo: true };
const ESPOSA_OUTRO = { id: "fam-6", irmao_id: "irmao-2", nome: "ESPOSA BETA", parentesco: "esposa", ativo: true };
const CASADA = { id: "fam-7", irmao_id: "irmao-1", nome: "ESPOSA CASADA", parentesco: "esposa", ativo: true };

test("filho, pai, mãe e outro não aparecem como cônjuge", () => {
  const list = eligibleConjuges({
    familiares: [ESPOSA, FILHO, PAI, MAE, OUTRO_FAM],
    casamentos: [],
    irmaoId: "irmao-1",
  });
  assert.equal(isConjugeParentesco("filho"), false);
  assert.equal(isConjugeParentesco("pai"), false);
  assert.equal(isConjugeParentesco("mae"), false);
  assert.equal(isConjugeParentesco("outro"), false);
  assert.deepEqual(list.map((row) => row.id), ["fam-1"]);
});

test("esposa disponível aparece e esposa já casada não aparece", () => {
  const list = eligibleConjuges({
    familiares: [ESPOSA, CASADA],
    casamentos: [{ id: "c1", irmao_id: "irmao-9", conjuge_id: "fam-7", ativo: true }],
    irmaoId: "irmao-1",
  });
  assert.equal(list.some((row) => row.id === "fam-1"), true);
  assert.equal(list.some((row) => row.id === "fam-7"), false);
});

test("Irmão já casado ou inativo não aparece", () => {
  const list = eligibleIrmaos({
    irmaos: [IRMAO, OUTRO, INATIVO],
    casamentos: [{ id: "c1", irmao_id: "irmao-1", conjuge_id: "fam-1", ativo: true }],
  });
  assert.deepEqual(list.map((row) => row.id), ["irmao-2"]);
});

test("esposa de outro Irmão não pode ser vinculada", () => {
  const check = validateCasamento({
    irmao: IRMAO,
    familiar: ESPOSA_OUTRO,
    casamentos: [],
  });
  assert.equal(check.ok, false);
});

test("backend rejeita casamento duplicado e cônjuge duplicado", () => {
  assert.equal(validateCasamento({
    irmao: IRMAO,
    familiar: ESPOSA,
    casamentos: [{ id: "c1", irmao_id: "irmao-1", conjuge_id: "fam-x", ativo: true }],
  }).ok, false);
  assert.equal(validateCasamento({
    irmao: OUTRO,
    familiar: ESPOSA_OUTRO,
    casamentos: [{ id: "c1", irmao_id: "irmao-99", conjuge_id: "fam-6", ativo: true }],
  }).ok, false);
});

test("desativação libera novo vínculo", () => {
  const list = eligibleIrmaos({
    irmaos: [IRMAO],
    casamentos: [{ id: "c1", irmao_id: "irmao-1", conjuge_id: "fam-1", ativo: false }],
  });
  assert.equal(list[0].id, "irmao-1");
  const spouses = eligibleConjuges({
    familiares: [ESPOSA],
    casamentos: [{ id: "c1", irmao_id: "irmao-1", conjuge_id: "fam-1", ativo: false }],
    irmaoId: "irmao-1",
  });
  assert.equal(spouses[0].id, "fam-1");
});

test("datas internas usam ISO e a interface lê dd/mm/aaaa", () => {
  assert.equal(brToIso("24/08/2026"), "2026-08-24");
  assert.equal(isoToBr("2026-08-24"), "24/08/2026");
  assert.equal(brToIso("31/02/2026"), null);
});

test("migration cria índice único parcial de casamento ativo", () => {
  const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../supabase/migrations/202608200002_casamento_integridade.sql"), "utf8");
  assert.match(sql, /casamentos_irmao_ativo_key/);
  assert.match(sql, /casamentos_conjuge_ativo_key/);
  assert.match(sql, /parentesco not in \('esposa', 'companheira'\)/);
});
