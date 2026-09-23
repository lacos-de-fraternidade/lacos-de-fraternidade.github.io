import { buildProponenteAviso, buildSecretarioDossie } from "./email-dossie.js";

const NOTIFY_EMAIL = "lacos.de.fraternidade.357.251@gmail.com";
const RESEND_FROM = `Loja Lacos de Fraternidade <onboarding@${["resend", "dev"].join(".")}>`;
const LOGO_URL = "https://lacos-de-fraternidade.github.io/assets/logo-classica.jpg";

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

async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<{ sent: boolean; status: number; id: string | null }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("Falha no envio de e-mail", { status: 0, name: "RESEND_API_KEY ausente" });
    return { sent: false, status: 0, id: null };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [options.to],
      reply_to: options.replyTo,
      subject: options.subject,
      text: options.text,
      html: options.html,
    }),
  });

  const raw = await response.text();
  let parsed: { id?: string; message?: string; name?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    console.error("Falha no envio de e-mail", {
      status: response.status,
      name: parsed.name || "erro",
    });
    return { sent: false, status: response.status, id: null };
  }

  return { sent: true, status: response.status, id: parsed.id || null };
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
