import { isValidCim, normalizeCim } from "./cim.js";
import { brToIso, formatBirthInput, isFutureIsoDate, parseFlexibleBrDate } from "./dates-br.js";
import { filterBrothers, LOG_LABELS, PERFIL_LABELS, SITUACAO_LABELS } from "./comunicados.js";
import { LODGE_NAME } from "./sessoes.js";

export const DEFAULT_LOJA_INICIACAO = LODGE_NAME;

export const MODAL_PROFILE_LABELS = {
  irmao: "Irmão",
  secretario: "Secretaria",
  administrador: "Administrador",
};

export const ACCESS_STATUS_LABELS = {
  ativada: "Conta ativa",
  pendente: "Convite enviado",
  expirado: "Convite expirado",
  sem_acesso: "Sem acesso",
  bloqueado: "Conta bloqueada",
  revogado: "Acesso revogado",
};

export const GRAU_LABELS = {
  aprendiz: "Aprendiz",
  companheiro: "Companheiro",
  mestre: "Mestre",
  ap: "AP∴M∴",
  cm: "C∴M∴",
  mm: "M∴M∴",
};

export const DRAWER_SECTIONS = [
  { id: "institucionais", title: "Dados institucionais", open: true },
  { id: "maconicos", title: "Dados maçônicos", open: true },
  { id: "acesso", title: "Área dos Irmãos", open: true },
  { id: "familia", title: "Vínculos familiares", open: false },
  { id: "historico", title: "Histórico", open: false },
];

const SITUACAO_VALUES = new Set(Object.keys(SITUACAO_LABELS));

export function cimLabel(row) {
  return row?.cim_mascarada ? `CIM ${row.cim_mascarada}` : "CIM não cadastrada";
}

export function situacaoTone(situacao) {
  if (situacao === "ativo") return "active";
  if (situacao === "quiet_placet") return "quiet";
  if (situacao === "transferencia") return "transfer";
  return "inactive";
}

export function grauLabel(row) {
  const raw = String(row?.grau || "").trim().toLocaleLowerCase("pt-BR");
  if (!raw) return "";
  return GRAU_LABELS[raw] || String(row.grau).trim();
}

export function situacaoDotLabel(situacao) {
  return SITUACAO_LABELS[situacao] || situacao || "—";
}

export function formatFicheDate(value) {
  if (!value) return "";
  const text = String(value);
  const iso = text.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

export function isInviteExpired(row, from = new Date()) {
  if (!row?.convite_expira_em) return false;
  const when = new Date(row.convite_expira_em);
  return !Number.isNaN(when.getTime()) && when <= from;
}

export function isAccessBlocked(row, from = new Date()) {
  if (!row?.acesso_id) return false;
  if (row.acesso_ativo === false) return true;
  if (!row.bloqueado_ate) return false;
  const when = new Date(row.bloqueado_ate);
  return !Number.isNaN(when.getTime()) && when > from;
}

export function formatAccessDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("pt-BR");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} às ${hours}h${minutes}`;
}

export function isAccessCompatibleSituacao(row) {
  const situacao = String(row?.situacao || "ativo");
  return situacao === "ativo";
}

export function accessStatus(row, from = new Date()) {
  if (!row?.acesso_id) return { id: "sem_acesso", label: ACCESS_STATUS_LABELS.sem_acesso };
  if (row.acesso_ativo === false && row.conta_ativada !== true) {
    return { id: "revogado", label: ACCESS_STATUS_LABELS.revogado };
  }
  if (isAccessBlocked(row, from)) return { id: "bloqueado", label: ACCESS_STATUS_LABELS.bloqueado };
  if (row.conta_ativada) return { id: "ativada", label: ACCESS_STATUS_LABELS.ativada };
  if (isInviteExpired(row, from)) return { id: "expirado", label: ACCESS_STATUS_LABELS.expirado };
  return { id: "pendente", label: ACCESS_STATUS_LABELS.pendente };
}

export function resultsCountLabel(count, filtered) {
  if (count === 0) return filtered ? "Nenhum Irmão encontrado" : "Nenhum Irmão cadastrado";
  const noun = count === 1 ? "Irmão" : "Irmãos";
  if (filtered) return `${count} ${noun} encontrado${count === 1 ? "" : "s"}`;
  return `${count} ${noun} cadastrado${count === 1 ? "" : "s"}`;
}

export function filtersAreActive(filters = {}) {
  return Boolean(filters.q || filters.situacao || filters.perfil || filters.acessoStatus);
}

export function sortBrothers(rows, sort = "nome-az") {
  const list = [...(rows || [])];
  if (sort === "nome-za") {
    return list.sort((a, b) => String(b.nome || "").localeCompare(String(a.nome || ""), "pt-BR"));
  }
  if (sort === "acesso") {
    return list.sort((a, b) => {
      const av = a.ultimo_acesso_em ? new Date(a.ultimo_acesso_em).getTime() : 0;
      const bv = b.ultimo_acesso_em ? new Date(b.ultimo_acesso_em).getTime() : 0;
      return bv - av || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
  }
  return list.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
}

export function filterGestaoBrothers(rows, filters = {}) {
  const filtered = filterBrothers(rows, {
    q: filters.q,
    situacao: filters.situacao,
    perfil: filters.perfil,
  }).filter((row) => {
    if (filters.acessoStatus && accessStatus(row).id !== filters.acessoStatus) return false;
    return true;
  });
  return sortBrothers(filtered, "nome-az");
}

export function accessCardModel(row, from = new Date()) {
  const access = accessStatus(row, from);
  const perfil = row?.perfil ? (MODAL_PROFILE_LABELS[row.perfil] || PERFIL_LABELS[row.perfil] || row.perfil) : "Nenhum";
  const rows = [["Status", access.label], ["Perfil", perfil]];
  if (access.id === "sem_acesso" || access.id === "revogado") {
    rows.push(["Convite", "Não enviado"]);
  } else if (access.id === "pendente" || access.id === "expirado") {
    if (row?.convite_enviado_em) rows.push(["Enviado em", formatAccessDateTime(row.convite_enviado_em)]);
    rows.push(["Ativação", access.id === "expirado" ? "Prazo encerrado" : "Aguardando"]);
  } else if (access.id === "ativada") {
    if (row?.conta_ativada_em) rows.push(["Ativada em", formatFicheDate(row.conta_ativada_em)]);
    rows.push(["Último acesso", row?.ultimo_acesso_em ? formatAccessDateTime(row.ultimo_acesso_em) : "—"]);
  } else if (access.id === "bloqueado") {
    if (row?.bloqueado_ate) rows.push(["Bloqueada até", formatAccessDateTime(row.bloqueado_ate)]);
  }
  return {
    conta: access.label,
    perfil,
    convite: !row?.acesso_id || !row.convite_enviado_em ? "Não enviado" : (access.id === "expirado" ? "Expirado" : "Enviado"),
    ultimoAcesso: row?.ultimo_acesso_em ? formatAccessDateTime(row.ultimo_acesso_em) : "—",
    access,
    rows,
  };
}

export function buildAccessTimeline(row) {
  const items = [];
  if (row?.cadastrado_em) items.push({ title: "Cadastro institucional concluído", date: row.cadastrado_em });
  if (row?.convite_enviado_em) items.push({ title: "Convite enviado", date: row.convite_enviado_em });
  if (row?.conta_ativada_em) items.push({ title: "Conta ativada", date: row.conta_ativada_em });
  if (row?.ultimo_acesso_em) items.push({ title: "Último acesso", date: row.ultimo_acesso_em });
  return items;
}

export function canDeleteBrother(row, profile) {
  if (profile?.perfil !== "administrador") return false;
  if (!row?.irmao_id) return false;
  if (row.perfil === "administrador") return false;
  if (row.acesso_id && profile?.id && String(row.acesso_id) === String(profile.id)) return false;
  return true;
}

export function ficheActions(row, profile) {
  const staff = profile?.perfil === "administrador" || profile?.perfil === "secretario";
  const actions = [];
  if (row?.irmao_id) actions.push({ id: "editar_cadastro", label: "Editar cadastro" });
  if (staff && (row?.irmao_id || row?.acesso_id)) actions.push({ id: "configurar_acesso", label: "Configurar acesso" });
  if (row?.irmao_id) actions.push({ id: "registrar_movimentacao", label: "Registrar movimentação" });
  if (canDeleteBrother(row, profile)) actions.push({ id: "excluir_cadastro", label: "Excluir cadastro" });
  return actions;
}

export function listMenuActions(row, profile) {
  return [{ id: "ver_detalhes", label: "Ver detalhes" }, ...ficheActions(row, profile)];
}

export function buildBrotherTimeline(row, historico = []) {
  const items = [];
  if (row?.data_iniciacao) {
    items.push({
      date: String(row.data_iniciacao).slice(0, 10),
      title: "Iniciação",
      detalhe: row.loja_iniciacao || "",
    });
  }
  for (const event of historico || []) {
    items.push({
      date: event.criado_em,
      title: event.titulo || LOG_LABELS[event.evento] || event.evento,
      detalhe: event.detalhe || "",
    });
  }
  return items.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

export function memberMenuActions(row, profile) {
  return ficheActions(row, profile);
}

export function assignableProfiles(actorPerfil) {
  if (actorPerfil === "administrador") return ["irmao", "secretario", "administrador"];
  if (actorPerfil === "secretario") return ["irmao", "secretario"];
  return ["irmao"];
}

export function resolveAssignableProfile(actorPerfil, requested) {
  const perfil = String(requested || "irmao").trim() || "irmao";
  if (!Object.keys(MODAL_PROFILE_LABELS).includes(perfil)) {
    return { ok: false, error: "Perfil inválido." };
  }
  if (!assignableProfiles(actorPerfil).includes(perfil)) {
    return { ok: false, error: "Perfil não autorizado." };
  }
  return { ok: true, perfil };
}

export function birthPartsFromInput(value) {
  return parseFlexibleBrDate(value);
}

export function birthInputFromParts(row) {
  return formatBirthInput(row?.dia_nascimento, row?.mes_nascimento, row?.ano_nascimento);
}

export function validateBrotherForm(values = {}, { brothers = [], editingId = "", actorPerfil = "irmao", from } = {}) {
  const errors = {};
  const nome = String(values.nome || "").trim();
  if (!nome) errors.nome = "Informe o nome completo do Irmão.";
  const nascimento = parseFlexibleBrDate(values.nascimento);
  if (!nascimento.empty && nascimento.invalid) errors.nascimento = "Informe uma data de nascimento válida.";
  else if (nascimento.iso && isFutureIsoDate(nascimento.iso, from)) errors.nascimento = "Informe uma data de nascimento válida.";
  if (values.iniciacao) {
    const iso = brToIso(values.iniciacao);
    if (!iso || isFutureIsoDate(iso, from)) errors.iniciacao = "Informe uma data de iniciação válida.";
  }
  const email = String(values.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Informe um e-mail válido.";
  const cim = normalizeCim(values.cim);
  if (cim && !isValidCim(cim)) errors.cim = "Informe uma CIM válida.";
  const others = (brothers || []).filter((row) => row.irmao_id !== editingId && row.id !== editingId);
  if (email && others.some((row) => String(row.email || "").toLocaleLowerCase("pt-BR") === email.toLocaleLowerCase("pt-BR"))) {
    errors.email = "Este e-mail já está vinculado a outro acesso.";
  }
  if (cim && others.some((row) => row.cim && normalizeCim(row.cim) === cim)) {
    errors.cim = "Esta CIM já está vinculada a outro Irmão.";
  }
  if (values.perfil) {
    const resolved = resolveAssignableProfile(actorPerfil, values.perfil);
    if (!resolved.ok) errors.perfil = resolved.error;
  }
  return errors;
}

export function mapSaveError(message) {
  const text = String(message || "");
  if (/cim/i.test(text) && /já|existe|duplicate|unique|vinculad/i.test(text)) return "Esta CIM já está vinculada a outro Irmão.";
  if (/e-?mail/i.test(text) && /já|existe|duplicate|unique|vinculad/i.test(text)) return "Este e-mail já está vinculado a outro acesso.";
  return text || "Não foi possível cadastrar.";
}

export function hasInstitutionalCim(row) {
  return Boolean(String(row?.cim || "").trim() || row?.cim_mascarada);
}

export function missingAccessFields(row) {
  const missing = [];
  if (!hasInstitutionalCim(row)) missing.push("CIM");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row?.email || "").trim())) missing.push("E-mail");
  return missing;
}

export function emailLinkedToOtherActiveAccount(row, brothers = []) {
  const email = String(row?.email || "").trim().toLocaleLowerCase("pt-BR");
  if (!email) return false;
  return (brothers || []).some((other) => {
    if (!other?.conta_ativada) return false;
    if (row?.irmao_id && other.irmao_id && other.irmao_id === row.irmao_id) return false;
    if (row?.id && other.id && other.id === row.id) return false;
    return String(other.email || "").trim().toLocaleLowerCase("pt-BR") === email;
  });
}

export function accessReleaseBlockers(row, brothers = []) {
  const blockers = missingAccessFields(row).map((label) => ({
    id: label === "CIM" ? "cim" : "email",
    label,
  }));
  if (!isAccessCompatibleSituacao(row)) {
    blockers.push({ id: "situacao", label: "Situação maçônica" });
  }
  if (emailLinkedToOtherActiveAccount(row, brothers)) {
    blockers.push({ id: "email_taken", label: "E-mail já vinculado a outra conta ativa" });
  }
  return blockers;
}

export function accessSetupState(row, from = new Date()) {
  const access = accessStatus(row, from);
  const missing = missingAccessFields(row);
  if (missing.length && (access.id === "sem_acesso" || access.id === "revogado")) {
    return { id: "incomplete", missing, access };
  }
  if (access.id === "ativada") return { id: "ativa", access };
  if (access.id === "bloqueado") return { id: "bloqueada", access };
  if (access.id === "expirado") return { id: "expirado", access };
  if (access.id === "pendente") return { id: "pendente", access };
  if (access.id === "revogado") return { id: "revogada", access };
  return { id: "pronta", access };
}

export function accessStatusPanel(row, actorPerfil = "irmao", from = new Date(), brothers = []) {
  const access = accessStatus(row, from);
  const blockers = accessReleaseBlockers(row, brothers);
  const perfilLabel = row?.perfil ? (MODAL_PROFILE_LABELS[row.perfil] || PERFIL_LABELS[row.perfil] || row.perfil) : "Nenhum";
  const facts = [];
  let description = "";
  let detail = "";
  const tone = {
    sem_acesso: "neutral",
    pendente: "pending",
    expirado: "warning",
    ativada: "success",
    bloqueado: "danger",
    revogado: "muted",
  }[access.id] || "neutral";

  if (access.id === "sem_acesso" || access.id === "revogado") {
    description = access.id === "revogado"
      ? "O acesso deste Irmão foi revogado."
      : "Este Irmão ainda não possui uma conta ativa.";
    detail = "Ao liberar o acesso, ele receberá um convite no e-mail cadastrado para confirmar sua CIM e criar sua senha.";
  } else if (access.id === "pendente") {
    description = row?.convite_enviado_em
      ? `Enviado em ${formatAccessDateTime(row.convite_enviado_em)}.`
      : "O convite já foi enviado.";
    detail = "Aguardando o Irmão confirmar sua CIM e criar a senha.";
    if (row?.convite_expira_em) {
      facts.push({ label: "Validade", value: `Expira em ${formatAccessDateTime(row.convite_expira_em)}.` });
    }
  } else if (access.id === "expirado") {
    description = "O prazo para ativação terminou sem que a conta fosse concluída.";
  } else if (access.id === "ativada") {
    description = "O Irmão já possui acesso à Área dos Irmãos.";
    facts.push({ label: "Perfil", value: perfilLabel });
    if (row?.conta_ativada_em) facts.push({ label: "Ativada em", value: formatFicheDate(row.conta_ativada_em) });
    facts.push({
      label: "Último acesso",
      value: row?.ultimo_acesso_em ? formatAccessDateTime(row.ultimo_acesso_em) : "—",
    });
  } else if (access.id === "bloqueado") {
    description = "O acesso está temporariamente suspenso.";
    if (row?.bloqueado_ate) facts.push({ label: "Bloqueada até", value: formatAccessDateTime(row.bloqueado_ate) });
    if (row?.motivo_bloqueio) facts.push({ label: "Motivo", value: String(row.motivo_bloqueio) });
  }

  return {
    id: access.id,
    label: "Status do acesso",
    title: access.label,
    description,
    detail,
    tone,
    facts,
    blockers,
    canRelease: (access.id === "sem_acesso" || access.id === "revogado") && !blockers.length,
  };
}

export function profileSelectOptions(actorPerfil, currentPerfil) {
  const allowed = assignableProfiles(actorPerfil);
  const options = allowed.map((id) => ({
    id,
    label: MODAL_PROFILE_LABELS[id],
    disabled: false,
  }));
  if (currentPerfil === "administrador" && !allowed.includes("administrador")) {
    options.push({
      id: "administrador",
      label: "Administrador",
      disabled: true,
      hint: "Apenas Administrador pode conceder ou alterar este perfil.",
    });
  }
  return options;
}

export function validateQuietPlacet(values = {}) {
  const errors = {};
  const inicio = brToIso(values.inicio_em);
  const termino = brToIso(values.previsao_termino);
  if (!values.inicio_em || inicio === "") errors.inicio_em = "Informe a data de início.";
  else if (!inicio) errors.inicio_em = "Informe a data de início.";
  if (!values.previsao_termino || termino === "") errors.previsao_termino = "Informe o término previsto.";
  else if (!termino) errors.previsao_termino = "Informe o término previsto.";
  if (inicio && termino && termino <= inicio) errors.previsao_termino = "O término deve ser posterior ao início.";
  if (!String(values.motivo || "").trim()) errors.motivo = "Informe o motivo do quiet placet.";
  return errors;
}

export function validateTransferencia(values = {}) {
  const errors = {};
  if (!String(values.loja_destino || "").trim()) errors.loja_destino = "Informe a Loja de destino.";
  if (!String(values.oriente_destino || "").trim()) errors.oriente_destino = "Informe o Oriente.";
  const data = brToIso(values.data_solicitacao);
  if (!values.data_solicitacao || data === "") errors.data_solicitacao = "Informe a data da solicitação.";
  else if (!data) errors.data_solicitacao = "Informe a data da solicitação.";
  return errors;
}

export function actionToastMessage(acao, ok) {
  if (!ok) return "";
  return {
    convidar_gestao: "Convite enviado com sucesso.",
    enviar_convite: "Convite enviado com sucesso.",
    reenviar_convite: "Convite reenviado com sucesso.",
    cancelar_convite: "Convite cancelado com sucesso.",
    salvar_gestao_irmao: "Cadastro atualizado com sucesso.",
    quiet_placet: "Quiet placet registrado com sucesso.",
    transferencia: "Transferência registrada com sucesso.",
    suspender_acesso: "Acesso bloqueado com sucesso.",
    alterar_perfil: "Perfil atualizado com sucesso.",
    reativar: "Acesso desbloqueado com sucesso.",
    desbloquear: "Acesso desbloqueado com sucesso.",
    revogar: "Acesso revogado com sucesso.",
    encerrar_quiet_placet: "Retorno à atividade registrado com sucesso.",
    regularizar_situacao: "Situação atualizada com sucesso.",
    afastar_irmao: "Afastamento registrado com sucesso.",
    excluir_irmao: "Cadastro excluído com sucesso.",
  }[acao] || "Operação registrada com sucesso.";
}

export function movementChoices() {
  return [
    { id: "quiet", label: "Quiet placet" },
    { id: "transfer", label: "Transferência" },
    { id: "afastamento", label: "Afastamento" },
    { id: "retorno", label: "Retorno à atividade" },
  ];
}

export function familyGroups(familiares = [], irmaoId) {
  const rows = (familiares || []).filter((row) => String(row.irmao_id) === String(irmaoId));
  return {
    conjuge: rows.filter((row) => row.parentesco === "esposa" || row.parentesco === "companheira"),
    filhos: rows.filter((row) => row.parentesco === "filho" || row.parentesco === "filha"),
    outros: rows.filter((row) => !["esposa", "companheira", "filho", "filha"].includes(row.parentesco)),
  };
}

export function situacaoAllowed(value) {
  return SITUACAO_VALUES.has(value) ? value : "ativo";
}

export function roleLabel(perfil) {
  return MODAL_PROFILE_LABELS[perfil] || PERFIL_LABELS[perfil] || "";
}

export function movementTitle(kind) {
  return {
    quiet: "Registrar quiet placet",
    transfer: "Registrar transferência",
    afastamento: "Registrar afastamento",
    retorno: "Retorno à atividade",
  }[kind] || "Registrar movimentação";
}

export function currentMovements(row) {
  const items = [];
  if (row?.quiet_placet) {
    items.push({
      kind: "quiet",
      title: "Quiet placet",
      rows: [
        ["Início", formatFicheDate(row.quiet_placet.inicio_em)],
        ["Término previsto", formatFicheDate(row.quiet_placet.previsao_termino)],
        ["Motivo", row.quiet_placet.motivo || "—"],
        ["Acesso suspenso", row.quiet_placet.suspender_acesso ? "Sim" : "Não"],
      ],
    });
  }
  if (row?.transferencia) {
    items.push({
      kind: "transfer",
      title: "Transferência",
      rows: [
        ["Loja de destino", row.transferencia.loja_destino || "—"],
        ["Oriente", row.transferencia.oriente_destino || "—"],
        ["Solicitada em", formatFicheDate(row.transferencia.data_solicitacao)],
        ["Observação", row.transferencia.observacao || "—"],
      ],
    });
  }
  return items;
}

export function accessDialogModel(row, actorPerfil, from = new Date(), brothers = []) {
  const state = accessSetupState(row, from);
  const panel = accessStatusPanel(row, actorPerfil, from, brothers);
  const perfil = row?.perfil || "irmao";
  const admin = actorPerfil === "administrador";
  const missing = state.missing || missingAccessFields(row);
  const blockers = panel.blockers;
  const canRelease = panel.canRelease;
  const needsCadastro = missing.length || blockers.some((item) => ["cim", "email", "situacao"].includes(item.id));
  const primary = {
    incomplete: "completar_cadastro",
    pronta: canRelease ? "liberar_acesso" : (needsCadastro ? "completar_cadastro" : ""),
    revogada: canRelease ? "liberar_acesso" : (needsCadastro ? "completar_cadastro" : ""),
    pendente: "reenviar_convite",
    expirado: "enviar_novo_convite",
    bloqueada: "desbloquear",
  }[state.id] || "";
  return {
    id: state.id,
    missing,
    blockers,
    access: state.access,
    panel,
    title: "Configurar acesso",
    cim: row?.cim_mascarada || "",
    email: row?.email || "",
    perfil,
    perfilLabel: MODAL_PROFILE_LABELS[perfil] || perfil,
    lastAccess: row?.ultimo_acesso_em ? formatAccessDateTime(row.ultimo_acesso_em) : "—",
    inviteSentAt: row?.convite_enviado_em ? formatAccessDateTime(row.convite_enviado_em) : "",
    inviteExpiresAt: row?.convite_expira_em ? formatAccessDateTime(row.convite_expira_em) : "",
    activatedAt: row?.conta_ativada_em ? formatFicheDate(row.conta_ativada_em) : "",
    profiles: assignableProfiles(actorPerfil),
    profileOptions: profileSelectOptions(actorPerfil, row?.perfil),
    primary,
    canRelease,
    canChangeProfile: state.id === "ativa" || ["pronta", "revogada", "pendente", "expirado"].includes(state.id),
    canBlock: state.id === "ativa",
    canUnblock: state.id === "bloqueada",
    canRevoke: admin && (state.id === "ativa" || state.id === "bloqueada"),
    canReset: state.id === "ativa",
    canCancelInvite: state.id === "pendente" && Boolean(row?.acesso_id),
    showInvite: ["pronta", "revogada", "pendente", "expirado"].includes(state.id) && canRelease,
    closeLabel: ["pendente", "expirado", "ativa", "bloqueada"].includes(state.id) ? "Fechar" : "Cancelar",
  };
}

export function replaceBrother(list, next) {
  return (list || []).map((row) => (
    (next?.irmao_id && row.irmao_id === next.irmao_id) || (next?.id && row.id === next.id) ? next : row
  ));
}

export function syncedMemberView(list, next, drawerId) {
  const updated = replaceBrother(list, next);
  const drawer = updated.find((row) => row.irmao_id === drawerId || row.id === drawerId) || next;
  return {
    list: updated,
    drawer,
    situacao: drawer?.situacao || "",
    matchesList: Boolean(updated.find((row) => row.situacao === drawer?.situacao && (row.irmao_id === drawer?.irmao_id || row.id === drawer?.id))),
  };
}
