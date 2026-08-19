import { areaClient, invokeFunction } from "./client.js";

const LOGIN_URL = "/area-restrita/login/";
const HOME_URL = "/area-restrita/";
const ADMIN_URL = "/area-restrita/administracao/";

export async function requireMember(options = {}) {
  const supabase = areaClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace(LOGIN_URL);
    return null;
  }
  const { data: profile } = await supabase
    .from("irmaos_autorizados")
    .select("id, nome, perfil, ativo, conta_ativada, email, cim")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();
  if (!profile || profile.ativo !== true || profile.conta_ativada !== true) {
    await supabase.auth.signOut();
    window.location.replace(LOGIN_URL);
    return null;
  }
  if (options.staff && !["secretario", "administrador"].includes(profile.perfil)) {
    window.location.replace(HOME_URL);
    return null;
  }
  if (options.admin && profile.perfil !== "administrador") {
    window.location.replace(ADMIN_URL);
    return null;
  }
  return { supabase, session, profile };
}

export async function signOut(supabase, accessToken) {
  try {
    await invokeFunction("gerenciar-irmao", { acao: "registrar_logout" }, accessToken);
  } catch {
    // Logging must not block exit.
  }
  await supabase.auth.signOut();
  window.location.replace(LOGIN_URL);
}

export function firstName(nome) {
  return String(nome || "Irmão").trim().split(/\s+/)[0];
}
