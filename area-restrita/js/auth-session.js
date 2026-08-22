const INVITE_ERROR = "Este convite expirou ou já foi usado. Solicite um novo à Secretaria.";

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

export function inviteLinkError(locationLike) {
  const { search, hash } = paramsFromLocation(locationLike);
  return search.get("error_description") || hash.get("error_description") || search.get("error") || hash.get("error") || "";
}

export async function establishAuthSession(supabase, locationLike = globalThis.location) {
  const { url, search, hash } = paramsFromLocation(locationLike);
  const described = inviteLinkError(locationLike);
  if (described) return { session: null, error: INVITE_ERROR };

  const tokenHash = search.get("token_hash") || hash.get("token_hash");
  const type = search.get("type") || hash.get("type") || "invite";
  const code = search.get("code");

  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error || !data?.session) return { session: null, error: INVITE_ERROR };
    return { session: data.session };
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.session) return { session: data.session };
  }

  const { data } = await supabase.auth.getSession();
  if (data?.session) return { session: data.session };

  const hasInviteHint = Boolean(tokenHash || code || hash.get("access_token") || search.get("access_token"));
  if (hasInviteHint) return { session: null, error: INVITE_ERROR };
  if (url.pathname.includes("/ativar")) {
    return {
      session: null,
      error: "Abra o convite recebido por e-mail para continuar. Se o link abrir uma página inexistente no site publicado, troque o início do endereço por http://localhost:8080 mantendo o restante.",
    };
  }
  return { session: null, error: "Abra o link enviado ao seu e-mail para continuar." };
}
