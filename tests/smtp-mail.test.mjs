import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SMTP_DEFAULTS,
  classifySmtpError,
  classifySmtpReply,
  encodeSmtpData,
  isSmtpAccepted,
  parseSmtpCode,
  readSmtpConfig,
  sendSmtpMail,
  sendTransactionalEmail,
} from "../supabase/functions/_shared/smtp-mail.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const validEnv = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_USER: "loja@invalid.test",
  SMTP_PASS: "senha-de-teste",
  SMTP_SENDER_NAME: "ARLS Laços de Fraternidade",
};

test("SMTP lê defaults seguros e exige SMTP_PASS", () => {
  const ok = readSmtpConfig(validEnv);
  assert.equal(ok.ok, true);
  assert.equal(ok.host, "smtp.gmail.com");
  assert.equal(ok.port, 587);
  assert.equal(ok.user, "loja@invalid.test");
  assert.equal(ok.senderName, "ARLS Laços de Fraternidade");
  assert.equal(ok.pass, "senha-de-teste");

  const defaults = readSmtpConfig({ SMTP_PASS: "x" });
  assert.equal(defaults.ok, true);
  assert.equal(defaults.host, SMTP_DEFAULTS.host);
  assert.equal(defaults.port, SMTP_DEFAULTS.port);
  assert.equal(defaults.user, SMTP_DEFAULTS.user);
  assert.equal(defaults.senderName, SMTP_DEFAULTS.senderName);

  assert.deepEqual(readSmtpConfig({}), { ok: false, error: "SMTP_PASS ausente" });
  assert.deepEqual(readSmtpConfig({ SMTP_PASS: "   " }), { ok: false, error: "SMTP_PASS ausente" });
  assert.deepEqual(readSmtpConfig({ SMTP_PASS: "x", SMTP_PORT: "abc" }), { ok: false, error: "SMTP_PORT inválida" });
});

test("SMTP classifica autenticação, destinatário, mensagem, timeout e sucesso", () => {
  assert.deepEqual(classifySmtpReply(250), { sent: true, name: "aceito" });
  assert.deepEqual(classifySmtpReply(535), { sent: false, name: "autenticacao" });
  assert.deepEqual(classifySmtpReply(550), { sent: false, name: "destinatario" });
  assert.deepEqual(classifySmtpReply(554), { sent: false, name: "mensagem" });
  assert.equal(isSmtpAccepted(250), true);
  assert.equal(isSmtpAccepted(535), false);
  assert.equal(classifySmtpError({ name: "TimeoutError", message: "timeout" }), "timeout");
  assert.equal(classifySmtpError({ message: "STARTTLS failed" }), "starttls");
  assert.equal(classifySmtpError({ message: "connection refused" }), "conexao");
  assert.equal(parseSmtpCode("250-SIZE")?.more, true);
  assert.equal(parseSmtpCode("250 OK")?.more, false);
  assert.equal(encodeSmtpData("linha\n.secreta"), "linha\r\n..secreta");
});

test("SMTP_PASS ausente falha sem chamar o transporte", async () => {
  let called = 0;
  const result = await sendTransactionalEmail(
    { to: "dest@invalid.test", subject: "x", text: "t", html: "h" },
    {},
    async () => {
      called += 1;
      return { status: 250 };
    },
  );
  assert.equal(called, 0);
  assert.equal(result.sent, false);
  assert.equal(result.name, "SMTP_PASS ausente");
});

test("autenticação SMTP falhando não vira sucesso", async () => {
  const result = await sendSmtpMail(
    { to: "dest@invalid.test", subject: "x", text: "t", html: "h" },
    { config: readSmtpConfig(validEnv), transport: async () => ({ status: 535, name: "autenticacao" }) },
  );
  assert.equal(result.sent, false);
  assert.equal(result.status, 535);
  assert.equal(result.name, "autenticacao");
});

test("servidor rejeitando destinatário não vira sucesso", async () => {
  const result = await sendSmtpMail(
    { to: "dest@invalid.test", subject: "x", text: "t", html: "h" },
    { config: readSmtpConfig(validEnv), transport: async () => ({ status: 550, name: "destinatario" }) },
  );
  assert.equal(result.sent, false);
  assert.equal(result.name, "destinatario");
});

test("servidor rejeitando mensagem não vira sucesso", async () => {
  const result = await sendSmtpMail(
    { to: "dest@invalid.test", subject: "x", text: "t", html: "h" },
    { config: readSmtpConfig(validEnv), transport: async () => ({ status: 554, name: "mensagem" }) },
  );
  assert.equal(result.sent, false);
  assert.equal(result.name, "mensagem");
});

test("timeout ou erro de transporte não vira sucesso", async () => {
  const timeout = await sendSmtpMail(
    { to: "dest@invalid.test", subject: "x", text: "t", html: "h" },
    {
      config: readSmtpConfig(validEnv),
      transport: async () => {
        const error = new Error("timed out");
        error.name = "TimeoutError";
        throw error;
      },
    },
  );
  assert.equal(timeout.sent, false);
  assert.equal(timeout.name, "timeout");

  const transport = await sendSmtpMail(
    { to: "dest@invalid.test", subject: "x", text: "t", html: "h" },
    {
      config: readSmtpConfig(validEnv),
      transport: async () => {
        throw new Error("connection refused");
      },
    },
  );
  assert.equal(transport.sent, false);
  assert.equal(transport.name, "conexao");
});

test("sucesso SMTP só quando o servidor aceita a mensagem", async () => {
  const result = await sendTransactionalEmail(
    { to: "dest@invalid.test", subject: "Dossie", text: "ok", html: "<p>ok</p>" },
    validEnv,
    async (_config, options) => {
      assert.equal(options.to, "dest@invalid.test");
      assert.equal(options.subject, "Dossie");
      return { status: 250, id: "queue-1" };
    },
  );
  assert.equal(result.sent, true);
  assert.equal(result.status, 250);
  assert.equal(result.name, "aceito");
  assert.equal(result.id, "queue-1");
});

test("dossiê, proponente e reenvio compartilham o helper SMTP", () => {
  const emailer = read("supabase/functions/_shared/email.ts");
  const registrar = read("supabase/functions/registrar-interesse/index.ts");
  const reenvio = read("supabase/functions/reenviar-dossie-secretaria/index.ts");
  assert.match(emailer, /sendTransactionalEmail/);
  assert.match(emailer, /denoSmtpTransport/);
  assert.match(emailer, /STARTTLS/);
  assert.match(emailer, /AUTH LOGIN/);
  assert.match(emailer, /export async function sendSecretarioEmail/);
  assert.match(emailer, /export async function sendProponenteEmail/);
  assert.match(registrar, /sendSecretarioEmail/);
  assert.match(registrar, /sendProponenteEmail/);
  assert.match(reenvio, /sendSecretarioEmail/);
  assert.doesNotMatch(reenvio, /sendProponenteEmail/);
  assert.match(read("supabase/functions/_shared/members.ts"), /inviteUserByEmail/);
});
