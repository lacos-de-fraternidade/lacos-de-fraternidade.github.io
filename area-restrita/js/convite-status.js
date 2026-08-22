export function inviteStatus(membro, now = new Date()) {
  if (membro?.conta_ativada) return "aceito";
  if (!membro?.convite_enviado_em) return "pendente";
  if (membro.convite_expira_em && new Date(membro.convite_expira_em) <= now) return "expirado";
  return "enviado";
}

export function inviteStatusLabel(status) {
  return {
    pendente: "Pendente",
    enviado: "Enviado",
    aceito: "Aceito",
    expirado: "Expirado",
  }[status] || status;
}

export function maskEmail(email) {
  const raw = String(email || "");
  const at = raw.indexOf("@");
  if (at < 1) return "••••";
  const user = raw.slice(0, at);
  const domain = raw.slice(at);
  const visible = user.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(2, user.length - 2))}${domain}`;
}
