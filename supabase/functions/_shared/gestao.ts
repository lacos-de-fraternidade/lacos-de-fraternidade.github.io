import { jsonResponse } from "./cors.ts";
import { isValidCim, normalizeCim, normalizeEmail } from "./cim.ts";
import { revokeMemberAuth, serviceClient, writeAuthLog } from "./members.ts";
import { resolveAssignableProfile } from "./staff-actions.ts";

function maskCim(cim: string) {
  if (!cim) return "";
  if (cim.length <= 4) return "••••";
  return `${cim.slice(0, 2)}${"•".repeat(Math.max(2, cim.length - 4))}${cim.slice(-2)}`;
}

function asDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

function todayIso() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function isValidCalendarDate(day: number, month: number, year: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function birthFromPayload(payload: Record<string, unknown>) {
  const empty = (value: unknown) => value == null || value === "";
  const day = empty(payload.dia_nascimento) ? null : Number(payload.dia_nascimento);
  const month = empty(payload.mes_nascimento) ? null : Number(payload.mes_nascimento);
  const year = empty(payload.ano_nascimento) ? null : Number(payload.ano_nascimento);
  if (day == null && month == null && year == null) return { ok: true as const, day: null, month: null, year: null };
  if (day == null || month == null || Number.isNaN(day) || Number.isNaN(month)) {
    return { ok: false as const, error: "Informe uma data de nascimento válida." };
  }
  const checkYear = year || 2024;
  if (!isValidCalendarDate(day, month, checkYear)) {
    return { ok: false as const, error: "Informe uma data de nascimento válida." };
  }
  if (year != null) {
    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      return { ok: false as const, error: "Informe uma data de nascimento válida." };
    }
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso > todayIso()) return { ok: false as const, error: "Informe uma data de nascimento válida." };
  }
  return { ok: true as const, day, month, year };
}

function asBool(value: unknown) {
  return value === true;
}

function mapDbSaveError(error: { message?: string; details?: string } | null | undefined) {
  const text = `${error?.message || ""} ${error?.details || ""}`;
  if (/cim/i.test(text) && /unique|duplicate|already/i.test(text)) return "Esta CIM já está vinculada a outro Irmão.";
  if (/e-?mail/i.test(text) && /unique|duplicate|already/i.test(text)) return "Este e-mail já está vinculado a outro acesso.";
  return "Não foi possível salvar.";
}

async function historico(
  supabase: { from: (table: string) => any },
  row: { irmao_id?: string | null; acesso_id?: string | null; evento: string; detalhe?: string; criado_por?: string },
) {
  await supabase.from("irmaos_historico").insert({
    irmao_id: row.irmao_id || null,
    acesso_id: row.acesso_id || null,
    evento: row.evento,
    detalhe: row.detalhe || null,
    criado_por: row.criado_por || null,
  });
}

function mergeGestao(
  irmaos: Record<string, unknown>[],
  acessos: Record<string, unknown>[],
  quiet: Record<string, unknown>[],
  transfers: Record<string, unknown>[],
) {
  const accessByIrmao = new Map<string, Record<string, unknown>>();
  const orphanAccess: Record<string, unknown>[] = [];
  for (const acesso of acessos) {
    const irmaoId = String(acesso.irmao_id || "");
    if (irmaoId) accessByIrmao.set(irmaoId, acesso);
    else orphanAccess.push(acesso);
  }
  const quietByIrmao = new Map<string, Record<string, unknown>>();
  for (const row of quiet) {
    if (!row.encerrado_em) quietByIrmao.set(String(row.irmao_id), row);
  }
  const transferByIrmao = new Map<string, Record<string, unknown>>();
  for (const row of transfers) {
    if (!["concluida", "cancelada"].includes(String(row.status))) {
      transferByIrmao.set(String(row.irmao_id), row);
    }
  }
  const merged = irmaos.map((irmao) => {
    const acesso = accessByIrmao.get(String(irmao.id));
    const qp = quietByIrmao.get(String(irmao.id));
    const tr = transferByIrmao.get(String(irmao.id));
    return publicGestao(irmao, acesso, qp, tr);
  });
  for (const acesso of orphanAccess) {
    merged.push(publicGestao(null, acesso, null, null));
  }
  return merged.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

function publicGestao(
  irmao: Record<string, unknown> | null,
  acesso: Record<string, unknown> | null | undefined,
  quiet: Record<string, unknown> | null | undefined,
  transfer: Record<string, unknown> | null | undefined,
) {
  const cim = String(acesso?.cim || irmao?.cim || "");
  return {
    id: irmao?.id || acesso?.id,
    irmao_id: irmao?.id || acesso?.irmao_id || null,
    acesso_id: acesso?.id || null,
    nome: irmao?.nome || acesso?.nome || "",
    cim: cim || "",
    cim_mascarada: maskCim(cim),
    email: acesso?.email || irmao?.email || "",
    situacao: irmao ? String(irmao.situacao || "ativo") : (acesso?.ativo === false ? "inativo" : "ativo"),
    perfil: acesso?.perfil || null,
    ativo: irmao?.ativo !== false,
    conta_ativada: acesso?.conta_ativada === true,
    conta_ativada_em: acesso?.conta_ativada_em || null,
    cadastrado_em: irmao?.criado_em || null,
    acesso_ativo: acesso ? acesso.ativo !== false : null,
    bloqueado_ate: acesso?.bloqueado_ate || null,
    convite_enviado_em: acesso?.convite_enviado_em || null,
    convite_expira_em: acesso?.convite_expira_em || null,
    ultimo_acesso_em: acesso?.ultimo_acesso_em || null,
    dia_nascimento: irmao?.dia_nascimento || null,
    mes_nascimento: irmao?.mes_nascimento || null,
    ano_nascimento: irmao?.ano_nascimento || null,
    data_iniciacao: irmao?.data_iniciacao || acesso?.data_iniciacao || null,
    loja_iniciacao: irmao?.loja_iniciacao || null,
    quiet_placet: quiet
      ? {
        id: quiet.id,
        inicio_em: quiet.inicio_em,
        previsao_termino: quiet.previsao_termino,
        motivo: quiet.motivo,
        observacao: quiet.observacao,
        suspender_acesso: quiet.suspender_acesso === true,
      }
      : null,
    transferencia: transfer
      ? {
        id: transfer.id,
        data_solicitacao: transfer.data_solicitacao,
        loja_destino: transfer.loja_destino,
        oriente_destino: transfer.oriente_destino,
        status: transfer.status,
        observacao: transfer.observacao,
      }
      : null,
  };
}

async function loadGestao(supabase: { from: (table: string) => any }) {
  const [{ data: irmaos }, { data: acessos }, { data: quiet }, { data: transfers }] = await Promise.all([
    supabase.from("irmaos").select("id, nome, cim, email, situacao, ativo, dia_nascimento, mes_nascimento, ano_nascimento, data_iniciacao, loja_iniciacao, exibir_aniversario, exibir_iniciacao, criado_em").order("nome"),
    supabase.from("irmaos_autorizados").select("*").order("nome"),
    supabase.from("irmaos_quiet_placet").select("*").is("encerrado_em", null),
    supabase.from("irmaos_transferencias").select("*").in("status", ["solicitada", "em_analise", "aprovada"]),
  ]);
  return mergeGestao(irmaos || [], acessos || [], quiet || [], transfers || []);
}

export async function handleGestao(
  req: Request,
  acao: string,
  payload: Record<string, unknown>,
  supabase: { from: (table: string) => any; rpc?: (name: string, args?: Record<string, unknown>) => any },
  actor: { userId: string; memberId?: string; perfil?: string },
) {
  const actorId = actor.userId;
  const gestaoActions = [
    "listar_gestao",
    "listar_historico",
    "salvar_gestao_irmao",
    "quiet_placet",
    "encerrar_quiet_placet",
    "regularizar_situacao",
    "afastar_irmao",
    "transferencia",
    "atualizar_transferencia",
    "suspender_acesso",
    "reativar",
    "listar_eventos",
    "salvar_evento",
    "cancelar_evento",
    "gerar_sessoes",
    "listar_comunicados",
    "salvar_comunicado",
    "logs",
    "excluir_irmao",
  ];
  if (!gestaoActions.includes(acao)) return null;

  if (acao === "listar_gestao") {
    return jsonResponse(req, 200, { ok: true, irmaos: await loadGestao(supabase) });
  }

  if (acao === "listar_historico") {
    const irmaoId = String(payload.irmao_id || "");
    if (!irmaoId) return jsonResponse(req, 400, { ok: false, error: "Informe o Irmão." });
    const { data, error } = await supabase
      .from("irmaos_historico")
      .select("id, irmao_id, evento, detalhe, criado_em")
      .eq("irmao_id", irmaoId)
      .order("criado_em", { ascending: true })
      .limit(80);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível carregar o histórico." });
    return jsonResponse(req, 200, { ok: true, historico: data || [] });
  }

  if (acao === "logs") {
    const { data } = await supabase
      .from("logs_autenticacao")
      .select("id, evento, sucesso, criado_em, origem, auth_user_id")
      .order("criado_em", { ascending: false })
      .limit(400);
    const userIds = [...new Set((data || []).map((row: { auth_user_id?: string }) => row.auth_user_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: members } = await supabase.from("irmaos_autorizados").select("auth_user_id, nome").in("auth_user_id", userIds);
      for (const member of members || []) names.set(String(member.auth_user_id), String(member.nome));
    }
    const logs = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      evento: row.evento,
      sucesso: row.sucesso,
      criado_em: row.criado_em,
      origem: row.origem || null,
      usuario: names.get(String(row.auth_user_id || "")) || "Sistema",
    }));
    return jsonResponse(req, 200, { ok: true, logs });
  }

  if (acao === "salvar_gestao_irmao") {
    const nome = String(payload.nome || "").trim().replace(/\s+/g, " ");
    if (!nome) return jsonResponse(req, 400, { ok: false, error: "Informe o nome." });
    const cimRaw = payload.cim == null ? "" : String(payload.cim).trim();
    const cim = cimRaw ? normalizeCim(cimRaw) : "";
    const email = payload.email ? normalizeEmail(payload.email) : "";
    const irmaoId = String(payload.irmao_id || payload.id || "");
    if (cim && !isValidCim(cim)) return jsonResponse(req, 400, { ok: false, error: "Informe uma CIM válida." });
    if (email && !email.includes("@")) return jsonResponse(req, 400, { ok: false, error: "Informe um e-mail válido." });
    if (cim) {
      let cimQuery = supabase.from("irmaos").select("id").eq("cim", cim);
      if (irmaoId) cimQuery = cimQuery.neq("id", irmaoId);
      const { data: otherCim } = await cimQuery.maybeSingle();
      if (otherCim) return jsonResponse(req, 400, { ok: false, error: "Esta CIM já está vinculada a outro Irmão." });
    }
    if (email) {
      let emailQuery = supabase.from("irmaos").select("id").eq("email", email);
      if (irmaoId) emailQuery = emailQuery.neq("id", irmaoId);
      const { data: otherEmail } = await emailQuery.maybeSingle();
      if (otherEmail) return jsonResponse(req, 400, { ok: false, error: "Este e-mail já está vinculado a outro acesso." });
      const { data: otherAccess } = await supabase.from("irmaos_autorizados").select("id, irmao_id").eq("email", email).maybeSingle();
      if (otherAccess && String(otherAccess.irmao_id || "") !== irmaoId) {
        return jsonResponse(req, 400, { ok: false, error: "Este e-mail já está vinculado a outro acesso." });
      }
    }
    const birth = birthFromPayload(payload);
    if (!birth.ok) return jsonResponse(req, 400, { ok: false, error: birth.error });
    const iniciacao = asDate(payload.data_iniciacao);
    if (payload.data_iniciacao && iniciacao === undefined) {
      return jsonResponse(req, 400, { ok: false, error: "Informe uma data de iniciação válida." });
    }
    if (iniciacao && iniciacao > todayIso()) {
      return jsonResponse(req, 400, { ok: false, error: "Informe uma data de iniciação válida." });
    }
    const resolved = resolveAssignableProfile(actor.perfil, payload.perfil || "irmao");
    if (!resolved.ok) return jsonResponse(req, 403, { ok: false, error: resolved.error });
    const irmaoRow: Record<string, unknown> = {
      nome,
      email: email || null,
      dia_nascimento: birth.day,
      mes_nascimento: birth.month,
      ano_nascimento: birth.year,
      data_iniciacao: iniciacao ?? null,
      loja_iniciacao: String(payload.loja_iniciacao || "").trim() || null,
      situacao: ["ativo", "quiet_placet", "transferencia", "afastado", "inativo", "desligado", "falecido"].includes(String(payload.situacao || ""))
        ? String(payload.situacao)
        : "ativo",
      exibir_aniversario: payload.exibir_aniversario !== false,
      exibir_iniciacao: payload.exibir_iniciacao !== false,
      exibir_idade: false,
    };
    if (cim || !irmaoId) irmaoRow.cim = cim || null;
    let savedId = irmaoId;
    if (irmaoId) {
      const { data: previous } = await supabase.from("irmaos").select("cim, email, situacao").eq("id", irmaoId).maybeSingle();
      const { error } = await supabase.from("irmaos").update(irmaoRow).eq("id", irmaoId);
      if (error) return jsonResponse(req, 400, { ok: false, error: mapDbSaveError(error) });
      const details = [];
      if (cim && previous?.cim && String(previous.cim) !== cim) details.push("CIM alterada");
      if (email && previous?.email && String(previous.email) !== email) details.push("E-mail alterado");
      if (irmaoRow.situacao && previous?.situacao && String(previous.situacao) !== irmaoRow.situacao) details.push("Situação alterada");
      await writeAuthLog({ evento: "membro_editado", sucesso: true, req, authUserId: actorId });
      await historico(supabase, { irmao_id: irmaoId, evento: "membro_editado", detalhe: details.join("; ") || undefined, criado_por: actorId });
    } else {
      const { data, error } = await supabase.from("irmaos").insert(irmaoRow).select("id").maybeSingle();
      if (error || !data) return jsonResponse(req, 400, { ok: false, error: mapDbSaveError(error) || "Não foi possível salvar." });
      savedId = data.id;
      await writeAuthLog({ evento: "membro_criado", sucesso: true, req, authUserId: actorId });
      await historico(supabase, { irmao_id: savedId, evento: "membro_criado", criado_por: actorId });
    }
    const { data: existing } = await supabase.from("irmaos_autorizados").select("id").eq("irmao_id", savedId).maybeSingle();
    if (existing?.id) {
      const acesso: Record<string, unknown> = {
        nome,
        data_iniciacao: iniciacao ?? null,
      };
      if (cim) acesso.cim = cim;
      if (email) acesso.email = email;
      if (payload.perfil) acesso.perfil = resolved.perfil;
      await supabase.from("irmaos_autorizados").update(acesso).eq("id", existing.id);
    }
    return jsonResponse(req, 200, { ok: true, irmao_id: savedId });
  }

  if (acao === "quiet_placet") {
    const irmaoId = String(payload.irmao_id || "");
    const inicio = asDate(payload.inicio_em);
    const termino = asDate(payload.previsao_termino);
    const motivo = String(payload.motivo || "").trim();
    if (!irmaoId || !inicio) return jsonResponse(req, 400, { ok: false, error: "Informe a data de início." });
    if (!termino) return jsonResponse(req, 400, { ok: false, error: "Informe o término previsto." });
    if (termino <= inicio) return jsonResponse(req, 400, { ok: false, error: "O término deve ser posterior ao início." });
    if (!motivo) return jsonResponse(req, 400, { ok: false, error: "Informe o motivo do quiet placet." });
    await supabase.from("irmaos_quiet_placet").update({ encerrado_em: new Date().toISOString() }).eq("irmao_id", irmaoId).is("encerrado_em", null);
    const { error } = await supabase.from("irmaos_quiet_placet").insert({
      irmao_id: irmaoId,
      inicio_em: inicio,
      previsao_termino: termino,
      motivo,
      observacao: String(payload.observacao || "").trim() || null,
      suspender_acesso: asBool(payload.suspender_acesso),
      criado_por: actorId,
    });
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível registrar." });
    await supabase.from("irmaos").update({ situacao: "quiet_placet" }).eq("id", irmaoId);
    if (asBool(payload.suspender_acesso)) {
      const { data: acesso } = await supabase.from("irmaos_autorizados").select("*").eq("irmao_id", irmaoId).maybeSingle();
      if (acesso?.auth_user_id) await revokeMemberAuth(acesso.auth_user_id, true);
      if (acesso?.id) await supabase.from("irmaos_autorizados").update({ ativo: false }).eq("id", acesso.id);
      await writeAuthLog({ evento: "acesso_suspenso", sucesso: true, req, authUserId: actorId, cim: acesso?.cim });
    }
    await writeAuthLog({ evento: "quiet_placet_iniciado", sucesso: true, req, authUserId: actorId });
    await historico(supabase, { irmao_id: irmaoId, evento: "quiet_placet_iniciado", detalhe: String(payload.motivo || ""), criado_por: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "encerrar_quiet_placet") {
    const irmaoId = String(payload.irmao_id || "");
    await supabase.from("irmaos_quiet_placet").update({ encerrado_em: new Date().toISOString() }).eq("irmao_id", irmaoId).is("encerrado_em", null);
    await supabase.from("irmaos").update({ situacao: "ativo" }).eq("id", irmaoId);
    await writeAuthLog({ evento: "quiet_placet_encerrado", sucesso: true, req, authUserId: actorId });
    await historico(supabase, { irmao_id: irmaoId, evento: "quiet_placet_encerrado", criado_por: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "regularizar_situacao") {
    const irmaoId = String(payload.irmao_id || "");
    if (!irmaoId) return jsonResponse(req, 400, { ok: false, error: "Informe o Irmão." });
    const { error } = await supabase.from("irmaos").update({ situacao: "ativo" }).eq("id", irmaoId);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível regularizar." });
    await writeAuthLog({ evento: "membro_editado", sucesso: true, req, authUserId: actorId });
    await historico(supabase, { irmao_id: irmaoId, evento: "membro_editado", detalhe: "Regularização", criado_por: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "afastar_irmao") {
    const irmaoId = String(payload.irmao_id || "");
    if (!irmaoId) return jsonResponse(req, 400, { ok: false, error: "Informe o Irmão." });
    const { error } = await supabase.from("irmaos").update({ situacao: "afastado" }).eq("id", irmaoId);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível registrar o afastamento." });
    await writeAuthLog({ evento: "membro_editado", sucesso: true, req, authUserId: actorId });
    await historico(supabase, { irmao_id: irmaoId, evento: "membro_editado", detalhe: "Afastamento", criado_por: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "excluir_irmao") {
    const irmaoId = String(payload.irmao_id || "");
    if (!irmaoId) return jsonResponse(req, 400, { ok: false, error: "Informe o Irmão." });
    const { data: irmao } = await supabase.from("irmaos").select("id, nome").eq("id", irmaoId).maybeSingle();
    if (!irmao) return jsonResponse(req, 400, { ok: false, error: "Cadastro não encontrado." });
    const { data: acesso } = await supabase.from("irmaos_autorizados").select("*").eq("irmao_id", irmaoId).maybeSingle();
    if (acesso?.id && actor.memberId && String(acesso.id) === String(actor.memberId)) {
      return jsonResponse(req, 400, { ok: false, error: "Não é possível excluir o próprio cadastro." });
    }
    if (acesso?.auth_user_id && acesso.auth_user_id === actorId) {
      return jsonResponse(req, 400, { ok: false, error: "Não é possível excluir o próprio cadastro." });
    }
    if (acesso?.perfil === "administrador") {
      return jsonResponse(req, 400, { ok: false, error: "Não é possível excluir um Administrador." });
    }
    if (acesso?.auth_user_id) {
      const admin = serviceClient();
      await admin.auth.admin.deleteUser(acesso.auth_user_id);
    }
    if (acesso?.id) {
      const { error: accessError } = await supabase.from("irmaos_autorizados").delete().eq("id", acesso.id);
      if (accessError) return jsonResponse(req, 400, { ok: false, error: "Não foi possível excluir o acesso." });
    }
    const { error } = await supabase.from("irmaos").delete().eq("id", irmaoId);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível excluir o cadastro." });
    await writeAuthLog({ evento: "membro_excluido", sucesso: true, req, authUserId: actorId, cim: acesso?.cim });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "transferencia") {
    const irmaoId = String(payload.irmao_id || "");
    const dataSolicitacao = asDate(payload.data_solicitacao);
    const lojaDestino = String(payload.loja_destino || "").trim();
    const orienteDestino = String(payload.oriente_destino || "").trim();
    if (!irmaoId) return jsonResponse(req, 400, { ok: false, error: "Irmão inválido." });
    if (!lojaDestino) return jsonResponse(req, 400, { ok: false, error: "Informe a Loja de destino." });
    if (!orienteDestino) return jsonResponse(req, 400, { ok: false, error: "Informe o Oriente." });
    if (!dataSolicitacao) return jsonResponse(req, 400, { ok: false, error: "Informe a data da solicitação." });
    const { error } = await supabase.from("irmaos_transferencias").insert({
      irmao_id: irmaoId,
      data_solicitacao: dataSolicitacao,
      loja_destino: lojaDestino,
      oriente_destino: orienteDestino,
      observacao: String(payload.observacao || "").trim() || null,
      status: "solicitada",
      criado_por: actorId,
    });
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível registrar." });
    await supabase.from("irmaos").update({ situacao: "transferencia" }).eq("id", irmaoId);
    await writeAuthLog({ evento: "transferencia_iniciada", sucesso: true, req, authUserId: actorId });
    await historico(supabase, { irmao_id: irmaoId, evento: "transferencia_iniciada", criado_por: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "atualizar_transferencia") {
    const id = String(payload.id || "");
    const status = String(payload.status || "");
    if (!["solicitada", "em_analise", "aprovada", "concluida", "cancelada"].includes(status)) {
      return jsonResponse(req, 400, { ok: false, error: "Status inválido." });
    }
    const { data: current } = await supabase.from("irmaos_transferencias").select("*").eq("id", id).maybeSingle();
    if (!current) return jsonResponse(req, 400, { ok: false, error: "Registro não encontrado." });
    const updates: Record<string, unknown> = {
      status,
      loja_destino: payload.loja_destino !== undefined ? String(payload.loja_destino || "").trim() || null : current.loja_destino,
      oriente_destino: payload.oriente_destino !== undefined ? String(payload.oriente_destino || "").trim() || null : current.oriente_destino,
      observacao: payload.observacao !== undefined ? String(payload.observacao || "").trim() || null : current.observacao,
      atualizado_em: new Date().toISOString(),
    };
    if (status === "concluida") updates.concluida_em = new Date().toISOString();
    const { error } = await supabase.from("irmaos_transferencias").update(updates).eq("id", id);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível atualizar." });
    if (status === "concluida") {
      await supabase.from("irmaos").update({ situacao: "transferencia", ativo: false }).eq("id", current.irmao_id);
      const { data: acesso } = await supabase.from("irmaos_autorizados").select("*").eq("irmao_id", current.irmao_id).maybeSingle();
      if (acesso?.auth_user_id) await revokeMemberAuth(acesso.auth_user_id, true);
      if (acesso?.id) {
        await supabase.from("irmaos_autorizados").update({ ativo: false, conta_ativada: false }).eq("id", acesso.id);
      }
      await writeAuthLog({ evento: "transferencia_concluida", sucesso: true, req, authUserId: actorId, cim: acesso?.cim });
      await historico(supabase, { irmao_id: current.irmao_id, evento: "transferencia_concluida", criado_por: actorId });
    } else if (status === "cancelada") {
      await supabase.from("irmaos").update({ situacao: "ativo" }).eq("id", current.irmao_id);
    }
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "suspender_acesso" || acao === "reativar") {
    const acessoId = String(payload.acesso_id || payload.id || "");
    const { data: member } = await supabase.from("irmaos_autorizados").select("*").eq("id", acessoId).maybeSingle();
    if (!member) return jsonResponse(req, 400, { ok: false, error: "Acesso não encontrado." });
    if (acao === "suspender_acesso") {
      await revokeMemberAuth(member.auth_user_id, true);
      await supabase.from("irmaos_autorizados").update({ ativo: false }).eq("id", acessoId);
      await writeAuthLog({ evento: "acesso_suspenso", sucesso: true, req, authUserId: actorId, cim: member.cim });
    } else {
      await revokeMemberAuth(member.auth_user_id, false);
      await supabase.from("irmaos_autorizados").update({ ativo: true }).eq("id", acessoId);
      if (member.irmao_id) await supabase.from("irmaos").update({ situacao: "ativo", ativo: true }).eq("id", member.irmao_id);
      await writeAuthLog({ evento: "membro_editado", sucesso: true, req, authUserId: actorId, cim: member.cim });
    }
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "listar_eventos") {
    const { data } = await supabase.from("eventos_internos").select("*").order("inicia_em");
    return jsonResponse(req, 200, { ok: true, eventos: data || [] });
  }

  if (acao === "salvar_evento") {
    const titulo = String(payload.titulo || "").trim();
    const tipo = String(payload.tipo_evento || payload.tipo || "outro");
    const inicia = String(payload.inicia_em || "");
    if (!titulo || !inicia) return jsonResponse(req, 400, { ok: false, error: "Informe título e data." });
    const allowed = ["geral", "fundacao", "sessao_ordinaria", "sessao_administrativa", "sessao_magna", "reuniao", "comunicado", "outro"];
    if (!allowed.includes(tipo)) return jsonResponse(req, 400, { ok: false, error: "Tipo inválido." });
    const row: Record<string, unknown> = {
      titulo,
      descricao: String(payload.descricao || "").trim() || null,
      tipo_evento: tipo,
      inicia_em: inicia,
      fim_em: payload.fim_em || null,
      presenca_obrigatoria: asBool(payload.presenca_obrigatoria),
      destaque: asBool(payload.destaque),
      publicado: payload.publicado !== false,
      ativo: payload.ativo !== false,
      excepcional: true,
      gerado_automaticamente: false,
      atualizado_em: new Date().toISOString(),
      criado_por: actorId,
    };
    const id = String(payload.id || "");
    const { error } = id
      ? await supabase.from("eventos_internos").update(row).eq("id", id)
      : await supabase.from("eventos_internos").insert(row);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível salvar o evento." });
    await writeAuthLog({ evento: id ? "evento_editado" : "evento_criado", sucesso: true, req, authUserId: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "cancelar_evento") {
    const id = String(payload.id || "");
    const { error } = await supabase.from("eventos_internos").update({
      ativo: false,
      publicado: false,
      excepcional: true,
      atualizado_em: new Date().toISOString(),
    }).eq("id", id);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível cancelar." });
    await writeAuthLog({ evento: "evento_editado", sucesso: true, req, authUserId: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "gerar_sessoes") {
    const { data, error } = await supabase.rpc?.("gerar_sessoes_ordinarias", { p_meses: 12 });
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível gerar as sessões." });
    return jsonResponse(req, 200, { ok: true, gerados: data });
  }

  if (acao === "listar_comunicados") {
    const { data } = await supabase.from("comunicados_internos").select("*").order("criado_em", { ascending: false });
    return jsonResponse(req, 200, { ok: true, comunicados: data || [] });
  }

  if (acao === "salvar_comunicado") {
    const titulo = String(payload.titulo || "").trim();
    const corpo = String(payload.corpo || payload.mensagem || "").trim();
    if (!titulo || !corpo) return jsonResponse(req, 400, { ok: false, error: "Informe título e mensagem." });
    const tipo = String(payload.tipo || "informativo");
    const allowed = ["informativo", "financeiro", "urgente", "sessao", "administrativo"];
    if (!allowed.includes(tipo)) return jsonResponse(req, 400, { ok: false, error: "Tipo inválido." });
    const row = {
      titulo,
      corpo,
      tipo,
      prioridade: Number(payload.prioridade || 0) || 0,
      destaque: asBool(payload.destaque),
      presenca_obrigatoria: asBool(payload.presenca_obrigatoria),
      inicio_exibicao: payload.inicio_exibicao || null,
      fim_exibicao: payload.fim_exibicao || null,
      publicado: payload.publicado !== false,
      criado_por: actor.memberId || null,
      atualizado_em: new Date().toISOString(),
    };
    const id = String(payload.id || "");
    const { error } = id
      ? await supabase.from("comunicados_internos").update(row).eq("id", id)
      : await supabase.from("comunicados_internos").insert(row);
    if (error) return jsonResponse(req, 400, { ok: false, error: "Não foi possível salvar." });
    await writeAuthLog({ evento: "comunicado_publicado", sucesso: true, req, authUserId: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  return null;
}
