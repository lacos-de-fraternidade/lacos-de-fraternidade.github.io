import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { authorizeGerenciarAcao } from "../area-restrita/js/perfis.js";
import {
  formatCafeTime,
  normalizeCafe,
  normalizePautaItems,
  normalizeSessionGrau,
  sessionProgramItems,
  sessionTypeLabel,
} from "../area-restrita/js/sessoes.js";
import { nextSessionCardCopy } from "../area-restrita/js/calendario-agenda.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const staff = {
  irmao: { ativo: true, conta_ativada: true, perfil: "irmao" },
  secretario: { ativo: true, conta_ativada: true, perfil: "secretario" },
  veneravel_mestre: { ativo: true, conta_ativada: true, perfil: "veneravel_mestre" },
  administrador: { ativo: true, conta_ativada: true, perfil: "administrador" },
};

function completeSession(overrides = {}) {
  return {
    id: "sessao-admin-1",
    titulo: "Sessão Ordinária",
    tipo_evento: "sessao_ordinaria",
    inicia_em: "2026-09-09T22:30:00.000Z",
    presenca_obrigatoria: true,
    grau: 2,
    cafe_fraternal: true,
    cafe_horario: "18:15",
    pauta: [
      { titulo: "Abertura dos trabalhos", ordem: 1 },
      { titulo: "Expediente", ordem: 2 },
    ],
    ...overrides,
  };
}

test("TEST01 perfil autorizado monta sessão completa", () => {
  const session = completeSession();
  assert.equal(authorizeGerenciarAcao(staff.secretario, "salvar_evento").ok, true);
  assert.equal(session.titulo, "Sessão Ordinária");
  assert.equal(session.tipo_evento, "sessao_ordinaria");
  assert.equal(session.grau, 2);
  assert.equal(session.cafe_fraternal, true);
  assert.equal(session.cafe_horario, "18:15");
  assert.equal(session.presenca_obrigatoria, true);
  assert.equal(session.pauta.length, 2);
});

test("TEST02 leitura devolve os mesmos dados persistidos", () => {
  const session = completeSession();
  const program = sessionProgramItems({ ...session, categoria: "sessao" });
  assert.deepEqual(program, [
    "Café fraternal às 18h15",
    "Sessão no grau 2",
    "Abertura dos trabalhos",
    "Expediente",
  ]);
  assert.equal(sessionTypeLabel(session.tipo_evento), "Sessão ordinária");
});

test("TEST03 edição preserva a identidade da sessão", () => {
  const created = completeSession();
  const edited = completeSession({
    id: created.id,
    titulo: "Sessão Magna",
    tipo_evento: "sessao_magna",
    grau: 3,
  });
  assert.equal(edited.id, created.id);
  assert.equal(edited.titulo, "Sessão Magna");
  assert.notEqual(edited.tipo_evento, created.tipo_evento);
});

test("TEST04 horário diferente de 19h30 é preservado", () => {
  const when = new Date(2026, 8, 9, 20, 15);
  const session = completeSession({ inicia_em: when.toISOString() });
  const parsed = new Date(session.inicia_em);
  assert.equal(parsed.getHours(), 20);
  assert.equal(parsed.getMinutes(), 15);
});

test("TEST05 sem café não mantém horário inconsistente", () => {
  assert.deepEqual(normalizeCafe(false, "18:30"), { cafe_fraternal: false, cafe_horario: null });
  assert.deepEqual(sessionProgramItems({
    categoria: "sessao",
    cafe_fraternal: false,
    cafe_horario: "18:30",
    grau: 1,
  }), ["Sessão no grau 1"]);
});

test("TEST06 pauta adiciona múltiplos itens", () => {
  const pauta = normalizePautaItems(["Abertura", { titulo: "Expediente" }, { titulo: "Encerramento", ordem: 9 }]);
  assert.equal(pauta.length, 3);
  assert.deepEqual(pauta.map((item) => item.titulo), ["Abertura", "Expediente", "Encerramento"]);
});

test("TEST07 ordem dos itens é persistida", () => {
  const pauta = normalizePautaItems([
    { titulo: "Terceiro", ordem: 3 },
    { titulo: "Primeiro", ordem: 1 },
    { titulo: "Segundo", ordem: 2 },
  ]);
  assert.deepEqual(pauta, [
    { titulo: "Primeiro", ordem: 1 },
    { titulo: "Segundo", ordem: 2 },
    { titulo: "Terceiro", ordem: 3 },
  ]);
});

test("TEST08 item da pauta é editado", () => {
  const pauta = normalizePautaItems([
    { titulo: "Abertura", ordem: 1 },
    { titulo: "Expediente revisado", ordem: 2 },
  ]);
  assert.equal(pauta[1].titulo, "Expediente revisado");
});

test("TEST09 remover item não afeta os demais", () => {
  const remaining = normalizePautaItems([
    { titulo: "Abertura", ordem: 1 },
    { titulo: "Encerramento", ordem: 3 },
  ]);
  assert.deepEqual(remaining.map((item) => item.titulo), ["Abertura", "Encerramento"]);
  assert.equal(remaining[1].ordem, 2);
});

test("TEST10 irmão não escreve sessão", () => {
  assert.equal(authorizeGerenciarAcao(staff.irmao, "salvar_evento").status, 403);
  assert.equal(authorizeGerenciarAcao(staff.irmao, "cancelar_evento").status, 403);
});

test("TEST11 secretario consegue gerir", () => {
  assert.equal(authorizeGerenciarAcao(staff.secretario, "salvar_evento").ok, true);
  assert.equal(authorizeGerenciarAcao(staff.secretario, "listar_eventos").ok, true);
});

test("TEST12 veneravel_mestre consegue gerir", () => {
  assert.equal(authorizeGerenciarAcao(staff.veneravel_mestre, "salvar_evento").ok, true);
  assert.equal(authorizeGerenciarAcao(staff.veneravel_mestre, "gerar_sessoes").ok, true);
});

test("TEST13 administrador consegue gerir", () => {
  assert.equal(authorizeGerenciarAcao(staff.administrador, "salvar_evento").ok, true);
  assert.equal(authorizeGerenciarAcao(staff.administrador, "cancelar_evento").ok, true);
});

test("TEST14 experiência do Irmão usa persistência", () => {
  const when = new Date(2026, 8, 9, 20, 15);
  const card = nextSessionCardCopy({
    categoria: "sessao",
    titulo: "Sessão Ordinária",
    dia: 9,
    mes: 9,
    year: 2026,
    when,
    horario: "20h15",
    loja: "ARLS Laços de Fraternidade 357 nº 251",
    presencaObrigatoria: true,
    cafe_fraternal: true,
    cafe_horario: "18:15",
    grau: 2,
    pauta: [{ titulo: "Expediente", ordem: 1 }],
  });
  assert.equal(card.eventLabel, "Sessão Ordinária · 20h15");
  assert.equal(card.presence, "Presença necessária");
  assert.deepEqual(card.program, [
    "Café fraternal às 18h15",
    "Sessão no grau 2",
    "Expediente",
  ]);
  assert.equal(formatCafeTime("18:15:00"), "18h15");
  assert.equal(normalizeSessionGrau(4), undefined);
});

test("TEST15 geração ordinária e consulta não foram removidas", () => {
  const sql = read("supabase/migrations/20260904214221_completar_sessoes.sql");
  assert.match(sql, /private\.gerar_sessoes_ordinarias/);
  assert.match(sql, /time '19:30'/);
  assert.match(sql, /chave_idempotencia/);
  assert.match(sql, /excepcional is not true/);
  assert.match(read("supabase/functions/_shared/gestao.ts"), /gerar_sessoes_ordinarias/);
  assert.match(read("area-restrita/gestao/gestao.js"), /cafe_fraternal/);
  assert.match(read("area-restrita/home.js"), /sessoes_pauta_itens/);
});
