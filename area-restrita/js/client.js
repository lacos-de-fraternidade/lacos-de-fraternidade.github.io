import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm";

export function areaClient() {
  const cfg = window.APP_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
    throw new Error("Configuração indisponível.");
  }
  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });
}

export async function invokeFunction(name, body = {}, accessToken) {
  const cfg = window.APP_CONFIG;
  const response = await fetch(`${cfg.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${accessToken || cfg.supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
