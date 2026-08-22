import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { daysUntil, relativeDayLabel, shiftMonth, upcomingByMonthDay } from "../area-restrita/js/datas.js";
import { passwordRequirements, strengthLabel } from "../area-restrita/js/password.js";
import {
  birthdayMeta,
  daquiALabel,
  displayLodgeName,
  displayMainName,
  displayPersonName,
  firstGivenName,
  highlightCopy,
  initiationMeta,
  isOwnIrmao,
  nearestPersonalHighlight,
  personalUpcomingDates,
} from "../area-restrita/js/vinculo.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const OWN_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const FROM = new Date(2026, 7, 20);

function activeProfile(overrides = {}) {
  return {
    irmao_id: OWN_ID,
    ativo: true,
    conta_ativada: true,
    nome: "Irmão Fictício",
    ...overrides,
  };
}

test("usuário autenticado com irmao_id reconhece o próprio aniversário", () => {
  const profile = activeProfile();
  assert.equal(isOwnIrmao(profile, OWN_ID), true);
  const items = upcomingByMonthDay([
    { id: OWN_ID, nome: "IRMAO FICTICIO ALFA", dia: 24, mes: 8, proprio: isOwnIrmao(profile, OWN_ID) },
    { id: OTHER_ID, nome: "IRMAO FICTICIO BETA", dia: 25, mes: 8, proprio: isOwnIrmao(profile, OTHER_ID) },
  ], 3, FROM);
  assert.equal(items[0].proprio, true);
  assert.equal(items[1].proprio, false);
  assert.equal(items[0].days, 4);
  assert.equal(birthdayMeta(items[0]), "Seu aniversário · em 4 dias");
  assert.equal(birthdayMeta(items[1]), "em 5 dias");
});

test("outro aniversário não é identificado como próprio", () => {
  assert.equal(isOwnIrmao(activeProfile(), OTHER_ID), false);
  assert.equal(isOwnIrmao(activeProfile({ irmao_id: null }), OWN_ID), false);
});

test("aniversário hoje usa mensagem diferenciada com o primeiro nome", () => {
  const today = new Date(2026, 7, 24);
  const irmao = {
    id: OWN_ID,
    nome: "IRMAO FICTICIO DA SILVA",
    dia_nascimento: 24,
    mes_nascimento: 8,
    exibir_aniversario: true,
  };
  const dates = personalUpcomingDates({ irmao, from: today });
  const copy = highlightCopy(dates[0], firstGivenName(irmao.nome));
  assert.equal(dates[0].days, 0);
  assert.equal(copy.title, "Feliz aniversário, Irmao!");
  assert.equal(copy.dateLabel, "24 de agosto");
});

test("aniversário amanhã e após a virada do ano", () => {
  assert.equal(relativeDayLabel(8, 21, FROM), "Amanhã");
  assert.equal(daquiALabel(1), "Amanhã");
  assert.equal(daysUntil(1, 2, new Date(2026, 11, 30)), 3);
  const wrap = personalUpcomingDates({
    irmao: { nome: "Irmão Fictício", dia_nascimento: 2, mes_nascimento: 1, exibir_aniversario: true },
    from: new Date(2026, 11, 30),
  });
  assert.equal(wrap[0].days, 3);
  const copy = highlightCopy(wrap[0], "Irmão");
  assert.equal(copy.title, "Seu aniversário está chegando!");
  assert.equal(copy.relative, "Daqui a 3 dias");
});

test("iniciação do próprio usuário é destacada sem comparar nomes", () => {
  const irmao = {
    id: OWN_ID,
    nome: "IRMAO FICTICIO ALFA",
    data_iniciacao: "2018-09-17",
    exibir_iniciacao: true,
  };
  const dates = personalUpcomingDates({ irmao, from: FROM });
  const copy = highlightCopy(dates[0], "Irmao");
  assert.equal(dates[0].tipo, "iniciacao");
  assert.match(copy.title, /iniciação/);
  assert.equal(isOwnIrmao(activeProfile(), OWN_ID), true);
  assert.equal(initiationMeta({ data: "2018-09-17", proprio: true, from: FROM }), "Seu aniversário de iniciação · 8 anos de caminhada maçônica");
  const home = read("area-restrita/home.js");
  assert.equal(home.includes("nome ==="), false);
  assert.equal(home.includes("nomeUsuario"), false);
  assert.match(home, /ctx\.profile\.irmao_id/);
});

test("usuário sem cadastro institucional vinculado não gera destaque pessoal", () => {
  const profile = activeProfile({ irmao_id: null });
  assert.equal(isOwnIrmao(profile, OWN_ID), false);
  assert.equal(nearestPersonalHighlight(personalUpcomingDates({ irmao: null })), null);
});

test("usuário desativado não é tratado como dono do registro", () => {
  assert.equal(isOwnIrmao(activeProfile({ ativo: false }), OWN_ID), false);
  assert.equal(isOwnIrmao(activeProfile({ conta_ativada: false }), OWN_ID), false);
});

test("destaque de 20/08/2026 para 24/08 calcula 4 dias dinamicamente", () => {
  const irmao = {
    nome: "IRMAO FICTICIO ALFA",
    dia_nascimento: 24,
    mes_nascimento: 8,
    exibir_aniversario: true,
  };
  const next = nearestPersonalHighlight(personalUpcomingDates({ irmao, from: FROM }));
  const copy = highlightCopy(next, firstGivenName(irmao.nome));
  assert.equal(next.days, 4);
  assert.equal(copy.title, "Seu aniversário está chegando!");
  assert.equal(copy.dateLabel, "24 de agosto");
  assert.equal(copy.relative, "Daqui a 4 dias");
  assert.equal(displayPersonName("PAULO HENRIQUE BRAGA DA SILVA"), "Paulo Henrique Braga da Silva");
  assert.equal(displayMainName("PAULO HENRIQUE BRAGA DA SILVA"), "Paulo Henrique Braga");
  assert.equal(displayLodgeName("ARLS LAÇOS DE FRATERNIDADE Nº 63"), "ARLS Laços de Fraternidade nº 63");
});

test("navegação de mês e requisitos de senha não alteram a política", () => {
  assert.equal(shiftMonth(8, 1), 9);
  assert.equal(shiftMonth(1, -1), 12);
  assert.equal(strengthLabel(2), "Boa");
  const reqs = passwordRequirements("Ab1!");
  assert.deepEqual(reqs.map((item) => item.id), ["len", "upper", "lower", "num", "special"]);
  assert.equal(reqs.find((item) => item.id === "len").ok, false);
  assert.equal(passwordRequirements("Abcdefghij1!").every((item) => item.ok), true);
});

test("migration cria irmao_id sem mudar o login", () => {
  const sql = read("supabase/migrations/202608200001_vinculo_irmao_institucional.sql");
  assert.match(sql, /irmaos_autorizados\s+add column if not exists irmao_id/);
  assert.match(sql, /references public\.irmaos \(id\)/);
  assert.equal(sql.includes("login-with-cim"), false);
  assert.equal(read("area-restrita/js/guard.js").includes("irmao_id"), true);
  assert.match(read("area-restrita/js/guard.js"), /PUBLIC_ABOUT_URL = "\/sobre\.html"/);
});
