import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { loadCandidaturaDossie } from "../_shared/dossie-secretaria.ts";
import { sendSecretarioEmail } from "../_shared/email.ts";
import { GENERIC_INVITE_ERROR, requireActiveMember, serviceClient } from "../_shared/members.ts";
import { isStaffProfile } from "../_shared/staff-actions.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function maskId(id: string) {
  return String(id || "").slice(0, 8);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") {
    return jsonResponse(req, 405, { ok: false, error: "Método não permitido." });
  }
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  const identity = await requireActiveMember(req);
  if (identity instanceof Response) return identity;
  if (!isStaffProfile(identity.member.perfil)) {
    return jsonResponse(req, 403, { ok: false, error: GENERIC_INVITE_ERROR });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { ok: false, error: "Não foi possível ler os dados enviados." });
  }

  const acao = String(payload.acao || "").trim();
  const interesseId = String(payload.interesse_id || "").trim();
  if (acao !== "inspecionar" && acao !== "reenviar") {
    return jsonResponse(req, 400, { ok: false, error: "Informe acao inspecionar ou reenviar." });
  }
  if (!UUID_RE.test(interesseId)) {
    return jsonResponse(req, 400, { ok: false, error: "Informe o identificador da candidatura." });
  }

  const loaded = await loadCandidaturaDossie(serviceClient(), interesseId);
  if (!loaded.ok) {
    return jsonResponse(req, 404, { ok: false, error: loaded.error });
  }

  const inspecao = {
    id_mask: maskId(interesseId),
    ...loaded.inspecao,
    documentos_pendentes: loaded.missingDocumentos,
  };

  if (acao === "inspecionar") {
    return jsonResponse(req, 200, { ok: true, inspecao });
  }

  try {
    const sent = await sendSecretarioEmail(loaded.payload);
    return jsonResponse(req, 200, {
      ok: true,
      enviado: Boolean(sent.sent),
      id_mask: maskId(interesseId),
      inspecao,
    });
  } catch (error) {
    console.error("Falha no reenvio do dossiê", { name: error instanceof Error ? error.name : "erro" });
    return jsonResponse(req, 500, { ok: false, error: "Não foi possível reenviar o dossiê.", id_mask: maskId(interesseId) });
  }
});
