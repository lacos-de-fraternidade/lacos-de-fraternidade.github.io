import { areaClient, invokeFunction } from "./client.js";
import { isAdminProfile, isStaffProfile } from "./perfis.js";

const LOGIN_URL = "/area-restrita/login/";
const HOME_URL = "/area-restrita/";
const ADMIN_URL = "/area-restrita/";
const PUBLIC_ABOUT_URL = "/sobre.html";

async function loadOfficeFields(supabase, profile) {
  if (!profile?.irmao_id) return { cargo_institucional: null, situacao: null };
  const [{ data: irmao }, { data: cargo }] = await Promise.all([
    supabase.from("irmaos").select("situacao").eq("id", profile.irmao_id).maybeSingle(),
    supabase.from("irmaos_cargos").select("cargo").eq("irmao_id", profile.irmao_id).is("encerrado_em", null).maybeSingle(),
  ]);
  return {
    cargo_institucional: cargo?.cargo || null,
    situacao: irmao?.situacao || null,
  };
}

export async function requireMember(options = {}) {
  const supabase = areaClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace(LOGIN_URL);
    return null;
  }
  const { data: profile } = await supabase
    .from("irmaos_autorizados")
    .select("id, nome, perfil, ativo, conta_ativada, email, cim, irmao_id, ultimo_acesso_em")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();
  if (!profile || profile.ativo !== true || profile.conta_ativada !== true) {
    await supabase.auth.signOut();
    window.location.replace(LOGIN_URL);
    return null;
  }
  const office = await loadOfficeFields(supabase, profile);
  const fullProfile = { ...profile, ...office };
  if (options.staff && !isStaffProfile(fullProfile.perfil)) {
    window.location.replace(HOME_URL);
    return null;
  }
  if (options.admin && !isAdminProfile(fullProfile.perfil)) {
    window.location.replace(ADMIN_URL);
    return null;
  }
  return { supabase, session, profile: fullProfile };
}

export async function signOut(supabase, accessToken) {
  try {
    await invokeFunction("gerenciar-irmao", { acao: "registrar_logout" }, accessToken);
  } catch {
    // Logging must not block exit.
  }
  await supabase.auth.signOut();
  window.location.replace(PUBLIC_ABOUT_URL);
}

export function firstName(nome) {
  return String(nome || "Irmão").trim().split(/\s+/)[0];
}
