import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GESTAO_SECTIONS,
  nextSectionId,
  sectionLabel,
  sectionSwitcherModel,
  shouldHideDesktopTabs,
  visibleGestaoSections,
} from "../area-restrita/js/section-switcher.js";
import { adminNavState, applyDocumentLayout, isMobileLayout } from "../area-restrita/js/layout-mode.js";
import { ficheActions, listMenuActions } from "../area-restrita/js/gestao-irmaos.js";
import {
  cellHasLongText,
  cellMobilePreview,
  emptyDayCopy,
  emptyDayNextHeading,
  findNextSessionItem,
  nextSessionAnchor,
  nextSessionCardCopy,
} from "../area-restrita/js/calendario-agenda.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const brother = {
  irmao_id: "2",
  nome: "Agadir Zampirolli",
  cim_mascarada: "",
  situacao: "ativo",
};

function media(matches) {
  return () => ({ matches, addEventListener() {}, addListener() {} });
}

test("navegação mobile não renderiza abas desktop e o rerender não as restaura", () => {
  assert.equal(shouldHideDesktopTabs(true, false), true);
  assert.equal(shouldHideDesktopTabs(true, true), false);
  assert.equal(shouldHideDesktopTabs(false, false), false);
  assert.deepEqual(adminNavState({ mobile: true, open: false }), {
    showTrigger: true,
    tabBarHidden: true,
    showTabBar: false,
  });
  assert.equal(isMobileLayout(media(true)), true);
  assert.equal(isMobileLayout(media(false)), false);
  const rootEl = { classList: { toggle() {} } };
  applyDocumentLayout(rootEl, media(true));

  const html = read("area-restrita/gestao/index.html");
  const js = read("area-restrita/gestao/gestao.js");
  const css = read("area-restrita/css/area.css");
  assert.match(html, /data-admin-nav/);
  assert.match(html, /id="section-switcher-trigger"/);
  assert.match(html, /aria-controls="tabs"/);
  assert.doesNotMatch(html, /section-switcher-menu/);
  assert.match(js, /applyAdminNavLayout/);
  assert.match(js, /shouldHideDesktopTabs/);
  assert.match(js, /bindLayoutMode/);
  assert.match(js, /tabs\.hidden/);
  assert.match(js, /applyAdminNavLayout\(\)/);
  assert.doesNotMatch(js, /openSectionMenu/);
  assert.doesNotMatch(js, /section-switcher__option/);
  assert.match(css, /\.gestao-page \.tab-bar \{ display: none !important; \}/);
  assert.match(css, /\.gestao-page \.admin-section-nav\.is-open \.tab-bar/);
  assert.doesNotMatch(css, /\.tab-bar \{ flex-wrap: nowrap; overflow-x: auto; \}/);
  assert.equal(sectionLabel("irmaos"), "Irmãos");
  assert.equal(sectionSwitcherModel(visibleGestaoSections(), "eventos").options.find((item) => item.id === "eventos").futurePage, true);
  assert.equal(nextSectionId(GESTAO_SECTIONS, "irmaos", 1), "familiares");
});

test("ficha e modal mobile usam estado full-screen sem restaurar o drawer desktop", () => {
  const js = read("area-restrita/gestao/gestao.js");
  const css = read("area-restrita/css/area.css");
  const modal = read("area-restrita/js/modal.js");
  assert.match(js, /is-fullscreen/);
  assert.match(js, /← Voltar/);
  assert.match(js, /irmaos-drawer__identity/);
  assert.match(js, /applyAdminNavLayout/);
  assert.match(modal, /applyDialogLayout/);
  assert.match(modal, /is-fullscreen/);
  assert.match(css, /dialog\.member-modal\[open\]/);
  assert.match(css, /inset: 0 !important/);
  assert.match(css, /100dvh/);
  assert.match(css, /\.irmaos-drawer\.is-fullscreen/);
  assert.match(css, /grid-template-columns: 1fr;/);
  assert.doesNotMatch(css, /@media \(min-width: 400px\) and \(max-width: 768px\) \{\s*\.irmaos-drawer \.drawer-actions \{\s*grid-template-columns: 1fr 1fr/);
  assert.equal(ficheActions(brother, { perfil: "administrador", id: "a1" }).some((item) => item.id === "ver_detalhes"), false);
  assert.deepEqual(listMenuActions(brother, { perfil: "administrador", id: "a1" }).map((item) => item.id), [
    "ver_detalhes",
    "editar_cadastro",
    "configurar_acesso",
    "registrar_movimentacao",
    "excluir_cadastro",
  ]);
});

test("células mobile não renderizam textos longos e o dia vazio mostra a próxima sessão", () => {
  const session = { categoria: "sessao", titulo: "Sessão Ordinária da ARLS Laços de Fraternidade 357 nº 251", horario: "19h30" };
  const compact = cellMobilePreview([session]);
  assert.equal(compact.text, "●");
  assert.deepEqual(compact.titles, []);
  assert.equal(cellHasLongText(session.titulo), true);
  assert.equal(cellHasLongText("Douglass Carvalho da Silva"), true);
  assert.equal(cellMobilePreview([session, { categoria: "irmao", titulo: "Paulo Henrique Braga da Silva" }]).text, "★ 2");

  const items = [
    { categoria: "sessao", titulo: "Sessão Ordinária", dia: 9, mes: 9, year: 2026, when: new Date(2026, 8, 9, 19, 30), horario: "19h30", loja: "ARLS Laços de Fraternidade 357 nº 251" },
  ];
  const next = findNextSessionItem(items, nextSessionAnchor({ month: 8, year: 2026 }, 22, new Date(2026, 7, 22)));
  assert.equal(next.dia, 9);
  assert.equal(nextSessionCardCopy(next, { isNext: true }).eventLabel, "Sessão Ordinária · 19h30");
  assert.equal(emptyDayCopy(), "Nenhum compromisso neste dia.");
  assert.equal(emptyDayNextHeading(), "Próxima sessão");

  const js = read("area-restrita/calendario/calendario.js");
  const css = read("area-restrita/css/area.css");
  assert.match(js, /isMobileLayout\(\)/);
  assert.match(js, /appendMobileCellMarks/);
  assert.match(js, /calendar-day__mark/);
  assert.match(js, /bindLayoutMode/);
  assert.match(js, /calendar-next-summary__title/);
  assert.match(js, /emptyDayCopy/);
  assert.match(css, /\.calendar-event__label,\s*\n\s*\.calendar-event-badge,\s*\n\s*\.cal-more \{ display: none !important; \}/);
  assert.match(css, /calendar-day--empty \{ min-height: 44px; \}/);
  assert.match(css, /Filtrar calendário|calendar-filter-label/);
});

test("desktop mantém abas, drawer lateral e células com título", () => {
  const css = read("area-restrita/css/area.css");
  const cal = read("area-restrita/calendario/calendario.js");
  const gestao = read("area-restrita/gestao/gestao.js");
  assert.match(css, /@media \(min-width: 769px\)/);
  assert.match(css, /\.gestao-page \.tab-bar \{ display: flex !important; \}/);
  assert.match(css, /minmax\(260px, 2fr\)/);
  assert.match(css, /min\(520px, 100%\)/);
  assert.match(cal, /calendar-event__label/);
  assert.match(cal, /"Próxima"/);
  assert.match(gestao, /icon-button/);
  assert.match(gestao, /displayPersonName\(row\.nome\)/);
});
