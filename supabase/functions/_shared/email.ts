const NOTIFY_EMAIL = "lacos.de.fraternidade.357.251@gmail.com";
const RESEND_FROM = `Loja Lacos de Fraternidade <onboarding@${["resend", "dev"].join(".")}>`;
const LOGO_URL = "https://lacos-de-fraternidade.github.io/assets/logo-classica.jpg";
const SITE_URL = "https://lacos-de-fraternidade.github.io/";

export type InteresseRegistro = {
  nome: string;
  cpf: string;
  email: string;
  endereco: string;
  data_nascimento: string | null;
  estado_civil: string;
  familiar_nome: string | null;
  familiar_whatsapp: string | null;
  familiar_papel: string | null;
  consentimento_familiar: boolean | null;
  situacao_familiar: string | null;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  motivacao: string;
  lgpd_versao: string;
  status: string;
};

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return value;
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 8) return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
  return value;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!day) return value;
  return `${day}/${month}/${year}`;
}

function estadoCivilLabel(value: string) {
  const map: Record<string, string> = {
    solteiro: "Solteiro",
    casado: "Casado",
    divorciado: "Divorciado",
    viuvo: "Viúvo",
    uniao_estavel: "União estável",
    outro: "Outro",
  };
  return map[value] || value;
}

function familiarLabel(papel: string | null) {
  if (papel === "esposa") return "Esposa";
  if (papel === "companheira") return "Companheira";
  if (papel === "mae") return "Mãe";
  return "Familiar";
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

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;color:#5f6d80;width:190px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;color:#132033;font-weight:700;">${escapeHtml(value || "—")}</td>
  </tr>`;
}

async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY ausente");

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

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function sendSecretarioEmail(data: InteresseRegistro) {
  const when = enviadoEm();
  const cpf = formatCpf(data.cpf);
  const inner = `
    <p style="margin:0 0 18px;color:#44536a;">Uma nova manifestação foi registrada no site institucional.</p>
    <p style="margin:0 0 18px;"><strong>Recebida em:</strong> ${escapeHtml(when)}</p>
    <h2 style="font-size:16px;color:#123a74;margin:24px 0 8px;">Dados pessoais</h2>
    <table width="100%" cellspacing="0" cellpadding="0">
      ${row("Nome", data.nome)}
      ${row("CPF", cpf)}
      ${row("Nascimento", formatDate(data.data_nascimento))}
      ${row("Estado civil", estadoCivilLabel(data.estado_civil))}
      ${row("WhatsApp", formatWhatsapp(data.whatsapp))}
      ${row("E-mail", data.email)}
    </table>
    <h2 style="font-size:16px;color:#123a74;margin:24px 0 8px;">Família e consentimento</h2>
    <table width="100%" cellspacing="0" cellpadding="0">
      ${row(familiarLabel(data.familiar_papel), data.familiar_nome || data.situacao_familiar || "—")}
      ${row("WhatsApp familiar", data.familiar_whatsapp ? formatWhatsapp(data.familiar_whatsapp) : "—")}
      ${row("Ciência do consentimento familiar", data.consentimento_familiar ? "Sim" : "Não se aplica")}
    </table>
    <h2 style="font-size:16px;color:#123a74;margin:24px 0 8px;">Endereço</h2>
    <table width="100%" cellspacing="0" cellpadding="0">
      ${row("CEP", formatCep(data.cep))}
      ${row("Logradouro", data.logradouro)}
      ${row("Número", data.numero)}
      ${row("Complemento", data.complemento || "—")}
      ${row("Bairro", data.bairro)}
      ${row("Cidade/UF", `${data.cidade}/${data.estado}`)}
    </table>
    <h2 style="font-size:16px;color:#123a74;margin:24px 0 8px;">Motivação</h2>
    <p style="white-space:pre-wrap;background:#f6f9fc;border-radius:12px;padding:16px;color:#24364d;">${escapeHtml(data.motivacao)}</p>
    <p style="margin:24px 0 16px;font-size:13px;color:#5f6d80;">Status inicial: ${escapeHtml(data.status)} · Versão LGPD: ${escapeHtml(data.lgpd_versao)}</p>
    <p style="margin:0;"><a href="${SITE_URL}" style="display:inline-block;background:#123a74;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">Abrir o site institucional</a></p>
  `;

  const text = [
    "Nova manifestação de interesse",
    `Recebida em: ${when}`,
    `Nome: ${data.nome}`,
    `CPF: ${cpf}`,
    `WhatsApp: ${formatWhatsapp(data.whatsapp)}`,
    `E-mail: ${data.email}`,
    `Nascimento: ${formatDate(data.data_nascimento)}`,
    `Estado civil: ${estadoCivilLabel(data.estado_civil)}`,
    `Familiar: ${data.familiar_nome || data.situacao_familiar || "—"}`,
    `Endereço: ${data.endereco}`,
    "",
    "Motivação:",
    data.motivacao,
  ].join("\n");

  await sendEmail({
    to: NOTIFY_EMAIL,
    subject: `Nova manifestação de interesse — ${data.nome}`,
    text,
    html: layout("Nova manifestação de interesse", inner),
    replyTo: data.email,
  });
}

export async function sendCandidatoEmail(data: InteresseRegistro) {
  const primeiroNome = data.nome.split(" ")[0];
  const inner = `
    <p style="margin:0 0 16px;">Prezado ${escapeHtml(data.nome)},</p>
    <p style="margin:0 0 16px;">Recebemos sua manifestação de interesse com sucesso.</p>
    <p style="margin:0 0 16px;">As informações fornecidas serão analisadas pela Comissão de Sindicância da ARLS Laços de Fraternidade. Após essa análise, entraremos em contato pelo WhatsApp ou e-mail informado para orientar você sobre as próximas etapas.</p>
    <p style="margin:0 0 24px;">Este e-mail confirma apenas o recebimento da manifestação e não representa aprovação ou ingresso na instituição.</p>
    <p style="margin:0 0 8px;color:#5f6d80;font-size:14px;">Canal institucional: ${NOTIFY_EMAIL}</p>
    <p style="margin:0;"><a href="${SITE_URL}" style="display:inline-block;background:#123a74;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">Voltar ao site</a></p>
  `;
  const text = [
    `Prezado ${data.nome},`,
    "",
    "Recebemos sua manifestação de interesse com sucesso.",
    "",
    "As informações fornecidas serão analisadas pela Comissão de Sindicância da ARLS Laços de Fraternidade. Após essa análise, entraremos em contato pelo WhatsApp ou e-mail informado para orientar você sobre as próximas etapas.",
    "",
    "Este e-mail confirma apenas o recebimento da manifestação e não representa aprovação ou ingresso na instituição.",
    "",
    `Canal institucional: ${NOTIFY_EMAIL}`,
  ].join("\n");

  await sendEmail({
    to: data.email,
    subject: `${primeiroNome}, recebemos sua manifestação de interesse`,
    text,
    html: layout("Manifestação recebida", inner),
    replyTo: NOTIFY_EMAIL,
  });
}
