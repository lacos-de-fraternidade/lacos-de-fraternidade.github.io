import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindDialog, initializeClosedDialog } from "../area-restrita/js/modal.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");
const html = read("area-restrita/gestao/index.html");
const js = read("area-restrita/gestao/gestao.js");
const css = read("area-restrita/css/area.css");
const modalJs = read("area-restrita/js/modal.js");

function fakeDialog({ open = false } = {}) {
  const listeners = {};
  let showModalCalls = 0;
  const firstInput = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  const opener = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  const dialog = {
    open,
    showModalCalls,
    firstInput,
    opener,
    close() {
      this.open = false;
      (listeners.close || []).forEach((fn) => fn());
    },
    showModal() {
      showModalCalls += 1;
      this.showModalCalls = showModalCalls;
      this.open = true;
    },
    removeAttribute(name) {
      if (name === "open") this.open = false;
    },
    querySelector() { return firstInput; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
  };
  return dialog;
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `função ${name} ausente`);
  const next = source.slice(start + 1).search(/\nfunction |\nasync function /);
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
}

test("modal Novo Irmão nasce fechado no HTML, sem overlay nem flash", () => {
  assert.match(html, /<dialog id="dialog-novo"/);
  assert.doesNotMatch(html, /<dialog[^>]*\sopen(\s|>)/);
  assert.match(html, /aria-labelledby="novo-titulo"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /id="novo-irmao">\+ Novo Irmão</);
  assert.match(css, /\.modal-dialog:not\(\[open\]\)\s*\{\s*display:\s*none/);
  assert.match(css, /\.irmaos-dialog:not\(\[open\]\)/);
  assert.match(css, /display:\s*none/);
  assert.match(css, /\.irmaos-dialog\[open\]/);
  assert.match(css, /body\.modal-open\s*\{\s*overflow:\s*hidden/);
  assert.match(css, /box-shadow:\s*0 0 0 2px rgba\(18, 67, 125, 0\.12\)/);
  assert.doesNotMatch(css, /\.member-modal[^{]*\{[^}]*0 0 0 4px/);
});

test("formulário do Novo Irmão usa data única, Loja padrão e perfis permitidos", () => {
  assert.match(html, /for="novo-nascimento">Data de nascimento</);
  assert.match(html, /placeholder="dd\/mm\/aaaa"/);
  assert.doesNotMatch(html, /Dia de nascimento|Mês de nascimento|id="novo-dia"|id="novo-mes"/);
  assert.match(html, /value="ARLS Laços de Fraternidade 357 nº 251"/);
  assert.match(html, /Acesso à Área dos Irmãos/);
  assert.match(html, /<label for="novo-cim">CIM<\/label>/);
  assert.match(html, /<label for="novo-email">E-mail<\/label>/);
  assert.doesNotMatch(html, /opcional nesta etapa/);
  assert.match(html, /option value="irmao" selected>Irmão</);
  assert.match(js, /DEFAULT_LOJA_INICIACAO/);
  assert.match(js, /fillProfileOptions/);
  assert.match(js, /conceder_acesso: false/);
  assert.match(js, /ano_nascimento/);
  assert.match(read("supabase/functions/_shared/gestao.ts"), /resolveAssignableProfile/);
  assert.match(read("supabase/functions/_shared/gestao.ts"), /ano_nascimento: birth\.year/);
  assert.doesNotMatch(read("supabase/functions/_shared/gestao.ts"), /insert\(\{ \.\.\.acesso, perfil/);
  assert.match(read("supabase/functions/gerenciar-irmao/index.ts"), /resolveAssignableProfile\(actorPerfil/);
});

test("inicialização fecha o dialog e não chama showModal", () => {
  const alreadyOpen = fakeDialog({ open: true });
  initializeClosedDialog(alreadyOpen);
  assert.equal(alreadyOpen.open, false);
  assert.equal(alreadyOpen.showModalCalls, 0);

  const closed = fakeDialog();
  const api = bindDialog(closed);
  assert.equal(closed.open, false);
  assert.equal(closed.showModalCalls, 0);
  assert.equal(api.isOpen(), false);

  api.open(closed.opener);
  assert.equal(closed.open, true);
  assert.equal(closed.showModalCalls, 1);
  api.close();
  assert.equal(closed.open, false);
  assert.equal(closed.opener.focusCalls, 1);
});

test("Gestão só abre o cadastro pelo botão + Novo Irmão", () => {
  assert.match(js, /initializeNewMemberModal\(\)/);
  assert.match(js, /#novo-irmao"\)\??\.addEventListener\("click", openNewMemberModal\)/);
  const boot = js.slice(js.indexOf("await bootPage"), js.indexOf("function bindTabs"));
  assert.match(boot, /initializeNewMemberModal\(\)/);
  assert.doesNotMatch(boot, /showModal\(/);
  assert.doesNotMatch(boot, /openNewMemberModal\(\)/);
  assert.doesNotMatch(js, /sessionStorage|localStorage/);

  const reset = functionBody(js, "resetBrotherForm");
  assert.doesNotMatch(reset, /\.open\(|showModal/);

  const refresh = functionBody(js, "refresh");
  assert.doesNotMatch(refresh, /openNewMemberModal|novoDialog\.open|showModal/);

  const renderList = functionBody(js, "renderList");
  assert.doesNotMatch(renderList, /openNewMemberModal|novoDialog\.open|showModal/);

  const openTab = functionBody(js, "openTab");
  assert.doesNotMatch(openTab, /openNewMemberModal|novoDialog\.open|showModal/);

  const saveNew = functionBody(js, "saveNew");
  assert.match(saveNew, /if \(Object\.keys\(errors\)\.length\) return/);
  assert.match(saveNew, /closeNewMemberModal\(\)/);

  const openNew = functionBody(js, "openNewMemberModal");
  assert.match(openNew, /resetBrotherForm\(\)/);
  assert.match(openNew, /modal-open/);
  assert.match(openNew, /novoDialog\.open\(/);

  const init = functionBody(js, "initializeNewMemberModal");
  assert.match(init, /modal\?\.open\) modal\.close/);
  assert.match(init, /classList\.remove\("modal-open"\)/);

  const close = functionBody(js, "closeNewMemberModal");
  assert.match(close, /modal\.close\(\)/);
  assert.match(html, /data-close aria-label="Fechar"/);
  assert.match(html, /data-close>Cancelar/);
  assert.match(modalJs, /event\.key !== "Tab"/);
});
