const INVITE_ERROR = "Este convite expirou ou já foi usado. Solicite um novo à Secretaria.";
const RECOVERY_ERROR = "Este link de redefinição expirou ou já foi usado. Solicite uma nova recuperação.";

function paramsFromLocation(locationLike) {
  const href = String(locationLike?.href || "");
  const url = href ? new URL(href, "http://localhost") : new URL("http://localhost");
  const hash = new URLSearchParams(String(locationLike?.hash || url.hash || "").replace(/^#/, ""));
  return {
    url,
    hash,
    search: url.searchParams,
  };
}

function defaultLinkType(url) {
  return String(url?.pathname || "").includes("redefinir-senha") ? "recovery" : "invite";
}

function expiredMessage(type) {
  return type === "recovery" ? RECOVERY_ERROR : INVITE_ERROR;
}

export function inviteLinkError(locationLike) {
  const { search, hash } = paramsFromLocation(locationLike);
  return search.get("error_description") || hash.get("error_description") || search.get("error") || hash.get("error") || "";
}

export function readAuthLink(locationLike = globalThis.location) {
  const { url, search, hash } = paramsFromLocation(locationLike);
  const type = search.get("type") || hash.get("type") || defaultLinkType(url);
  return {
    url,
    error: inviteLinkError(locationLike),
    tokenHash: search.get("token_hash") || hash.get("token_hash") || "",
    type,
    code: search.get("code") || hash.get("code") || "",
    hasFragmentSession: Boolean(hash.get("access_token")),
  };
}

export function pendingEmailAuthToken(locationLike = globalThis.location) {
  const link = readAuthLink(locationLike);
  return Boolean(!link.error && (link.tokenHash || link.code));
}

function stripConsumedAuthParams(locationLike) {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(String(locationLike?.href || window.location.href), window.location.origin);
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    url.searchParams.delete("code");
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    hash.delete("token_hash");
    hash.delete("type");
    hash.delete("code");
    const hashText = hash.toString();
    url.hash = hashText ? `#${hashText}` : "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Keep the original address if the browser refuses the rewrite.
  }
}

export async function consumeEmailAuthToken(supabase, locationLike = globalThis.location) {
  const link = readAuthLink(locationLike);
  if (link.error) return { session: null, error: expiredMessage(link.type) };

  if (link.tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
    if (error || !data?.session) return { session: null, error: expiredMessage(link.type) };
    stripConsumedAuthParams(locationLike);
    return { session: data.session };
  }

  if (link.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(link.code);
    if (error || !data?.session) return { session: null, error: expiredMessage(link.type) };
    stripConsumedAuthParams(locationLike);
    return { session: data.session };
  }

  return { session: null, error: expiredMessage(link.type) };
}

export async function establishAuthSession(supabase, locationLike = globalThis.location) {
  const link = readAuthLink(locationLike);
  if (link.error) return { session: null, pending: false, error: expiredMessage(link.type) };

  if (link.tokenHash || link.code) {
    return { session: null, pending: true, error: null };
  }

  const { data } = await supabase.auth.getSession();
  if (data?.session) return { session: data.session, pending: false, error: null };

  if (link.hasFragmentSession) {
    return { session: null, pending: false, error: expiredMessage(link.type) };
  }
  if (link.url.pathname.includes("/ativar")) {
    return {
      session: null,
      pending: false,
      error: "Abra o convite recebido por e-mail para continuar. Se o link abrir uma página inexistente no site publicado, troque o início do endereço por http://localhost:8080 mantendo o restante.",
    };
  }
  return { session: null, pending: false, error: "Abra o link enviado ao seu e-mail para continuar." };
}
