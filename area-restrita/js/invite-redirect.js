export const INVITE_SITE_ORIGINS = [
  "https://lacos-de-fraternidade.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

export const ACTIVATE_PATH = "/area-restrita/ativar/";
export const RESET_PATH = "/area-restrita/redefinir-senha/";

export function publicSiteOrigin(requestedOrigin, fallback = "https://lacos-de-fraternidade.github.io") {
  let origin = "";
  try {
    origin = requestedOrigin ? new URL(requestedOrigin).origin : "";
  } catch {
    origin = "";
  }
  if (INVITE_SITE_ORIGINS.includes(origin)) return origin;
  return String(fallback || "https://lacos-de-fraternidade.github.io").replace(/\/$/, "");
}

export function inviteRedirectTo(requestedOrigin, fallback) {
  return `${publicSiteOrigin(requestedOrigin, fallback)}${ACTIVATE_PATH}`;
}

export function resetRedirectTo(requestedOrigin, fallback) {
  return `${publicSiteOrigin(requestedOrigin, fallback)}${RESET_PATH}`;
}

export function isExistingAuthUserError(message) {
  return /already|registered|exists|duplicate/i.test(String(message || ""));
}

export function canReplacePendingAuthUser(member, owner) {
  if (owner && owner.id !== member?.id) return false;
  return true;
}

export function localActivateUrlFromPublished(href) {
  const text = String(href || "");
  const match = /https:\/\/lacos-de-fraternidade\.github\.io(\/area-restrita\/ativar\/?.*)$/i.exec(text);
  if (!match) return "";
  return `http://localhost:8080${match[1]}`;
}
