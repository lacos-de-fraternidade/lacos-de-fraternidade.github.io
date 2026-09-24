import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SMTP_DEFAULTS,
  buildSmtpMime,
  classifySmtpError,
  classifySmtpReply,
  encodeMimeWord,
  encodeSmtpData,
  encodeUtf8Base64,
  extractSmtpLines,
  isSmtpAccepted,
  parseSmtpCode,
  parseSmtpReplyLines,
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

test("MIME UTF-8 usa encoded-word nos headers e preserva o corpo", () => {
  const config = readSmtpConfig(validEnv);
  const mime = buildSmtpMime(config, {
    to: "dest@invalid.test",
    subject: "Notificação do proponente",
    text: "Cadastro do candidato\nARLS Laços de Fraternidade",
    html: "<p>Cadastro do candidato</p><p>ARLS Laços de Fraternidade</p>",
  });
  const [headerBlock, ...rest] = mime.split("\r\n\r\n");
  const body = rest.join("\r\n\r\n");
  const fromEncoded = encodeMimeWord("ARLS Laços de Fraternidade");
  const subjectEncoded = encodeMimeWord("Notificação do proponente");
  assert.equal(fromEncoded, `=?UTF-8?B?${encodeUtf8Base64("ARLS Laços de Fraternidade")}?=`);
  assert.equal(subjectEncoded, `=?UTF-8?B?${encodeUtf8Base64("Notificação do proponente")}?=`);
  assert.equal(headerBlock.includes(`From: ${fromEncoded} <loja@invalid.test>`), true);
  assert.equal(headerBlock.includes(`Subject: ${subjectEncoded}`), true);
  assert.match(headerBlock, /^To: dest@invalid.test$/m);
  assert.doesNotMatch(headerBlock, /Laços|Notificação/);
  assert.equal(encodeMimeWord("Cadastro do candidato"), "Cadastro do candidato");
  assert.match(headerBlock, /Content-Type: multipart\/alternative; boundary="lacos-mail"/);
  assert.match(body, /Content-Type: text\/plain; charset=utf-8/);
  assert.match(body, /Content-Type: text\/html; charset=utf-8/);
  assert.match(body, /Cadastro do candidato/);
  assert.match(body, /ARLS Laços de Fraternidade/);
});

test("headers SMTP bloqueiam CR/LF e não codificam o endereço", () => {
  const config = readSmtpConfig({
    ...validEnv,
    SMTP_SENDER_NAME: "Loja\r\nBcc: evil@invalid.test",
  });
  const mime = buildSmtpMime(config, {
    to: "dest@invalid.test\r\nCc: evil@invalid.test",
    subject: "Assunto\r\nBcc: evil@invalid.test",
    replyTo: "alfa@invalid.test\r\nBcc: evil@invalid.test",
    text: "ok",
    html: "<p>ok</p>",
  });
  const headerBlock = mime.split("\r\n\r\n")[0];
  assert.doesNotMatch(headerBlock, /\nBcc:/);
  assert.doesNotMatch(headerBlock, /\rBcc:/);
  assert.match(headerBlock, /^To: dest@invalid.test$/m);
  assert.match(headerBlock, /^Reply-To: alfa@invalid.test$/m);
  assert.doesNotMatch(headerBlock, /=\?UTF-8\?B\?.*dest@invalid\.test/);
});

test("resposta SMTP multiline e fragmentada só completa no último código", () => {
  const first = extractSmtpLines("250-smtp.gmail.com\r\n250-PIPE");
  assert.deepEqual(first.lines, ["250-smtp.gmail.com"]);
  assert.equal(first.leftover, "250-PIPE");
  const second = extractSmtpLines(`${first.leftover}LINING\r\n250 SMTPUTF8\r\n`);
  assert.deepEqual(second.lines, ["250-PIPELINING", "250 SMTPUTF8"]);
  assert.equal(second.leftover, "");
  assert.deepEqual(parseSmtpReplyLines(["250-smtp.gmail.com", "250-PIPELINING"]), {
    complete: false,
    code: 0,
    text: "smtp.gmail.com\nPIPELINING",
  });
  assert.deepEqual(parseSmtpReplyLines(["250-smtp.gmail.com", "250-PIPELINING", "250 SMTPUTF8"]), {
    complete: true,
    code: 250,
    text: "smtp.gmail.com\nPIPELINING\nSMTPUTF8",
  });
});

test("dot-stuffing e CRLF são aplicados no payload SMTP", () => {
  assert.equal(encodeSmtpData("linha\n.secreta\n."), "linha\r\n..secreta\r\n..");
  const mime = buildSmtpMime(readSmtpConfig(validEnv), {
    to: "dest@invalid.test",
    subject: "Cadastro do candidato",
    text: ".linha\n.segunda",
    html: "<p>ok</p>",
  });
  const stuffed = encodeSmtpData(mime);
  assert.match(stuffed, /\r\n\.\.linha\r\n\.\.segunda/);
  const headerBlock = stuffed.split("\r\n\r\n")[0];
  assert.equal(headerBlock.includes("\r\n"), true);
  assert.equal(headerBlock.replace(/\r\n/g, "").includes("\n"), false);
});

test("250 após DATA é sucesso e a conexão do cliente é encerrada", async () => {
  const result = await sendSmtpMail(
    { to: "dest@invalid.test", subject: "Cadastro do candidato", text: "ok", html: "<p>ok</p>" },
    { config: readSmtpConfig(validEnv), transport: async () => ({ status: 250, name: "aceito" }) },
  );
  assert.equal(result.sent, true);
  assert.equal(result.status, 250);
  const emailer = read("supabase/functions/_shared/email.ts");
  assert.match(emailer, /const close = \(\) =>/);
  assert.match(emailer, /finally \{\s*close\(\);/s);
  assert.match(emailer, /onTimeout\?\.\(\)/);
  assert.match(emailer, /await sock.command\("QUIT"\)/);
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
