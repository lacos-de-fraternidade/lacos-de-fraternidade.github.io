import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  birthdayCardCopy,
  birthdayStatLabel,
  buildProfileView,
  caminhadaDurationLabel,
  completeMonths,
  maskCim,
  membershipSinceLabel,
  profileInitials,
  profileTimeline,
  welcomeCopy,
} from "../area-restrita/js/perfil-painel.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = new Date(2026, 7, 22);

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("iniciais, CIM e caminhada usam o formato do perfil", () => {
  assert.equal(profileInitials("Paulo Henrique Braga da Silva"), "PH");
  assert.equal(profileInitials("Paulo"), "PA");
  assert.equal(maskCim("12345678"), "12••••78");
  assert.equal(completeMonths("2026-04-26", from), 4);
  assert.equal(caminhadaDurationLabel("2026-04-26", from), "4 meses de caminhada");
  assert.equal(caminhadaDurationLabel("2024-08-22", from), "2 anos de caminhada");
  assert.equal(membershipSinceLabel("2026-04-26", from), "4 meses");
});

test("cartão de aniversário distingue o que falta do que já passou", () => {
  const upcoming = birthdayCardCopy({ dia_nascimento: 24, mes_nascimento: 8 }, from);
  assert.equal(upcoming.dateLabel, "24 de agosto");
  assert.equal(upcoming.relative, "faltam 2 dias");
  const today = birthdayCardCopy({ dia_nascimento: 22, mes_nascimento: 8 }, from);
  assert.equal(today.relative, "É hoje");
  const past = birthdayCardCopy({ dia_nascimento: 19, mes_nascimento: 8 }, from);
  assert.equal(past.relative, "foi há 3 dias");
  assert.equal(birthdayStatLabel({ dia_nascimento: 24, mes_nascimento: 8 }, from), "Próximo em 2 dias");
});

test("linha do tempo e boas-vindas montam o painel sem inventar dados", () => {
  const nextSession = { when: new Date(2026, 8, 9, 19, 30), titulo: "Sessão Ordinária", tipo_evento: "sessao_ordinaria" };
  const welcome = welcomeCopy({
    profile: { nome: "Paulo Henrique Braga", ultimo_acesso_em: "2026-08-21T20:00:00.000Z" },
    nextSession,
  });
  assert.equal(welcome.kicker, "Bem-vindo de volta,");
  assert.equal(welcome.name, "Paulo.");
  assert.equal(welcome.sessionWhen, "09/09 • 19h30");
  const timeline = profileTimeline({
    irmao: { data_iniciacao: "2026-04-26", loja_iniciacao: "ARLS Laços de Fraternidade 357 nº 251", dia_nascimento: 24, mes_nascimento: 8 },
    nextSession,
    from,
  });
  assert.equal(timeline[0].title, "Iniciado na ARLS Laços de Fraternidade 357 nº 251");
  assert.equal(timeline[1].title, "Próximo aniversário");
  assert.equal(timeline[2].title, "Próxima sessão");
});

test("visão do perfil preenche os quatro cards e as estatísticas", () => {
  const view = buildProfileView({
    profile: {
      nome: "Paulo Henrique Braga",
      email: "paulo@example.com",
      perfil: "administrador",
      cim: "12345678",
      ativo: true,
      conta_ativada: true,
      ultimo_acesso_em: "2026-08-21T20:00:00.000Z",
    },
    irmao: {
      nome: "Paulo Henrique Braga",
      situacao: "ativo",
      dia_nascimento: 24,
      mes_nascimento: 8,
      data_iniciacao: "2026-04-26",
      loja_iniciacao: "ARLS Laços de Fraternidade 357 nº 251",
    },
    eventos: [{
      titulo: "Sessão Ordinária",
      tipo_evento: "sessao_ordinaria",
      inicia_em: "2026-08-26T22:30:00.000Z",
      publicado: true,
      ativo: true,
      presenca_obrigatoria: false,
    }],
    from,
  });
  assert.equal(view.identity.initials, "PH");
  assert.equal(view.identity.role, "Administrador");
  assert.equal(view.account[1].value, "Administrador");
  assert.equal(view.institutional.find((item) => item.label === "Cargo").value, "Sem cargo institucional");
  assert.equal(view.identity.status, "Conta ativa");
  assert.equal(view.account[2].value, "12••••78");
  assert.match(view.dates[2].value, /caminhada/);
  assert.equal(view.security.sessionsValue, "Em breve");
  assert.equal(view.nextSession.eventLabel, "Sessão Ordinária");
  assert.equal(view.nextSession.presence, "Presença recomendada");
  assert.equal(view.stats[1].label, "Sessões futuras");
});

test("página do perfil usa o layout em blocos", () => {
  assert.match(read("area-restrita/perfil/index.html"), /profile-page/);
  assert.match(read("area-restrita/perfil/index.html"), /perfil-identidade/);
  assert.match(read("area-restrita/perfil/index.html"), /perfil-boas-vindas/);
  assert.match(read("area-restrita/perfil/index.html"), /card-conta/);
  assert.match(read("area-restrita/perfil/index.html"), /card-institucional/);
  assert.match(read("area-restrita/perfil/index.html"), /card-datas/);
  assert.match(read("area-restrita/perfil/index.html"), /card-seguranca/);
  assert.match(read("area-restrita/perfil/index.html"), /perfil-timeline/);
  assert.match(read("area-restrita/perfil/perfil.js"), /buildProfileView/);
  assert.match(read("area-restrita/perfil/perfil.js"), /Minha caminhada/);
  assert.match(read("area-restrita/css/area.css"), /\.profile-hero/);
  assert.match(read("area-restrita/js/datas.js"), /email:/);
});
