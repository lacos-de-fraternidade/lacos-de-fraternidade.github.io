import { buildProponenteAviso, buildSecretarioDossie } from "./email-dossie.js";
import {
  buildSmtpMime,
  classifySmtpReply,
  encodeSmtpData,
  parseSmtpReplyLines,
  sanitizeSmtpAddress,
  sendTransactionalEmail,
} from "./smtp-mail.js";

const NOTIFY_EMAIL = "lacos.de.fraternidade.357.251@gmail.com";
const LOGO_URL = "https://lacos-de-fraternidade.github.io/assets/logo-classica.jpg";
const SMTP_TIMEOUT_MS = 15_000;

function smtpEnv() {
  return {
    SMTP_HOST: Deno.env.get("SMTP_HOST") || "",
    SMTP_PORT: Deno.env.get("SMTP_PORT") || "",
    SMTP_USER: Deno.env.get("SMTP_USER") || "",
    SMTP_PASS: Deno.env.get("SMTP_PASS") || "",
    SMTP_SENDER_NAME: Deno.env.get("SMTP_SENDER_NAME") || "",
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function enviadoEm() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function layout(title: string, inner: string) {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#132033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dce5ef;">
            <tr>
              <td style="background:#071a3a;padding:22px 28px;color:#ffffff;">
                <img src="${LOGO_URL}" alt="" width="52" height="52" style="border-radius:50%;vertical-align:middle;margin-right:12px;" />
                <span style="font-size:16px;font-weight:700;">ARLS Laços de Fraternidade 357 nº 251</span>
                <div style="margin-top:6px;color:#9cc7e8;font-size:12px;">Oriente de Duque de Caxias · GLMERJ</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:24px;color:#071a3a;">${escapeHtml(title)}</h1>
                ${inner}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#06142d;color:#91a4bd;font-size:12px;line-height:1.5;">
                ARLS Laços de Fraternidade 357 nº 251 · Oriente de Duque de Caxias · GLMERJ<br />
                Este e-mail é institucional e não representa aprovação ou ingresso.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function timeoutError() {
  const error = new Error("timeout");
  error.name = "TimeoutError";
  return error;
}

async function withTimeout<T>(promise: Promise<T>, onTimeout?: () => void): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(timeoutError());
        }, SMTP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class SmtpSocket {
  leftover = new Uint8Array(0);
  decoder = new TextDecoder();
  encoder = new TextEncoder();

  constructor(public conn: Deno.Conn) {}

  async writeLine(line: string) {
    await this.conn.write(this.encoder.encode(`${line}\r\n`));
  }

  async writeRaw(payload: string) {
    await this.conn.write(this.encoder.encode(payload));
  }

  async readLine() {
    while (true) {
      for (let i = 0; i < this.leftover.length - 1; i += 1) {
        if (this.leftover[i] === 13 && this.leftover[i + 1] === 10) {
          const line = this.decoder.decode(this.leftover.subarray(0, i));
          this.leftover = this.leftover.subarray(i + 2);
          return line;
        }
      }
      const buf = new Uint8Array(4096);
      const n = await this.conn.read(buf);
      if (n === null) {
        const error = new Error("connection");
        error.name = "ConnectionError";
        throw error;
      }
      const next = new Uint8Array(this.leftover.length + n);
      next.set(this.leftover);
      next.set(buf.subarray(0, n), this.leftover.length);
      this.leftover = next;
    }
  }

  async readReply() {
    const lines: string[] = [];
    while (true) {
      lines.push(await this.readLine());
      const reply = parseSmtpReplyLines(lines);
      if (reply.error) {
        const error = new Error(reply.error);
        throw error;
      }
      if (reply.complete) return { code: reply.code, text: reply.text };
    }
  }

  async command(line: string) {
    await this.writeLine(line);
    return this.readReply();
  }
}

export async function denoSmtpTransport(
  config: { host: string; port: number; user: string; pass: string; senderName: string },
  options: { to: string; subject: string; text: string; html: string; replyTo?: string },
) {
  let conn: Deno.Conn | null = null;
  const close = () => {
    try { conn?.close(); } catch { /* ignore */ }
  };
  return withTimeout((async () => {
    try {
      try {
        conn = await Deno.connect({ hostname: config.host, port: config.port });
      } catch {
        const error = new Error("connection");
        error.name = "ConnectionError";
        throw error;
      }
      let sock = new SmtpSocket(conn);
      const greet = await sock.readReply();
      if (greet.code !== 220) return { status: greet.code, name: "conexao" };

      const ehlo = await sock.command("EHLO lacos");
      if (ehlo.code !== 250) return { status: ehlo.code, name: "conexao" };

      const startTls = await sock.command("STARTTLS");
      if (startTls.code !== 220) return { status: startTls.code, name: "starttls" };

      try {
        conn = await Deno.startTls(conn, { hostname: config.host });
      } catch {
        const error = new Error("starttls");
        error.name = "TlsError";
        throw error;
      }
      sock = new SmtpSocket(conn);

      const secured = await sock.command("EHLO lacos");
      if (secured.code !== 250) return { status: secured.code, name: "starttls" };

      const authReady = await sock.command("AUTH LOGIN");
      if (authReady.code !== 334) return { status: authReady.code, name: "autenticacao" };
      const userReply = await sock.command(btoa(config.user));
      if (userReply.code !== 334) return { status: userReply.code, name: "autenticacao" };
      const passReply = await sock.command(btoa(config.pass));
      if (passReply.code !== 235) return { status: passReply.code, name: "autenticacao" };

      const mail = await sock.command(`MAIL FROM:<${sanitizeSmtpAddress(config.user)}>`);
      if (mail.code !== 250) return { status: mail.code, name: classifySmtpReply(mail.code).name };

      const rcpt = await sock.command(`RCPT TO:<${sanitizeSmtpAddress(options.to)}>`);
      if (rcpt.code !== 250 && rcpt.code !== 251) return { status: rcpt.code, name: "destinatario" };

      const data = await sock.command("DATA");
      if (data.code !== 354) return { status: data.code, name: "mensagem" };
      await sock.writeRaw(`${encodeSmtpData(buildSmtpMime(config, options))}\r\n.\r\n`);
      const done = await sock.readReply();
      await sock.command("QUIT").catch(() => {});
      return { status: done.code, name: classifySmtpReply(done.code).name };
    } finally {
      close();
    }
  })(), close);
}

async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<{ sent: boolean; status: number; id: string | null }> {
  const result = await sendTransactionalEmail(options, smtpEnv(), denoSmtpTransport);
  if (!result.sent) {
    console.error("Falha no envio de e-mail", { status: result.status, name: result.name });
  }
  return { sent: result.sent, status: result.status, id: result.id };
}

export async function sendSecretarioEmail(dossie: {
  interesse: Record<string, unknown>;
  proponenteNome?: string | null;
  filhos?: unknown[];
  referencias?: unknown[];
  comercial?: Record<string, unknown> | null;
  documentos?: unknown[];
  recebidoEm?: string;
}) {
  const built = buildSecretarioDossie({
    ...dossie,
    recebidoEm: dossie.recebidoEm || enviadoEm(),
  });
  return sendEmail({
    to: NOTIFY_EMAIL,
    subject: built.subject,
    text: built.text,
    html: layout(built.title, built.inner),
    replyTo: String(dossie.interesse?.email || ""),
  });
}

export async function sendProponenteEmail(input: {
  to: string;
  candidatoNome: string;
  proponenteNome: string;
}) {
  const built = buildProponenteAviso(input);
  return sendEmail({
    to: input.to,
    subject: built.subject,
    text: built.text,
    html: layout(built.title, built.inner),
  });
}
