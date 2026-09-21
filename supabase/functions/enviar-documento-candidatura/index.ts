import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import {
  documentExtension,
  isAllowedDocumentType,
  MAX_DOC_BYTES,
  MAX_DOC_MB,
  validateDocumentFile,
} from "../_shared/candidatura.ts";
import { serviceClient } from "../_shared/members.ts";

function safeErrorLog(scope: string, error: { code?: string; message?: string; statusCode?: string } | null, extra: Record<string, unknown> = {}) {
  const message = String(error?.message || "erro")
    .replace(/Failing row contains[\s\S]*/i, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .slice(0, 180)
    .trim();
  console.error(scope, JSON.stringify({
    code: String(error?.code || error?.statusCode || ""),
    message,
    ...extra,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { ok: false, error: "Método não permitido." });
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_DOC_BYTES + 64_000) {
    return jsonResponse(req, 413, { ok: false, error: `Arquivo acima do limite de ${MAX_DOC_MB} MB.` });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse(req, 400, { ok: false, error: "Não foi possível ler o arquivo." });
  }

  const token = String(form.get("token") || "").trim();
  const tipo = String(form.get("tipo") || "").trim();
  const file = form.get("arquivo");
  if (!token || !(file instanceof File)) {
    return jsonResponse(req, 400, { ok: false, error: "Envie o documento e o comprovante de envio." });
  }
  if (!isAllowedDocumentType(tipo)) {
    return jsonResponse(req, 422, { ok: false, error: "Tipo de documento inválido." });
  }

  const mime = file.type || "application/octet-stream";
  const invalid = validateDocumentFile({ tipo, mime, size: file.size, name: file.name });
  if (invalid) return jsonResponse(req, 422, { ok: false, error: invalid });

  const supabase = serviceClient();
  const tokenHash = await sha256Hex(token);
  const { data: row } = await supabase
    .from("interesse_upload_token")
    .select("id, interesse_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return jsonResponse(req, 410, { ok: false, error: "O envio de documentos expirou. Envie o cadastro novamente." });
  }

  const { data: existing } = await supabase
    .from("interesse_documentos")
    .select("id, storage_path")
    .eq("interesse_id", row.interesse_id)
    .eq("tipo", tipo)
    .maybeSingle();

  const documentoId = existing?.id || crypto.randomUUID();
  const ext = documentExtension(mime, file.name);
  const storagePath = `${row.interesse_id}/${documentoId}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("candidaturas-documentos")
    .upload(storagePath, bytes, { contentType: mime, upsert: true });
  if (uploadError) {
    safeErrorLog("candidaturas-documentos upload", uploadError, { tipo });
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível enviar o documento." });
  }

  const meta = {
    interesse_id: row.interesse_id,
    tipo,
    storage_path: storagePath,
    mime,
    tamanho: file.size,
    nome_original: String(file.name || "documento").slice(0, 180),
    atualizado_em: new Date().toISOString(),
  };
  const saved = existing
    ? await supabase.from("interesse_documentos").update(meta).eq("id", existing.id)
    : await supabase.from("interesse_documentos").insert({ id: documentoId, ...meta });
  if (saved.error) {
    safeErrorLog("interesse_documentos persist", saved.error, {
      tipo,
      hadExisting: Boolean(existing),
    });
    if (!existing || existing.storage_path !== storagePath) {
      const { error: cleanupError } = await supabase.storage
        .from("candidaturas-documentos")
        .remove([storagePath]);
      if (cleanupError) {
        safeErrorLog("candidaturas-documentos cleanup", cleanupError, { tipo });
      }
    }
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível registrar o documento." });
  }

  if (existing?.storage_path && existing.storage_path !== storagePath) {
    const { error: staleError } = await supabase.storage
      .from("candidaturas-documentos")
      .remove([existing.storage_path]);
    if (staleError) {
      safeErrorLog("candidaturas-documentos stale-remove", staleError, { tipo });
    }
  }

  return jsonResponse(req, 200, { ok: true, tipo, substituido: Boolean(existing) });
});
