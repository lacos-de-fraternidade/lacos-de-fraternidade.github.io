import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beginSubmit, createToastStore, endSubmit, TOAST_DEFAULT_DURATION } from "../area-restrita/js/feedback.js";
import { brToIso, isoToBr, joinDateTime, splitDateTime } from "../area-restrita/js/dates-br.js";
import { paginate, sortByDate } from "../area-restrita/js/list-page.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

test("toast desaparece após o tempo configurado e pode ser fechado", () => {
  const store = createToastStore();
  const toast = store.show({ type: "success", message: "Comunicado publicado com sucesso.", duration: TOAST_DEFAULT_DURATION, now: 1000 });
  assert.equal(store.visible().length, 1);
  store.expire(4999);
  assert.equal(store.visible().length, 1);
  store.expire(5000);
  assert.equal(store.visible().length, 0);

  const other = store.show({ type: "success", message: "Irmão salvo.", duration: 4000, now: 0 });
  store.close(other.id);
  assert.equal(store.visible().some((item) => item.id === other.id), false);
});

test("botão fica desabilitado durante o envio e impede envio duplo", () => {
  const button = { dataset: {}, disabled: false, textContent: "Salvar Irmão", classList: { add() {}, remove() {} } };
  assert.equal(beginSubmit(button), true);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Salvando...");
  assert.equal(beginSubmit(button), false);
  endSubmit(button);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Salvar Irmão");
});

test("datas brasileiras são exibidas e convertidas para ISO", () => {
  assert.equal(isoToBr("2026-08-21"), "21/08/2026");
  assert.equal(brToIso("21/08/2026"), "2026-08-21");
  const iso = joinDateTime("26/08/2026", "19:30");
  assert.equal(new Date(iso).getHours(), 19);
  assert.equal(new Date(iso).getMinutes(), 30);
  assert.equal(splitDateTime(iso).date, "26/08/2026");
  assert.equal(splitDateTime(iso).time, "19:30");
});

test("lista de Irmãos, modal e comunicados seguem o padrão visual combinado", () => {
  const html = read("area-restrita/gestao/index.html");
  const js = read("area-restrita/gestao/gestao.js");
  const css = read("area-restrita/css/area.css");
  assert.match(html, /Novo Irmão/);
  assert.match(html, /Cadastre os dados institucionais do Irmão/);
  assert.match(html, /Salvar Irmão/);
  assert.match(html, /form-actions/);
  assert.match(html, />Mais</);
  assert.match(html, /data-tab="ferramentas"/);
  assert.match(html, /Comunicados publicados/);
  assert.doesNotMatch(html, /datetime-local/);
  assert.doesNotMatch(html, /id="status"/);
  assert.doesNotMatch(js, /actionButton\("Ver detalhes"/);
  assert.match(js, /Ver detalhes/);
  assert.match(js, /rowClickOpensDetails/);
  assert.doesNotMatch(js, /actionsMenu/);
  assert.match(js, /ficheActions/);
  assert.match(js, /beginSubmit/);
  assert.match(js, /showToast/);
  assert.match(js, /event\.target\.reset\(\)/);
  assert.match(js, /closeNewMemberModal/);
  assert.match(js, /canSeeMigrationTools/);
  assert.match(css, /max-width:\s*720px/);
  assert.match(css, /\.form-actions/);
  assert.match(css, /\.record-row/);
});

test("logs paginam, contam e ordenam por data", () => {
  const rows = [
    { criado_em: "2026-08-21T10:00:00" },
    { criado_em: "2026-08-20T10:00:00" },
    { criado_em: "2026-08-22T10:00:00" },
  ];
  const desc = sortByDate(rows, "criado_em", "desc");
  assert.equal(desc[0].criado_em, "2026-08-22T10:00:00");
  const page = paginate(Array.from({ length: 42 }, (_, i) => ({ i })), 2, 20);
  assert.equal(page.total, 42);
  assert.equal(page.pages, 3);
  assert.equal(page.rows.length, 20);
  const html = read("area-restrita/logs/index.html");
  assert.match(html, /limpar-filtros/);
  assert.match(html, /logs-count/);
  assert.match(html, /logs-empty/);
});
