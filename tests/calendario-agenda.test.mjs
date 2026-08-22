import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INSTITUTIONAL_DATES,
  institutionalDatesForCalendar,
  institutionalOccursOn,
  resolveInstitutionalDates,
} from "../area-restrita/js/datas-institucionais.js";
import {
  cellAriaLabel,
  cellLineLabel,
  cellPreview,
  emptyDayCopy,
  emptyDayHint,
  filterTriggerLabel,
  findNextSessionItem,
  formatHourBr,
  nextSessionAnchor,
  nextSessionCardCopy,
  monthContextCopy,
  monthSummaryCopy,
  monthSummaryLines,
  monthSummaryMarks,
  setCategoryHidden,
  setGroupHidden,
  shortCalendarTitle,
  CALENDAR_FILTER_GROUPS,
} from "../area-restrita/js/calendario-agenda.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

test("Dia do Maçom é data institucional recorrente em 20 de agosto", () => {
  const seed = INSTITUTIONAL_DATES.find((item) => item.chave === "dia_do_macom");
  assert.equal(seed.dia, 20);
  assert.equal(seed.mes, 8);
  assert.equal(seed.recorrencia, "anual");
  assert.equal(seed.tipo, "data_maconica");
  const items = institutionalDatesForCalendar(null);
  assert.equal(items.length, 1);
  assert.equal(items[0].categoria, "data_maconica");
  assert.equal(items[0].year, null);
  assert.equal(institutionalOccursOn(items[0], 8, 20), true);
  assert.equal(institutionalOccursOn(items[0], 8, 20), true);
  assert.equal(items[0].titulo, "Dia do Maçom");
  assert.match(items[0].descricao, /maçons brasileiros/);
  assert.equal(resolveInstitutionalDates([]).length, 0);
});

test("resumo mensal conta o Dia do Maçom à parte de iniciações e sessões", () => {
  const lines = monthSummaryLines([
    { categoria: "sessao" },
    { categoria: "sessao" },
    { categoria: "irmao" },
    { categoria: "irmao" },
    { categoria: "iniciacao" },
    { categoria: "iniciacao" },
    { categoria: "iniciacao" },
    { categoria: "data_maconica", titulo: "Dia do Maçom" },
  ]);
  assert.deepEqual(lines, [
    "2 sessões",
    "2 aniversários",
    "3 aniversários de iniciação",
    "1 data maçônica",
  ]);
  assert.equal(
    monthSummaryCopy([
      { categoria: "sessao" },
      { categoria: "sessao" },
      { categoria: "irmao" },
      { categoria: "irmao" },
      { categoria: "irmao" },
      { categoria: "iniciacao" },
      { categoria: "iniciacao" },
      { categoria: "iniciacao" },
      { categoria: "data_maconica" },
    ]),
    "2 sessões · 3 aniversários · 3 aniversários de iniciação · 1 data maçônica",
  );
  assert.equal(filterTriggerLabel(new Set()), "Todos os registros");
  assert.equal(filterTriggerLabel(setGroupHidden(new Set(), CALENDAR_FILTER_GROUPS[0], false)), "5 categorias selecionadas");
  assert.equal(filterTriggerLabel(new Set(["irmao", "cunhada", "familiar", "casamento", "iniciacao", "data_maconica"])), "Agenda da Loja");
  assert.equal(setCategoryHidden(new Set(), "irmao", false).has("irmao"), true);
  assert.deepEqual(
    monthSummaryMarks([
      { categoria: "sessao" },
      { categoria: "sessao" },
      { categoria: "irmao" },
      { categoria: "irmao" },
      { categoria: "irmao" },
      { categoria: "iniciacao" },
      { categoria: "iniciacao" },
      { categoria: "iniciacao" },
      { categoria: "data_maconica" },
    ]).map((mark) => mark.label),
    ["2 Sessões", "3 Aniversários", "3 Aniversários de Iniciação", "1 Data Maçônica"],
  );
});

test("células e painel do dia comunicam o conteúdo sem depender só de pontos", () => {
  const mason = cellPreview([{ categoria: "data_maconica", titulo: "Dia do Maçom" }]);
  assert.equal(mason.mode, "single");
  assert.equal(mason.title, "Dia do Maçom");
  const session = cellPreview([{ categoria: "sessao", titulo: "Sessão Ordinária", horario: "19h30" }]);
  assert.equal(session.time, "19h30");
  assert.equal(session.label, "Sessão Ordinária · 19h30");
  assert.equal(cellLineLabel({ titulo: "Sessão Ordinária", horario: "19h30" }), "Sessão Ordinária · 19h30");
  const many = cellPreview([
    { categoria: "irmao", titulo: "Alfa" },
    { categoria: "iniciacao", titulo: "Beta" },
    { categoria: "data_maconica", titulo: "Dia do Maçom" },
  ]);
  assert.equal(many.mode, "overflow");
  assert.equal(many.more, 1);
  assert.equal(many.label, "+1 registro");
  assert.equal(many.lines.length, 2);
  assert.match(cellAriaLabel(26, 8, [{ titulo: "Sessão Ordinária", horario: "19h30" }], { isNext: true }), /19h30/);
  assert.match(cellAriaLabel(26, 8, [{ titulo: "Sessão Ordinária", horario: "19h30" }], { isNext: true }), /próxima sessão/);
  assert.equal(emptyDayCopy(), "Nenhum compromisso programado.");
  assert.equal(emptyDayHint(), "Aproveite este dia para organizar sua agenda para a próxima sessão.");
  assert.equal(shortCalendarTitle({ titulo: "Paulo Henrique Braga da Silva", tituloCurto: "Paulo Henrique Braga" }), "Paulo Henrique Braga");
  assert.equal(formatHourBr(new Date(2026, 7, 26, 19, 30)), "19h30");
  const sessionCopy = monthContextCopy({
    items: [{ categoria: "sessao", titulo: "Sessão Ordinária", dia: 26, mes: 8, year: 2026, horario: "19h30" }],
    view: { month: 8, year: 2026 },
    from: new Date(2026, 7, 21),
  });
  assert.equal(sessionCopy.kicker, "Próximo compromisso");
  assert.equal(sessionCopy.text, "Sessão Ordinária em 26 de agosto às 19h30.");
  const honorCopy = monthContextCopy({
    items: [{ categoria: "data_maconica", titulo: "Dia do Maçom", dia: 20, mes: 8 }],
    view: { month: 8, year: 2026 },
    from: new Date(2026, 7, 19),
  });
  assert.equal(honorCopy.kicker, "Próxima celebração");
  assert.equal(honorCopy.text, "Dia do Maçom em 20 de agosto.");
  const closedCopy = monthContextCopy({
    items: [
      { categoria: "sessao", titulo: "Sessão Ordinária", dia: 12, mes: 8, year: 2026, horario: "19h30" },
      { categoria: "irmao", titulo: "Paulo Henrique Braga", dia: 6, mes: 9 },
    ],
    view: { month: 8, year: 2026 },
    from: new Date(2026, 7, 21),
  });
  assert.match(closedCopy.text, /Não há mais compromissos previstos neste mês/);
  assert.match(closedCopy.text, /setembro/);
  const next = findNextSessionItem([
    { categoria: "sessao", titulo: "Sessão Ordinária", dia: 12, mes: 8, year: 2026, when: new Date(2026, 7, 12, 19, 30) },
    { categoria: "sessao", titulo: "Sessão Ordinária", dia: 26, mes: 8, year: 2026, when: new Date(2026, 7, 26, 19, 30) },
  ], new Date(2026, 7, 21));
  assert.equal(next.dia, 26);
  const fromSelected = nextSessionAnchor({ month: 8, year: 2026 }, 22, new Date(2026, 7, 22));
  assert.equal(fromSelected.getDate(), 22);
  const card = nextSessionCardCopy({
    categoria: "sessao",
    titulo: "Sessão Ordinária",
    dia: 26,
    mes: 8,
    year: 2026,
    horario: "19h30",
    loja: "ARLS Laços de Fraternidade 357 nº 251",
    presencaObrigatoria: false,
  });
  assert.equal(card.dateLabel, "26 de agosto");
  assert.equal(card.eventLabel, "Sessão Ordinária · 19h30");
  assert.equal(card.place, "ARLS Laços de Fraternidade 357 nº 251");
  assert.equal(card.presence, "Presença recomendada");
  assert.deepEqual(card.program, [
    "Café fraternal às 18h45",
    "Sessão no grau 1",
    "Leitura da pauta administrativa",
  ]);
  assert.equal(card.programHeading, "Na próxima sessão");
});

test("página do calendário usa o padrão visual da agenda da Loja", () => {
  assert.match(read("area-restrita/calendario/index.html"), /Agenda da Loja/);
  assert.match(read("area-restrita/calendario/index.html"), /Sessões, eventos e datas comemorativas/);
  assert.match(read("area-restrita/calendario/index.html"), /birthdays-page calendar-page/);
  assert.match(read("area-restrita/calendario/calendario.js"), /datas_institucionais/);
  assert.match(read("area-restrita/calendario/calendario.js"), /Mês atual/);
  assert.match(read("area-restrita/calendario/calendario.js"), /"Próxima"/);
  assert.match(read("area-restrita/calendario/calendario.js"), /next-session-card/);
  assert.match(read("area-restrita/calendario/calendario.js"), /calendar-event__icon/);
  assert.match(read("area-restrita/calendario/calendario.js"), /aria-current/);
  assert.match(read("area-restrita/calendario/calendario.js"), /cellAriaLabel/);
  assert.match(read("area-restrita/calendario/calendario.js"), /next-session-card__program/);
  assert.doesNotMatch(read("area-restrita/js/sessoes.js"), /Reunião de oficiais/);
  assert.match(read("area-restrita/calendario/index.html"), /contexto-mes/);
  assert.match(read("area-restrita/calendario/index.html"), /calendar-period/);
  assert.match(read("area-restrita/calendario/index.html"), /calendar-toolbar/);
  assert.match(read("area-restrita/calendario/index.html"), /calendar-filter-trigger/);
  assert.match(read("area-restrita/calendario/index.html"), />Filtro</);
  assert.doesNotMatch(read("area-restrita/calendario/calendario.js"), /Nenhum compromisso programado/);
  assert.match(read("area-restrita/css/area.css"), /border-radius: 999px/);
  assert.match(read("area-restrita/css/area.css"), /min-height: 58px/);
  assert.match(read("area-restrita/css/area.css"), /\.calendar-page \.day-agenda \{\s*margin-top: 24px;/);
  assert.match(read("area-restrita/css/area.css"), /width: 210px/);
  assert.match(read("area-restrita/css/area.css"), /flex-shrink: 0/);
  assert.doesNotMatch(read("area-restrita/js/calendario-agenda.js"), /noun: "Iniciação"/);
  assert.match(read("area-restrita/js/calendario-agenda.js"), /Aniversários de Iniciação/);
  assert.doesNotMatch(read("area-restrita/calendario/index.html"), />Iniciações</);
  assert.doesNotMatch(read("area-restrita/calendario/calendario.js"), /text-overflow: ellipsis/);
  assert.doesNotMatch(read("area-restrita/calendario/calendario.js"), /cal-chip-btn/);
  assert.match(read("supabase/migrations/202608220001_datas_institucionais.sql"), /dia_do_macom/);
  assert.match(read("supabase/migrations/202608220001_datas_institucionais.sql"), /enable row level security/);
});
