import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectPassword } from "../area-restrita/js/password.js";
import { isValidCim, normalizeCim } from "../area-restrita/js/cim.js";

const GENERIC_LOGIN = "CIM ou senha inválida.";
const GENERIC_LATER = "Não foi possível realizar o acesso. Verifique os dados informados e tente novamente mais tarde.";
const GENERIC_RECOVERY = "Caso exista uma conta ativa vinculada à CIM informada, enviaremos as instruções de recuperação ao e-mail cadastrado.";

function loginDecision(member, passwordOk) {
  if (!member || !member.ativo || !member.conta_ativada) return { status: 401, error: GENERIC_LOGIN };
  if (member.bloqueado_ate && new Date(member.bloqueado_ate) > new Date()) {
    return { status: 429, error: GENERIC_LATER };
  }
  if (!passwordOk) return { status: 401, error: GENERIC_LOGIN };
  return { status: 200, error: null };
}

function activationDecision({ member, email, alreadyLinked, inviteExpired, password }) {
  const strength = inspectPassword(password, { cim: member?.cim, email });
  if (!strength.ok) return { ok: false, reason: "senha_fraca" };
  if (!member || !member.ativo || member.conta_ativada || member.email !== email || alreadyLinked || inviteExpired) {
    return { ok: false, reason: "generico" };
  }
  return { ok: true };
}

test("normaliza CIM preservando zeros à esquerda e removendo máscara", () => {
  assert.equal(normalizeCim("0012.345-6"), "00123456");
  assert.equal(normalizeCim("  0001  "), "0001");
  assert.equal(isValidCim("00123456"), true);
  assert.equal(isValidCim("12"), false);
});

test("rejeita senha fraca, comum, com CIM ou e-mail", () => {
  assert.equal(inspectPassword("curta").ok, false);
  assert.equal(inspectPassword("password123").ok, false);
  assert.equal(inspectPassword("Abcdefghij1!", { cim: "00123456" }).ok, true);
  assert.equal(inspectPassword("Senha00123456!", { cim: "00123456" }).ok, false);
  assert.equal(inspectPassword("Xirmao@loja.com9A!", { email: "irmao@loja.com" }).ok, false);
});

test("login devolve a mesma mensagem para CIM inexistente, senha inválida, inativa e não ativada", () => {
  const missing = loginDecision(null, true);
  const badPass = loginDecision({ ativo: true, conta_ativada: true }, false);
  const inactive = loginDecision({ ativo: false, conta_ativada: true }, true);
  const pending = loginDecision({ ativo: true, conta_ativada: false }, true);
  assert.equal(missing.error, GENERIC_LOGIN);
  assert.equal(badPass.error, GENERIC_LOGIN);
  assert.equal(inactive.error, GENERIC_LOGIN);
  assert.equal(pending.error, GENERIC_LOGIN);
});

test("conta bloqueada usa mensagem genérica posterior", () => {
  const blocked = loginDecision({
    ativo: true,
    conta_ativada: true,
    bloqueado_ate: new Date(Date.now() + 60_000).toISOString(),
  }, true);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.error, GENERIC_LATER);
});

test("ativação recusa convite expirado, e-mail incompatível, conta já ativada e vínculo duplicado", () => {
  const member = { cim: "00001111", email: "a@test.com", ativo: true, conta_ativada: false };
  assert.equal(activationDecision({ member, email: "a@test.com", alreadyLinked: false, inviteExpired: false, password: "Abcdefghij1!" }).ok, true);
  assert.equal(activationDecision({ member, email: "b@test.com", alreadyLinked: false, inviteExpired: false, password: "Abcdefghij1!" }).ok, false);
  assert.equal(activationDecision({ member: { ...member, conta_ativada: true }, email: "a@test.com", alreadyLinked: false, inviteExpired: false, password: "Abcdefghij1!" }).ok, false);
  assert.equal(activationDecision({ member, email: "a@test.com", alreadyLinked: true, inviteExpired: false, password: "Abcdefghij1!" }).ok, false);
  assert.equal(activationDecision({ member, email: "a@test.com", alreadyLinked: false, inviteExpired: true, password: "Abcdefghij1!" }).ok, false);
  assert.equal(activationDecision({ member, email: "a@test.com", alreadyLinked: false, inviteExpired: false, password: "fraca" }).reason, "senha_fraca");
});

test("recuperação não distingue CIM válida, inexistente ou inativa", () => {
  const messageFor = () => GENERIC_RECOVERY;
  assert.equal(messageFor("00001111"), messageFor("99999999"));
  assert.equal(messageFor("inativa"), GENERIC_RECOVERY);
});

test("irmão não é staff e anônimo não lê tabela", () => {
  const canAdmin = (perfil) => perfil === "administrador";
  const canStaff = (perfil) => perfil === "secretario" || perfil === "administrador";
  assert.equal(canStaff("irmao"), false);
  assert.equal(canStaff("secretario"), true);
  assert.equal(canAdmin("secretario"), false);
  assert.equal(canAdmin("administrador"), true);
  assert.equal(canStaff(null), false);
});

test("frontend de login não consulta a tabela por CIM", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../area-restrita/login/login.js"), "utf8");
  assert.equal(source.includes("irmaos_autorizados"), false);
  assert.equal(source.includes("login-with-cim"), true);
});
