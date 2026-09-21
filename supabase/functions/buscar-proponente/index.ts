import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import { PROPONENTE_MIN_CHARS } from "../_shared/candidatura.ts";
import { clientIp, serviceClient } from "../_shared/members.ts";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { ok: false, error: "Método não permitido." });
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { ok: false, error: "Não foi possível ler a busca." });
  }

  const q = String(payload.q || payload.query || "").trim();
  if (q.length < PROPONENTE_MIN_CHARS) {
    return jsonResponse(req, 200, { ok: true, resultados: [] });
  }
  if (q.length > 80) {
    return jsonResponse(req, 400, { ok: false, error: "Refine a busca." });
  }

  const supabase = serviceClient();
  const ip = clientIp(req) || "unknown";
  const chave = await sha256Hex(`proponente:${ip}`);
  const now = new Date();
  const { data: rate } = await supabase.from("candidatura_busca_rate").select("*").eq("chave", chave).maybeSingle();
  if (rate && now.getTime() - new Date(rate.janela_inicio).getTime() < WINDOW_MS && (rate.falhas || 0) >= MAX_PER_WINDOW) {
    return jsonResponse(req, 429, { ok: false, error: "Muitas buscas. Tente novamente em instantes." });
  }
  if (!rate || now.getTime() - new Date(rate.janela_inicio).getTime() >= WINDOW_MS) {
    await supabase.from("candidatura_busca_rate").upsert({
      chave,
      falhas: 1,
      janela_inicio: now.toISOString(),
    });
  } else {
    await supabase.from("candidatura_busca_rate").update({ falhas: (rate.falhas || 0) + 1 }).eq("chave", chave);
  }

  const { data, error } = await supabase.rpc("buscar_proponentes_publicos", { p_q: q });
  if (error) {
    console.error("buscar_proponentes", error.code || "erro");
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível buscar." });
  }

  const resultados = (data || []).map((row: { id: string; nome: string }) => ({
    id: row.id,
    nome: row.nome,
  }));
  return jsonResponse(req, 200, { ok: true, resultados });
});
