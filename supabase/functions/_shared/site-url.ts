export const PUBLIC_SITE_ORIGINS = [
  "https://lacos-de-fraternidade.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
] as const;

export function resolvePublicSiteUrl(requestedOrigin?: string, fallback?: string) {
  const base = (fallback || Deno.env.get("PUBLIC_SITE_URL") || "https://lacos-de-fraternidade.github.io").replace(/\/$/, "");
  let origin = "";
  try {
    origin = requestedOrigin ? new URL(requestedOrigin).origin : "";
  } catch {
    origin = "";
  }
  if ((PUBLIC_SITE_ORIGINS as readonly string[]).includes(origin)) return origin;
  return base;
}

export function inviteActivateUrl(requestedOrigin?: string, fallback?: string) {
  return `${resolvePublicSiteUrl(requestedOrigin, fallback)}/area-restrita/ativar/`;
}

export function passwordResetUrl(requestedOrigin?: string, fallback?: string) {
  return `${resolvePublicSiteUrl(requestedOrigin, fallback)}/area-restrita/redefinir-senha/`;
}
