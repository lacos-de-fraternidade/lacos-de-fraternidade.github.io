import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { navItems } from "../area-restrita/js/shell.js";
import {
  completeYears,
  ensureUpcomingMonth,
  filterByName,
  groupByMonth,
  monthRemainingCopy,
  occurredInMonth,
  relativeDayLabel,
  remainingInMonth,
  upcomingByMonthDay,
  yearsLabel,
} from "../area-restrita/js/datas.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

test("menu muda conforme o perfil e não depende de CSS para ocultar itens", () => {
  const irmao = navItems({ perfil: "irmao" }, "../").map((item) => item.label);
  const staff = navItems({ perfil: "secretario" }, "../").map((item) => item.label);
  const admin = navItems({ perfil: "administrador" }, "../").map((item) => item.label);
  assert.deepEqual(irmao, ["Início", "Aniversários", "Datas Maçônicas", "Calendário"]);
  assert.equal(staff.includes("Gestão de Irmãos"), true);
  assert.equal(staff.includes("Convites"), true);
  assert.equal(staff.includes("Eventos"), true);
  assert.equal(staff.includes("Comunicados"), true);
  assert.equal(staff.includes("Logs"), false);
  assert.equal(admin.includes("Logs"), true);
  assert.equal(admin.includes("Configurações"), true);
  assert.equal(admin.includes("Cadastro institucional"), false);
  assert.equal(admin.includes("Gerenciar membros"), false);
});

test("dashboard escolhe os próximos aniversários sem idade", () => {
  const from = new Date(2026, 7, 20);
  const items = upcomingByMonthDay([
    { nome: "Irmão Alfa", dia: 24, mes: 8 },
    { nome: "Irmão Beta", dia: 13, mes: 8 },
    { nome: "Irmão Gama", dia: 1, mes: 9 },
  ], 5, from);
  assert.equal(items[0].nome, "Irmão Alfa");
  assert.equal(items[1].nome, "Irmão Gama");
  assert.equal(relativeDayLabel(8, 20, from), "Hoje");
  assert.equal(relativeDayLabel(8, 21, from), "Amanhã");
  assert.equal(read("area-restrita/home.js").includes("idade_informada"), false);
  assert.equal(read("area-restrita/home.js").includes("noticePeriodLabel"), false);
  assert.match(read("area-restrita/home.js"), /Ler comunicado/);
  assert.match(read("area-restrita/home.js"), /session-notice/);
  assert.doesNotMatch(read("area-restrita/home.js"), /Há um comunicado importante para esta sessão/);
});

test("página de aniversários agrupa por mês e filtro de nome funciona", () => {
  const groups = groupByMonth([
    { nome: "Alfa", dia: 13, mes: 8, categoria: "irmao" },
    { nome: "Beta", dia: 24, mes: 8, categoria: "irmao" },
    { nome: "Gama", dia: 9, mes: 5, categoria: "cunhada" },
  ]);
  assert.equal(groups[0].titulo, "Maio");
  assert.equal(groups[1].registros.length, 2);
  assert.equal(filterByName(groups[1].registros, "beta")[0].nome, "Beta");
  assert.equal(filterByName([{ nome: "Fábio Boa Morte" }], "fabio")[0].nome, "Fábio Boa Morte");
  assert.match(read("area-restrita/aniversarios/index.html"), /filtro-categoria/);
  assert.match(read("area-restrita/aniversarios/index.html"), /mes-anterior/);
  assert.match(read("area-restrita/aniversarios/index.html"), /Aniversários e celebrações/);
  assert.match(read("area-restrita/aniversarios/index.html"), /Datas dos Irmãos e familiares autorizados/);
  assert.match(read("area-restrita/aniversarios/aniversarios.js"), /Nenhuma celebração encontrada para este período/);
  assert.match(read("area-restrita/aniversarios/aniversarios.js"), /Limpar filtros/);
  assert.match(read("area-restrita/aniversarios/aniversarios.js"), /CATEGORY_ORDER/);
  assert.match(read("area-restrita/aniversarios/index.html"), /Mostrar/);
  assert.match(read("area-restrita/css/area.css"), /\.birthdays-page \.month-nav/);
});

test("aniversários passados saem da lista e o mês avança se estiver vazio", () => {
  const from = new Date(2026, 7, 21);
  const items = [
    { nome: "Denis Batista Cipriano", dia: 13, mes: 8 },
    { nome: "Paulo Henrique Braga", dia: 24, mes: 8, proprio: true, categoria: "irmao" },
    { nome: "Setembro", dia: 5, mes: 9 },
  ];
  const remaining = remainingInMonth(items, 8, 2026, from);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].nome, "Paulo Henrique Braga");
  assert.equal(occurredInMonth(items, 8, 2026, from)[0].nome, "Denis Batista Cipriano");
  assert.equal(ensureUpcomingMonth({ month: 8, year: 2026 }, items.filter((item) => item.mes !== 8), from).month, 9);
  assert.equal(ensureUpcomingMonth({ month: 8, year: 2026 }, items.filter((item) => item.dia !== 24), from).month, 8);
  assert.equal(monthRemainingCopy(2, false, "agosto"), "Ainda restam 2 aniversários em agosto.");
  assert.equal(monthRemainingCopy(2, true, "agosto"), "Ainda restam 2 aniversários em agosto. O próximo será o seu.");
  assert.equal(monthRemainingCopy(1, false, "agosto"), "Ainda resta 1 aniversário em agosto.");
  assert.match(read("area-restrita/aniversarios/aniversarios.js"), /já realizados neste mês/);
});

test("datas maçônicas usam caminhada e o mesmo padrão mensal dos aniversários", () => {
  const from = new Date(2026, 7, 20);
  assert.equal(completeYears("2025-08-15", from), 1);
  assert.equal(completeYears("2024-08-15", from), 2);
  assert.equal(completeYears("2026-04-26", from), 0);
  assert.equal(yearsLabel(1, "iniciação"), "1 ano de iniciação");
  assert.equal(yearsLabel(2, "iniciação"), "2 anos de iniciação");
  assert.match(read("area-restrita/iniciacoes/index.html"), /eyebrow">Datas Maçônicas/);
  assert.match(read("area-restrita/iniciacoes/index.html"), /<h1>Aniversários de Iniciação<\/h1>/);
  assert.match(read("area-restrita/iniciacoes/index.html"), /Celebre os anos de caminhada maçônica dos Irmãos da Loja/);
  assert.match(read("area-restrita/iniciacoes/iniciacoes.js"), /Ver datas já comemoradas neste mês/);
  assert.match(read("area-restrita/iniciacoes/iniciacoes.js"), /em breve/);
  assert.match(read("area-restrita/iniciacoes/iniciacoes.js"), /Iniciado em/);
  assert.match(read("area-restrita/iniciacoes/iniciacoes.js"), /Mês atual/);
  assert.match(read("area-restrita/iniciacoes/iniciacoes.js"), /Tentar novamente|showError/);
  assert.match(read("area-restrita/js/ui-state.js"), /empty-state/);
});
