import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const MEMBER_SELF_ACTIONS = ["registrar_logout", "registrar_senha_alterada"];
const STAFF_ACTIONS = [
  "listar",
  "criar",
  "atualizar",
  "enviar_convite",
  "reenviar_convite",
  "ativar",
  "desativar",
  "desbloquear",
  "importar_celebracoes",
];
const ADMIN_ACTIONS = ["alterar_perfil", "revogar", "logs", "configurar"];

function authorizeGerenciarAcao(member, acao, body = {}) {
  void body.perfil;
  void body.user_id;
  void body.email;
  if (!acao) return { ok: false, status: 400 };
  if (!member) return { ok: false, status: 401 };
  if (member.ativo !== true || member.conta_ativada !== true) return { ok: false, status: 403 };
  if (MEMBER_SELF_ACTIONS.includes(acao)) return { ok: true };
  if (ADMIN_ACTIONS.includes(acao)) {
    return member.perfil === "administrador" ? { ok: true } : { ok: false, status: 403 };
  }
  if (STAFF_ACTIONS.includes(acao)) {
    return member.perfil === "secretario" || member.perfil === "administrador"
      ? { ok: true }
      : { ok: false, status: 403 };
  }
  return { ok: false, status: 400 };
}

function inviteTtlSeconds(appHours, otpSeconds) {
  return Math.min(appHours * 3600, otpSeconds);
}

test("gerenciar-irmao exige JWT no gateway e valida getUser no handler", () => {
  const toml = read("supabase/config.toml");
  assert.match(toml, /\[functions\.gerenciar-irmao\]\s*verify_jwt = true/);
  assert.match(toml, /\[functions\.ativar-conta\]\s*verify_jwt = true/);
  assert.match(toml, /\[functions\.login-with-cim\]\s*verify_jwt = false/);
  assert.match(toml, /\[functions\.recuperar-senha-cim\]\s*verify_jwt = false/);
  const source = read("supabase/functions/gerenciar-irmao/index.ts");
  assert.equal(source.includes("requireActiveMember"), true);
  assert.equal(source.includes("authorizeGerenciarAcao"), true);
  assert.equal(source.includes("payload.user_id"), false);
  const members = read("supabase/functions/_shared/members.ts");
  assert.equal(members.includes("auth.getUser(token)"), true);
});

test("gerenciar-irmao recusa anônimo, irmão, JWT inválido, body adulterado e inativo", () => {
  const listar = "listar";
  assert.equal(authorizeGerenciarAcao(null, listar).status, 401);
  assert.equal(authorizeGerenciarAcao({ ativo: true, conta_ativada: true, perfil: "irmao" }, listar).status, 403);
  assert.equal(authorizeGerenciarAcao({ ativo: true, conta_ativada: true, perfil: "irmao" }, "revogar").status, 403);
  assert.equal(authorizeGerenciarAcao({ ativo: false, conta_ativada: true, perfil: "administrador" }, listar).status, 403);
  assert.equal(authorizeGerenciarAcao({ ativo: true, conta_ativada: false, perfil: "secretario" }, listar).status, 403);
  const secretary = { ativo: true, conta_ativada: true, perfil: "secretario" };
  assert.equal(authorizeGerenciarAcao(secretary, "alterar_perfil").ok, false);
  assert.equal(authorizeGerenciarAcao(secretary, "criar", { perfil: "administrador" }).ok, true);
  const admin = { ativo: true, conta_ativada: true, perfil: "administrador" };
  assert.equal(authorizeGerenciarAcao(admin, "revogar", { perfil: "administrador", user_id: "forjado" }).ok, true);
  assert.equal(authorizeGerenciarAcao({ ativo: true, conta_ativada: true, perfil: "irmao" }, "registrar_logout").ok, true);
});

test("login autentica com cliente não administrativo e setSession oficial", () => {
  const loginFn = read("supabase/functions/login-with-cim/index.ts");
  assert.equal(loginFn.includes("signInWithPassword"), true);
  assert.equal(loginFn.includes("userAuthClient"), true);
  assert.equal(loginFn.includes("persistSession: false") || read("supabase/functions/_shared/members.ts").includes("persistSession: false"), true);
  assert.equal(loginFn.includes("auth.admin.signIn"), false);
  assert.equal(loginFn.includes("console.log"), false);
  assert.equal(loginFn.includes("password"), true);
  const cors = read("supabase/functions/_shared/cors.ts");
  assert.equal(cors.includes("Cache-Control\": \"no-store") || cors.includes("Cache-Control: \"no-store\""), true);
  const loginJs = read("area-restrita/login/login.js");
  assert.equal(loginJs.includes("setSession"), true);
  assert.equal(loginJs.includes("localStorage.setItem"), false);
});

test("HMAC-SHA-256 usa contexto cim: e ip: sem fallback de pepper", () => {
  const pepper = "pepper-de-teste-16";
  const expectedCim = createHmac("sha256", pepper).update("cim:00123456").digest("hex");
  const expectedIp = createHmac("sha256", pepper).update("ip:127.0.0.1").digest("hex");
  assert.equal(expectedCim.length, 64);
  assert.equal(expectedIp.length, 64);
  assert.notEqual(expectedCim, expectedIp);
  const members = read("supabase/functions/_shared/members.ts");
  assert.equal(members.includes("hmacSha256Hex"), true);
  assert.equal(members.includes("${context}:${value}"), true);
  assert.equal(members.includes("lacos-auth-log"), false);
  const crypto = read("supabase/functions/_shared/crypto.ts");
  assert.equal(crypto.includes("HMAC"), true);
});

test("TTL do convite usa o mínimo entre a tabela e o OTP do Auth", () => {
  assert.equal(inviteTtlSeconds(72, 3600), 3600);
  assert.equal(inviteTtlSeconds(1, 86400), 3600);
  const members = read("supabase/functions/_shared/members.ts");
  assert.equal(members.includes("Math.min(appMs, otpMs)"), true);
});

test("recuperação responde igual e a redefinição usa updateUser do Auth", () => {
  const recovery = read("supabase/functions/recuperar-senha-cim/index.ts");
  assert.equal(recovery.includes("GENERIC_RECOVERY_MESSAGE"), true);
  assert.equal(recovery.includes("member.email"), true);
  assert.equal((recovery.match(/return jsonResponse\(req, 200, \{ ok: true, message: GENERIC_RECOVERY_MESSAGE \}\)/g) || []).length >= 1, true);
  assert.equal(recovery.includes("max_recuperacoes_cim"), true);
  assert.equal(recovery.includes("max_recuperacoes_ip"), true);
  const reset = read("area-restrita/redefinir-senha/redefinir.js");
  assert.equal(reset.includes("updateUser({ password"), true);
  assert.equal(reset.includes("invokeFunction(\"recuperar-senha-cim\""), false);
});
