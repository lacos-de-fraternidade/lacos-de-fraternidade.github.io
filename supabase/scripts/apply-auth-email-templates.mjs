import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const token = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const projectRef = process.env.SUPABASE_PROJECT_REF || "klxcwkclydirdxomkbtv";

if (!token) {
  console.error("Defina SUPABASE_ACCESS_TOKEN para aplicar os templates no projeto hospedado.");
  process.exit(1);
}

const body = {
  mailer_subjects_invite: "Convite para a Área dos Irmãos — Laços de Fraternidade 357 nº 251",
  mailer_templates_invite_content: readFileSync(join(root, "supabase/templates/invite.html"), "utf8"),
  mailer_subjects_recovery: "Redefinição de senha — Área dos Irmãos",
  mailer_templates_recovery_content: readFileSync(join(root, "supabase/templates/recovery.html"), "utf8"),
};

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const raw = await response.text();
if (!response.ok) {
  console.error(`Falha ao aplicar templates (${response.status}).`);
  process.exit(1);
}

let parsed = {};
try {
  parsed = JSON.parse(raw);
} catch {
  parsed = {};
}

const inviteOk = parsed.mailer_subjects_invite === body.mailer_subjects_invite;
const recoveryOk = parsed.mailer_subjects_recovery === body.mailer_subjects_recovery;
console.log(inviteOk && recoveryOk
  ? "Templates de convite e recuperação aplicados no Auth."
  : "Auth atualizado. Confira os assuntos no Dashboard.");
