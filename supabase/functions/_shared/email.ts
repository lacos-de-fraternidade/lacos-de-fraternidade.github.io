const NOTIFY_EMAIL = "lacos.de.fraternidade.357.251@gmail.com";
const RESEND_FROM = `Loja Lacos de Fraternidade <onboarding@${["resend", "dev"].join(".")}>`;

type InteresseEmail = {
  nome: string;
  cpf: string;
  email: string;
  endereco: string;
};

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendInteresseEmail(data: InteresseEmail) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY ausente");
  }

  const enviadoEm = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const cpf = formatCpf(data.cpf);
  const subject = `Nova manifestação de interesse — ${data.nome}`;
  const text = [
    "Uma nova manifestação de interesse foi registrada no site.",
    "",
    `Nome: ${data.nome}`,
    `CPF: ${cpf}`,
    `E-mail: ${data.email}`,
    `Endereço: ${data.endereco}`,
    `Recebido em: ${enviadoEm}`,
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #132033; line-height: 1.6;">
      <p>Uma nova manifestação de interesse foi registrada no site.</p>
      <p>
        <strong>Nome:</strong> ${escapeHtml(data.nome)}<br />
        <strong>CPF:</strong> ${escapeHtml(cpf)}<br />
        <strong>E-mail:</strong> ${escapeHtml(data.email)}<br />
        <strong>Endereço:</strong> ${escapeHtml(data.endereco)}<br />
        <strong>Recebido em:</strong> ${escapeHtml(enviadoEm)}
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [NOTIFY_EMAIL],
      reply_to: data.email,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao enviar e-mail: ${details}`);
  }
}
