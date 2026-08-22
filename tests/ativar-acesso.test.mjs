import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENERIC_ACTIVATE_ERROR,
  ACTIVATE_SUCCESS_TOAST,
  canSubmitActivation,
  localActivateMessage,
  mapActivateError,
  sanitizeCimInput,
} from "../area-restrita/js/ativar-acesso.js";
import { strengthLabel, passwordRequirements } from "../area-restrita/js/password.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const valid = {
  cim: "121212",
  password: "Abcdefghij1!",
  confirmacao: "Abcdefghij1!",
  termos: true,
  session: { access_token: "token" },
};

test("ativação valida CIM, senha, confirmação, termos e sessão", () => {
  assert.equal(canSubmitActivation(valid), true);
  assert.equal(canSubmitActivation({ ...valid, cim: "" }), false);
  assert.equal(canSubmitActivation({ ...valid, cim: "12" }), false);
  assert.equal(canSubmitActivation({ ...valid, password: "fraca" }), false);
  assert.equal(canSubmitActivation({ ...valid, confirmacao: "OutraSenha1!" }), false);
  assert.equal(canSubmitActivation({ ...valid, termos: false }), false);
  assert.equal(canSubmitActivation({ ...valid, session: null }), false);
  assert.equal(sanitizeCimInput("12.12.12abc"), "121212");
  assert.equal(sanitizeCimInput("001212"), "001212");
});

test("erros locais da ativação são específicos e falhas sensíveis permanecem genéricas", () => {
  assert.equal(localActivateMessage({ password: "Abcdefghij1!", confirmacao: "OutraSenha1!", termos: true }), "As senhas não coincidem.");
  assert.equal(localActivateMessage({ password: "fraca", confirmacao: "fraca", termos: true }), "A senha ainda não atende aos requisitos mínimos.");
  assert.equal(localActivateMessage({ password: "Abcdefghij1!", confirmacao: "Abcdefghij1!", termos: false }), "Aceite os termos de uso para continuar.");
  assert.equal(mapActivateError("CIM incompatível"), GENERIC_ACTIVATE_ERROR);
  assert.equal(mapActivateError("convite expirado"), GENERIC_ACTIVATE_ERROR);
  assert.equal(mapActivateError("email incompatível"), GENERIC_ACTIVATE_ERROR);
  assert.equal(mapActivateError("conta já ativada"), GENERIC_ACTIVATE_ERROR);
  assert.equal(mapActivateError("Não foi possível concluir esta ação. Tente novamente ou fale com a Secretaria."), GENERIC_ACTIVATE_ERROR);
  assert.equal(mapActivateError("As senhas não coincidem."), "As senhas não coincidem.");
});

test("tela de ativação tem contexto institucional, loading e sucesso para o login", () => {
  const html = read("area-restrita/ativar/index.html");
  const js = read("area-restrita/ativar/ativar.js");
  const css = read("area-restrita/css/area.css");
  assert.match(html, /Bem-vindo à Área dos Irmãos/);
  assert.match(html, /ARLS Laços de Fraternidade 357 nº 251/);
  assert.match(html, /Confirme sua CIM/);
  assert.match(html, /validada com o cadastro da Loja/);
  assert.match(html, /ativar-sucesso/);
  assert.match(html, /Entrar na Área dos Irmãos/);
  assert.match(html, /href="\.\.\/login\/"/);
  assert.match(js, /Ativando sua conta/);
  assert.match(js, /beginSubmit/);
  assert.match(js, /showSuccess/);
  assert.match(js, /GENERIC_ACTIVATE_ERROR/);
  assert.match(js, /sanitizeCimInput/);
  assert.doesNotMatch(js, /window\.location\.replace/);
  assert.equal(ACTIVATE_SUCCESS_TOAST, "Conta ativada com sucesso.");
  assert.match(css, /auth-card__lede/);
  assert.match(css, /meter-bar\.is-score-4/);
  assert.equal(strengthLabel(0), "Fraca");
  assert.equal(strengthLabel(1), "Regular");
  assert.equal(strengthLabel(2), "Boa");
  assert.equal(strengthLabel(3), "Forte");
  assert.equal(strengthLabel(4), "Excelente");
  assert.deepEqual(passwordRequirements("Ab1!").map((item) => item.id), ["len", "upper", "lower", "num", "special"]);
});
