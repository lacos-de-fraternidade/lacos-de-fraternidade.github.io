/** Transporte SMTP transacional do Cadastro do candidato. Sem I/O até receber um transport. */

export const SMTP_DEFAULTS = {
  host: "smtp.gmail.com",
  port: 587,
  user: "lacos.de.fraternidade.357.251@gmail.com",
  senderName: "ARLS Laços de Fraternidade",
};

export function readSmtpConfig(env = {}) {
  const pass = String(env.SMTP_PASS ?? "").trim();
  if (!pass) return { ok: false, error: "SMTP_PASS ausente" };
  const port = Number(env.SMTP_PORT ?? SMTP_DEFAULTS.port);
  if (!Number.isInteger(port) || port <= 0) return { ok: false, error: "SMTP_PORT inválida" };
  return {
    ok: true,
    host: String(env.SMTP_HOST ?? SMTP_DEFAULTS.host).trim() || SMTP_DEFAULTS.host,
    port,
    user: String(env.SMTP_USER ?? SMTP_DEFAULTS.user).trim() || SMTP_DEFAULTS.user,
    pass,
    senderName: String(env.SMTP_SENDER_NAME ?? SMTP_DEFAULTS.senderName).trim() || SMTP_DEFAULTS.senderName,
  };
}

export function parseSmtpCode(line) {
  const match = String(line || "").match(/^(\d{3})([\s-])(.*)$/);
  if (!match) return null;
  return { code: Number(match[1]), more: match[2] === "-", text: match[3] || "" };
}

export function classifySmtpReply(code) {
  const n = Number(code);
  if (n === 235 || n === 250 || n === 251 || n === 252) return { sent: true, name: "aceito" };
  if (n === 530 || n === 534 || n === 535) return { sent: false, name: "autenticacao" };
  if (n === 550 || n === 551 || n === 553 || n === 511) return { sent: false, name: "destinatario" };
  if (n === 552 || n === 554 || n === 521) return { sent: false, name: "mensagem" };
  if (n === 421 || n === 454) return { sent: false, name: "conexao" };
  if (!n) return { sent: false, name: "transporte" };
  return { sent: n >= 200 && n < 300, name: n >= 200 && n < 300 ? "aceito" : "rejeitado" };
}

export function classifySmtpError(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  if (name === "TimeoutError" || /timeout|timed out/i.test(message)) return "timeout";
  if (/starttls|tls/i.test(message)) return "starttls";
  if (/auth/i.test(message)) return "autenticacao";
  if (/connect|connection|network|dns|refused/i.test(message)) return "conexao";
  return "inesperado";
}

export function isSmtpAccepted(status) {
  return Number(status) >= 200 && Number(status) < 300;
}

export function encodeSmtpData(text) {
  return String(text ?? "").replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

export function buildSmtpMime(config, options) {
  const from = `${config.senderName} <${config.user}>`;
  const to = String(options.to || "").trim();
  const subject = String(options.subject || "").replace(/[\r\n]+/g, " ");
  const replyTo = String(options.replyTo || "").trim();
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: multipart/alternative; boundary=\"lacos-mail\"",
  ].filter(Boolean);
  return [
    headers.join("\r\n"),
    "",
    "--lacos-mail",
    "Content-Type: text/plain; charset=utf-8",
    "",
    String(options.text || ""),
    "--lacos-mail",
    "Content-Type: text/html; charset=utf-8",
    "",
    String(options.html || ""),
    "--lacos-mail--",
    "",
  ].join("\r\n");
}

export async function sendTransactionalEmail(options, env, transport) {
  return sendSmtpMail(options, { config: readSmtpConfig(env), transport });
}

export async function sendSmtpMail(options, { config, transport }) {
  if (!config?.ok) {
    return { sent: false, status: 0, id: null, name: config?.error || "SMTP_PASS ausente" };
  }
  if (!String(options?.to || "").trim()) {
    return { sent: false, status: 0, id: null, name: "destinatario" };
  }
  try {
    const result = await transport(config, options);
    const status = Number(result?.status || 0);
    const classified = classifySmtpReply(status);
    if (!classified.sent || !isSmtpAccepted(status)) {
      return { sent: false, status, id: null, name: result?.name || classified.name };
    }
    return { sent: true, status, id: result?.id || null, name: "aceito" };
  } catch (error) {
    return { sent: false, status: Number(error?.status || 0), id: null, name: classifySmtpError(error) };
  }
}
