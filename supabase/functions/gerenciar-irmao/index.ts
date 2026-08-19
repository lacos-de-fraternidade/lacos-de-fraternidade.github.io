import { hasValidPublishableKey, unauthorizedResponse } from "../_shared/auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { isValidCim, normalizeCim, normalizeEmail } from "../_shared/cim.ts";
import {
  GENERIC_INVITE_ERROR,
  inviteExpiresAt,
  requireActiveMember,
  revokeMemberAuth,
  sendMemberInvite,
  serviceClient,
  writeAuthLog,
} from "../_shared/members.ts";
import { authorizeGerenciarAcao } from "../_shared/staff-actions.ts";

function maskCim(cim: string) {
  if (cim.length <= 4) return "****";
  return `${cim.slice(0, 2)}${"•".repeat(Math.max(2, cim.length - 4))}${cim.slice(-2)}`;
}

function publicMember(row: Record<string, unknown>) {
  return {
    id: row.id,
    nome: row.nome,
    cim_mascarada: maskCim(String(row.cim || "")),
    email: row.email,
    perfil: row.perfil,
    ativo: row.ativo,
    conta_ativada: row.conta_ativada,
    convite_enviado_em: row.convite_enviado_em,
    ultimo_acesso_em: row.ultimo_acesso_em,
    bloqueado_ate: row.bloqueado_ate,
    data_nascimento: row.data_nascimento,
    data_iniciacao: row.data_iniciacao,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return jsonResponse(req, 405, { ok: false, error: GENERIC_INVITE_ERROR });
  if (!hasValidPublishableKey(req)) return unauthorizedResponse(req);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
  }

  const acao = String(payload.acao || "");
  const identity = await requireActiveMember(req);
  if (identity instanceof Response) return identity;

  const allowed = authorizeGerenciarAcao(identity.member, acao);
  if (!allowed.ok) {
    return jsonResponse(req, allowed.status, { ok: false, error: GENERIC_INVITE_ERROR });
  }

  const actorId = identity.user.id;
  const actorPerfil = identity.member.perfil;
  const supabase = serviceClient();
  const { data: config } = await supabase.from("configuracoes_autenticacao").select("*").eq("id", 1).maybeSingle();
  const expiresAt = inviteExpiresAt(config);

  if (acao === "listar") {
    const { data } = await supabase.from("irmaos_autorizados").select("*").order("nome");
    return jsonResponse(req, 200, { ok: true, membros: (data || []).map(publicMember) });
  }

  if (acao === "logs") {
    const { data } = await supabase.from("logs_autenticacao").select("id, evento, sucesso, criado_em, user_agent").order("criado_em", { ascending: false }).limit(200);
    return jsonResponse(req, 200, { ok: true, logs: data || [] });
  }

  if (acao === "criar") {
    const cim = normalizeCim(payload.cim);
    const email = normalizeEmail(payload.email);
    const nome = String(payload.nome || "").trim();
    const perfil = actorPerfil === "administrador" ? String(payload.perfil || "irmao") : "irmao";
    if (!isValidCim(cim) || !nome || !email.includes("@")) {
      return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    }
    const { data, error } = await supabase.from("irmaos_autorizados").insert({
      cim,
      nome,
      email,
      perfil: ["irmao", "secretario", "administrador"].includes(perfil) ? perfil : "irmao",
      ativo: true,
      data_nascimento: payload.data_nascimento || null,
      data_iniciacao: payload.data_iniciacao || null,
    }).select("*").maybeSingle();
    if (error || !data) return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    return jsonResponse(req, 200, { ok: true, membro: publicMember(data) });
  }

  if (acao === "atualizar") {
    const id = String(payload.id || "");
    const updates: Record<string, unknown> = {};
    if (payload.nome) updates.nome = String(payload.nome).trim();
    if (payload.email) updates.email = normalizeEmail(payload.email);
    if (payload.cim) updates.cim = normalizeCim(payload.cim);
    if (payload.data_nascimento !== undefined) updates.data_nascimento = payload.data_nascimento || null;
    if (payload.data_iniciacao !== undefined) updates.data_iniciacao = payload.data_iniciacao || null;
    const { data, error } = await supabase.from("irmaos_autorizados").update(updates).eq("id", id).select("*").maybeSingle();
    if (error || !data) return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    return jsonResponse(req, 200, { ok: true, membro: publicMember(data) });
  }

  if (acao === "enviar_convite" || acao === "reenviar_convite") {
    const id = String(payload.id || "");
    const { data: member } = await supabase.from("irmaos_autorizados").select("*").eq("id", id).maybeSingle();
    if (!member || !member.ativo) return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    await sendMemberInvite(member, expiresAt, req, actorId);
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "ativar" || acao === "desativar") {
    const id = String(payload.id || "");
    const { data: member } = await supabase.from("irmaos_autorizados").select("*").eq("id", id).maybeSingle();
    if (!member) return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    if (acao === "desativar") {
      await revokeMemberAuth(member.auth_user_id, true);
      await supabase.from("irmaos_autorizados").update({ ativo: false }).eq("id", id);
      await writeAuthLog({ cim: member.cim, evento: "conta_desativada", sucesso: true, req, authUserId: actorId });
    } else {
      await revokeMemberAuth(member.auth_user_id, false);
      await supabase.from("irmaos_autorizados").update({ ativo: true }).eq("id", id);
    }
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "alterar_perfil") {
    const id = String(payload.id || "");
    const perfil = String(payload.perfil || "");
    if (!["irmao", "secretario", "administrador"].includes(perfil)) {
      return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    }
    const { error } = await supabase.from("irmaos_autorizados").update({ perfil }).eq("id", id);
    if (error) return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "desbloquear") {
    const id = String(payload.id || "");
    const { error } = await supabase.from("irmaos_autorizados").update({
      tentativas_falhas: 0,
      bloqueado_ate: null,
    }).eq("id", id);
    if (error) return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "revogar") {
    const id = String(payload.id || "");
    const { data: member } = await supabase.from("irmaos_autorizados").select("*").eq("id", id).maybeSingle();
    if (!member) return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
    await revokeMemberAuth(member.auth_user_id, true);
    await supabase.from("irmaos_autorizados").update({
      ativo: false,
      conta_ativada: false,
      auth_user_id: null,
    }).eq("id", id);
    await writeAuthLog({ cim: member.cim, evento: "acesso_revogado", sucesso: true, req, authUserId: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "importar_celebracoes") {
    const itens = Array.isArray(payload.itens) ? payload.itens : [];
    const rows = [];
    for (const item of itens) {
      const raw = item as Record<string, unknown>;
      const cim = normalizeCim(raw.cim);
      const { data: member } = await supabase.from("irmaos_autorizados").select("id, nome").eq("cim", cim).maybeSingle();
      if (!member) continue;
      const tipo = String(raw.tipo || "aniversario");
      const mes = Number(raw.mes);
      const dia = Number(raw.dia);
      if (!["aniversario", "iniciacao", "familiar"].includes(tipo) || mes < 1 || dia < 1) continue;
      rows.push({
        irmao_id: member.id,
        tipo,
        nome_exibicao: String(raw.nome_exibicao || member.nome),
        mes,
        dia,
        autorizado: raw.autorizado !== false,
      });
    }
    if (rows.length) await supabase.from("celebracoes").insert(rows);
    return jsonResponse(req, 200, { ok: true, importados: rows.length });
  }

  if (acao === "registrar_senha_alterada") {
    await writeAuthLog({ evento: "senha_alterada", sucesso: true, req, authUserId: actorId });
    await supabase.auth.admin.signOut(actorId, "others");
    return jsonResponse(req, 200, { ok: true });
  }

  if (acao === "registrar_logout") {
    await writeAuthLog({ evento: "logout", sucesso: true, req, authUserId: actorId });
    return jsonResponse(req, 200, { ok: true });
  }

  return jsonResponse(req, 400, { ok: false, error: GENERIC_INVITE_ERROR });
});
