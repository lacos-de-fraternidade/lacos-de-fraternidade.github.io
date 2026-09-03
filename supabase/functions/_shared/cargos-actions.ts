import { jsonResponse } from "./cors.ts";
import {
  canAssignCargo,
  isInstitutionalOffice,
} from "./cargos.ts";

type RpcClient = {
  rpc?: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

function rpcResult(data: unknown): { ok?: boolean; status?: number; error?: string } {
  if (data && typeof data === "object") return data as { ok?: boolean; status?: number; error?: string };
  return {};
}

export async function handleCargos(
  req: Request,
  acao: string,
  payload: Record<string, unknown>,
  supabase: RpcClient,
  actor: { userId: string; member: { ativo?: boolean; conta_ativada?: boolean; perfil?: string } },
) {
  if (acao !== "atribuir_cargo" && acao !== "encerrar_cargo") return null;

  const irmaoId = String(payload.irmao_id || "");
  if (!irmaoId) return jsonResponse(req, 400, { ok: false, error: "Informe o Irmão." });
  const motivo = String(payload.motivo || "").trim() || null;

  if (acao === "atribuir_cargo") {
    const cargo = String(payload.cargo || "");
    if (!isInstitutionalOffice(cargo)) {
      return jsonResponse(req, 400, { ok: false, error: "Cargo institucional inválido." });
    }
    if (!canAssignCargo(actor.member, cargo)) {
      return jsonResponse(req, 403, { ok: false, error: "Não autorizado." });
    }
    const { data, error } = await supabase.rpc?.("atribuir_cargo_institucional", {
      p_irmao_id: irmaoId,
      p_cargo: cargo,
      p_actor_auth_user_id: actor.userId,
      p_motivo: motivo,
    }) || { data: null, error: { message: "rpc_unavailable" } };
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível atribuir o cargo." });
    const result = rpcResult(data);
    if (!result.ok) {
      return jsonResponse(req, Number(result.status || 400), {
        ok: false,
        error: result.error === "forbidden" ? "Não autorizado." : (result.error || "Não foi possível atribuir o cargo."),
      });
    }
    return jsonResponse(req, 200, { ok: true, cargo, irmao_id: irmaoId });
  }

  const { data, error } = await supabase.rpc?.("encerrar_cargo_institucional", {
    p_irmao_id: irmaoId,
    p_actor_auth_user_id: actor.userId,
    p_motivo: motivo,
  }) || { data: null, error: { message: "rpc_unavailable" } };
  if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível encerrar o cargo." });
  const result = rpcResult(data);
  if (!result.ok) {
    return jsonResponse(req, Number(result.status || 400), {
      ok: false,
      error: result.error === "forbidden" ? "Não autorizado." : (result.error || "Não foi possível encerrar o cargo."),
    });
  }
  return jsonResponse(req, 200, { ok: true, irmao_id: irmaoId, cargo: result.cargo || null });
}
