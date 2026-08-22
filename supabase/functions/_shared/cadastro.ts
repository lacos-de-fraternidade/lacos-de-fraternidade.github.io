import { jsonResponse } from "./cors.ts";
import { writeAuthLog } from "./members.ts";

const PARENTESCO = ["esposa", "companheira", "filho", "filha", "pai", "mae", "outro"];
const CONJUGE_PARENTESCO = ["esposa", "companheira"];

function asInt(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
}

function asDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

function mapFamily(row: Record<string, unknown>) {
  const irmao = row.irmaos as { nome?: string } | null;
  return { ...row, irmao_nome: irmao?.nome || "", irmaos: undefined };
}

function isConjugeParentesco(parentesco: unknown) {
  return CONJUGE_PARENTESCO.includes(String(parentesco || ""));
}

export function validateCasamentoPayload(input: {
  irmao?: { id: string; ativo?: boolean } | null;
  familiar?: { id: string; irmao_id?: string; parentesco?: string; ativo?: boolean } | null;
  casamentos?: { id?: string; irmao_id?: string; conjuge_id?: string | null; ativo?: boolean }[];
  exceptId?: string;
}) {
  const { irmao, familiar, casamentos = [], exceptId } = input;
  if (!irmao || irmao.ativo === false) return { ok: false, error: "Irmão indisponível para casamento." };
  const active = casamentos.filter((row) => row.ativo !== false && row.id !== exceptId);
  if (active.some((row) => row.irmao_id === irmao.id)) {
    return { ok: false, error: "Este Irmão já possui casamento ativo." };
  }
  if (!familiar) return { ok: false, error: "Selecione uma cunhada elegível." };
  if (familiar.ativo === false || !isConjugeParentesco(familiar.parentesco)) {
    return { ok: false, error: "Cônjuge incompatível." };
  }
  if (familiar.irmao_id !== irmao.id) {
    return { ok: false, error: "A cunhada precisa pertencer ao cadastro deste Irmão." };
  }
  if (active.some((row) => row.conjuge_id === familiar.id)) {
    return { ok: false, error: "Esta cunhada já está vinculada a um casamento ativo." };
  }
  return { ok: true };
}

export async function handleCadastro(
  req: Request,
  acao: string,
  payload: Record<string, unknown>,
  supabase: { from: (table: string) => any },
) {
  if (![
    "listar_cadastro",
    "salvar_irmao",
    "salvar_familiar",
    "salvar_casamento",
    "remover_familiar",
    "remover_casamento",
  ].includes(acao)) return null;

  if (acao === "listar_cadastro") {
    const [{ data: irmaos }, { data: familiares }, { data: casamentos }] = await Promise.all([
      supabase.from("irmaos").select("id, nome, cim, email, situacao, dia_nascimento, mes_nascimento, data_iniciacao, loja_iniciacao, ativo, exibir_aniversario, exibir_iniciacao, exibir_idade").order("nome"),
      supabase.from("familiares").select("id, irmao_id, nome, parentesco, dia_nascimento, mes_nascimento, ativo, autorizado_exibicao, irmaos(nome)").order("nome"),
      supabase.from("casamentos").select("id, irmao_id, conjuge_id, data_casamento, ativo, autorizado_exibicao, irmaos(nome)").order("data_casamento"),
    ]);
    return jsonResponse(req, 200, {
      ok: true,
      irmaos: irmaos || [],
      familiares: (familiares || []).map((row) => mapFamily(row as Record<string, unknown>)),
      casamentos: (casamentos || []).map((row) => mapFamily(row as Record<string, unknown>)),
    });
  }

  if (acao === "salvar_irmao") {
    const nome = String(payload.nome || "").trim().replace(/\s+/g, " ");
    if (!nome) return jsonResponse(req, 400, { ok: false, error: "Dados inválidos." });
    const dia = asInt(payload.dia_nascimento, 1, 31);
    const mes = asInt(payload.mes_nascimento, 1, 12);
    const dataIniciacao = asDate(payload.data_iniciacao);
    if (dia === undefined || mes === undefined || dataIniciacao === undefined) {
      return jsonResponse(req, 400, { ok: false, error: "Dados inválidos." });
    }
    const row: Record<string, unknown> = {
      nome,
      dia_nascimento: dia,
      mes_nascimento: mes,
      data_iniciacao: dataIniciacao,
      loja_iniciacao: String(payload.loja_iniciacao || "").trim() || null,
      exibir_aniversario: payload.exibir_aniversario !== false,
      exibir_iniciacao: payload.exibir_iniciacao !== false,
      exibir_idade: false,
    };
    if (payload.ativo !== undefined) row.ativo = payload.ativo === true;
    const id = String(payload.id || "");
    const { error } = id
      ? await supabase.from("irmaos").update(row).eq("id", id)
      : await supabase.from("irmaos").insert(row);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível salvar." });
    await writeAuthLog({ evento: id ? "membro_editado" : "membro_criado", sucesso: true, req });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "salvar_familiar") {
    const nome = String(payload.nome || "").trim().replace(/\s+/g, " ");
    const irmaoId = String(payload.irmao_id || "");
    const parentesco = String(payload.parentesco || "");
    const dia = asInt(payload.dia_nascimento, 1, 31);
    const mes = asInt(payload.mes_nascimento, 1, 12);
    if (!nome || !irmaoId || !PARENTESCO.includes(parentesco) || dia === undefined || mes === undefined) {
      return jsonResponse(req, 400, { ok: false, error: "Dados inválidos." });
    }
    const row = {
      irmao_id: irmaoId,
      nome,
      parentesco,
      dia_nascimento: dia,
      mes_nascimento: mes,
      autorizado_exibicao: payload.autorizado_exibicao === true,
      ativo: true,
    };
    const id = String(payload.id || "");
    const { error } = id
      ? await supabase.from("familiares").update(row).eq("id", id)
      : await supabase.from("familiares").insert(row);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível salvar." });
    await writeAuthLog({ evento: id ? "familiar_editado" : "familiar_criado", sucesso: true, req });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "salvar_casamento") {
    const irmaoId = String(payload.irmao_id || "");
    const conjugeId = String(payload.conjuge_id || "");
    const dataCasamento = asDate(payload.data_casamento);
    if (!irmaoId || !conjugeId || !dataCasamento) return jsonResponse(req, 400, { ok: false, error: "Dados inválidos." });
    const exceptId = String(payload.id || "") || undefined;
    const [{ data: irmao }, { data: familiar }, { data: casamentos }] = await Promise.all([
      supabase.from("irmaos").select("id, ativo").eq("id", irmaoId).maybeSingle(),
      supabase.from("familiares").select("id, irmao_id, parentesco, ativo").eq("id", conjugeId).maybeSingle(),
      supabase.from("casamentos").select("id, irmao_id, conjuge_id, ativo"),
    ]);
    const check = validateCasamentoPayload({
      irmao,
      familiar,
      casamentos: casamentos || [],
      exceptId,
    });
    if (!check.ok) return jsonResponse(req, 400, { ok: false, error: check.error });
    const row = {
      irmao_id: irmaoId,
      conjuge_id: conjugeId,
      data_casamento: dataCasamento,
      autorizado_exibicao: payload.autorizado_exibicao === true,
      ativo: true,
    };
    const { error } = exceptId
      ? await supabase.from("casamentos").update(row).eq("id", exceptId)
      : await supabase.from("casamentos").insert(row);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível salvar." });
    await writeAuthLog({ evento: "casamento_criado", sucesso: true, req });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "remover_familiar") {
    const { error } = await supabase.from("familiares").update({ ativo: false }).eq("id", String(payload.id || ""));
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível salvar." });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "remover_casamento") {
    const { error } = await supabase.from("casamentos").update({ ativo: false }).eq("id", String(payload.id || ""));
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível salvar." });
    return jsonResponse(req, 200, { ok: true });
  }

  return null;
}
