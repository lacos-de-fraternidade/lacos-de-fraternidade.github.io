import { jsonResponse } from "./cors.ts";

function collectExpectedKeys() {
  const keys = [
    Deno.env.get("SUPABASE_ANON_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
  ].filter((value): value is string => Boolean(value));

  const named = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (named) {
    try {
      const parsed = JSON.parse(named) as Record<string, string>;
      keys.push(...Object.values(parsed));
    } catch {
      // Ignore malformed secret JSON and keep the other known keys.
    }
  }

  return keys;
}

export function unauthorizedResponse(req: Request) {
  return jsonResponse(req, 401, { ok: false, error: "Chave de acesso inválida." });
}

export function hasValidPublishableKey(req: Request) {
  const apiKey = req.headers.get("apikey") ?? "";
  if (!apiKey) return false;

  const expected = collectExpectedKeys();
  if (expected.length > 0) return expected.includes(apiKey);

  return apiKey.startsWith("sb_publishable_") || apiKey.startsWith("eyJ");
}
