import { isLodgeSessionType } from "./sessoes.js";

const DUES_START_DAY = 5;
const DUES_DUE_DAY = 20;

export const NOTICE_PRIORITY = {
  urgente: 100,
  sessao_obrigatoria: 80,
  destacado: 60,
  ativo: 40,
  mensalidade: 10,
};

export function duesReminder(from = new Date()) {
  const day = from.getDate();
  if (day < DUES_START_DAY || day > DUES_DUE_DAY) return null;
  return {
    id: "mensalidade-automatica",
    titulo: "Lembrete de mensalidade",
    corpo: "A mensalidade da Loja vence no dia 20 deste mês. Regularize sua contribuição dentro do prazo.",
    tipo: "financeiro",
    origem: "automatico",
    prioridade: NOTICE_PRIORITY.mensalidade,
  };
}

export function isNoticeVisible(item, from = new Date()) {
  if (!item || item.publicado === false) return false;
  if (item.inicio_exibicao && new Date(item.inicio_exibicao) > from) return false;
  if (item.fim_exibicao && new Date(item.fim_exibicao) < from) return false;
  return true;
}

export function noticeScore(item) {
  if (!item) return 0;
  if (item.origem === "automatico") return NOTICE_PRIORITY.mensalidade;
  if (item.tipo === "urgente" || item.prioridade >= 90) return NOTICE_PRIORITY.urgente;
  if (item.destaque || item.prioridade >= 70) return NOTICE_PRIORITY.destacado;
  if (item.presenca_obrigatoria || item.tipo === "sessao") return NOTICE_PRIORITY.sessao_obrigatoria;
  return NOTICE_PRIORITY.ativo + Number(item.prioridade || 0);
}

export function administrativeSessionNotice(eventos = [], from = new Date()) {
  const next = (eventos || []).find((evento) => {
    if (evento.tipo_evento !== "sessao_administrativa") return false;
    if (evento.ativo === false || evento.publicado === false) return false;
    if (!evento.presenca_obrigatoria && !evento.destaque) return false;
    const when = evento.inicia_em ? new Date(evento.inicia_em) : null;
    return when && when >= from;
  });
  if (!next) return null;
  const when = new Date(next.inicia_em);
  return {
    id: next.id,
    titulo: "Sessão administrativa",
    corpo: "Presença de todos os Irmãos necessária.",
    detalhe: when.toLocaleString("pt-BR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    tipo: "sessao",
    origem: "sessao",
    presenca_obrigatoria: true,
    destaque: true,
    prioridade: NOTICE_PRIORITY.sessao_obrigatoria,
    inicia_em: next.inicia_em,
  };
}

export function pickDashboardNotice({ comunicados = [], eventos = [], from = new Date() } = {}) {
  const ranked = [
    ...comunicados.filter((item) => isNoticeVisible(item, from)),
    administrativeSessionNotice(eventos, from),
    duesReminder(from),
  ]
    .filter(Boolean)
    .sort((a, b) => noticeScore(b) - noticeScore(a) || String(b.criado_em || "").localeCompare(String(a.criado_em || "")));
  return ranked[0] || null;
}

export function relatedSessionNotices(comunicados = [], session, from = new Date()) {
  if (!session) return [];
  const when = session.when instanceof Date ? session.when : new Date(session.inicia_em || session.when);
  if (Number.isNaN(when.getTime())) return [];
  return (comunicados || []).filter((item) => {
    if (item.tipo !== "sessao" || !isNoticeVisible(item, from)) return false;
    if (item.inicio_exibicao && new Date(item.inicio_exibicao) > when) return false;
    if (item.fim_exibicao && new Date(item.fim_exibicao) < when) return false;
    return true;
  });
}

export function relatedSessionNotice(comunicados = [], session, from = new Date()) {
  return relatedSessionNotices(comunicados, session, from)[0] || null;
}

export function sessionNoticeCopy(count) {
  if (count <= 0) return "";
  if (count === 1) return "A próxima sessão possui um comunicado importante publicado pela Secretaria.";
  return "Existem comunicados importantes relacionados à próxima sessão.";
}

export function canSeeMigrationTools(perfil) {
  return perfil === "administrador";
}

export function rowClickOpensDetails(target) {
  return !target?.closest?.(".record-actions");
}

export function noticeDisplayStatus(item, from = new Date()) {
  if (!item || item.publicado === false || item.ativo === false) return "desativado";
  if (item.inicio_exibicao && new Date(item.inicio_exibicao) > from) return "agendado";
  if (item.fim_exibicao && new Date(item.fim_exibicao) < from) return "encerrado";
  return "ativo";
}

export const NOTICE_STATUS_LABELS = {
  ativo: "Ativo",
  agendado: "Agendado",
  encerrado: "Encerrado",
  desativado: "Desativado",
};

export const NOTICE_TYPE_LABELS = {
  informativo: "Informativo",
  financeiro: "Financeiro",
  urgente: "Urgente",
  sessao: "Sessão",
  administrativo: "Administrativo",
};

export function noticePeriodLabel(item) {
  const start = item?.inicio_exibicao ? isoToBrSafe(item.inicio_exibicao) : "";
  const end = item?.fim_exibicao ? isoToBrSafe(item.fim_exibicao) : "";
  if (start && end) return `${start} a ${end}`;
  if (start) return `A partir de ${start}`;
  if (end) return `Até ${end}`;
  return "";
}

export function relatedEventForNotice(notice, eventos = [], from = new Date()) {
  if (!notice || notice.origem === "automatico") return null;
  if (notice.inicia_em) {
    const when = new Date(notice.inicia_em);
    if (!Number.isNaN(when.getTime())) {
      return { when, tipo: notice.tipo_evento || notice.tipo || "sessao" };
    }
  }
  const sessionNotice = notice.tipo === "sessao" || notice.origem === "sessao";
  if (!sessionNotice) return null;
  const matches = (eventos || []).filter((evento) => {
    if (evento.ativo === false || evento.publicado === false) return false;
    if (!isLodgeSessionType(evento.tipo_evento || evento.tipo)) return false;
    const when = evento.inicia_em ? new Date(evento.inicia_em) : null;
    if (!when || Number.isNaN(when.getTime())) return false;
    if (notice.inicio_exibicao && when < new Date(notice.inicio_exibicao)) return false;
    if (notice.fim_exibicao && when > new Date(notice.fim_exibicao)) return false;
    return true;
  }).sort((a, b) => new Date(a.inicia_em) - new Date(b.inicia_em));
  const upcoming = matches.find((evento) => new Date(evento.inicia_em) >= from) || matches[0];
  return upcoming ? { when: new Date(upcoming.inicia_em), tipo: upcoming.tipo_evento || upcoming.tipo } : null;
}

export function noticePublicDateLabel(event) {
  if (!event?.when || Number.isNaN(event.when.getTime())) return "";
  const date = event.when.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const time = `${String(event.when.getHours()).padStart(2, "0")}h${String(event.when.getMinutes()).padStart(2, "0")}`;
  if (isLodgeSessionType(event.tipo) || event.tipo === "sessao") {
    return `Sessão em ${date}, às ${time}.`;
  }
  return `${date}, às ${time}.`;
}

export function truncateText(value, max = 220) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function isoToBrSafe(value) {
  const raw = String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

export const SITUACAO_LABELS = {
  ativo: "Ativo",
  quiet_placet: "Em quiet placet",
  transferencia: "Em transferência",
  afastado: "Afastado",
  inativo: "Inativo",
  desligado: "Desligado",
  falecido: "Falecido",
};

export const TRANSFERENCIA_STATUS_LABELS = {
  solicitada: "Solicitada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PERFIL_LABELS = {
  irmao: "Irmão",
  secretario: "Secretário",
  veneravel_mestre: "Venerável Mestre",
  administrador: "Administrador",
};

export function matchesBrotherQuery(row, query) {
  const text = String(query || "").trim().toLocaleLowerCase("pt-BR");
  if (!text) return true;
  const hay = [row.nome, row.email, row.cim_mascarada].map((value) => String(value || "").toLocaleLowerCase("pt-BR")).join(" ");
  if (hay.includes(text)) return true;
  const digits = String(query || "").replace(/[\s.\-]/g, "").replace(/\D/g, "");
  if (!digits) return false;
  const full = String(row.cim || "").replace(/\D/g, "");
  if (full && full.includes(digits)) return true;
  if (digits.length >= 4) {
    const mask = String(row.cim_mascarada || "");
    return Boolean(mask) && digits.startsWith(mask.slice(0, 2)) && digits.endsWith(mask.slice(-2));
  }
  return false;
}

export function filterBrothers(rows, filters = {}) {
  return (rows || []).filter((row) => {
    if (!matchesBrotherQuery(row, filters.q)) return false;
    if (filters.situacao && row.situacao !== filters.situacao) return false;
    if (filters.perfil && row.perfil !== filters.perfil) return false;
    if (filters.conta === "ativada" && row.conta_ativada !== true) return false;
    if (filters.conta === "pendente" && row.conta_ativada === true) return false;
    if (filters.acesso === "sim" && !row.acesso_id) return false;
    if (filters.acesso === "nao" && row.acesso_id) return false;
    if (filters.convite === "pendente") {
      const pending = row.convite_enviado_em && !row.conta_ativada && (!row.convite_expira_em || new Date(row.convite_expira_em) > new Date());
      if (!pending) return false;
    }
    return true;
  });
}

export const LOG_LABELS = {
  login_sucesso: "Login realizado",
  login_falha: "Falha de login",
  conta_bloqueada: "Conta bloqueada",
  convite_enviado: "Convite enviado",
  convite_aceito: "Convite aceito",
  conta_ativada: "Conta ativada",
  recuperacao_solicitada: "Recuperação solicitada",
  senha_alterada: "Senha alterada",
  senha_redefinida: "Senha redefinida",
  logout: "Saída",
  acesso_revogado: "Acesso revogado",
  acesso_suspenso: "Acesso suspenso",
  bootstrap_utilizado: "Bootstrap utilizado",
  conta_desativada: "Conta desativada",
  membro_criado: "Irmão criado",
  membro_editado: "Irmão editado",
  membro_desativado: "Irmão desativado",
  quiet_placet_iniciado: "Quiet placet iniciado",
  quiet_placet_encerrado: "Quiet placet encerrado",
  transferencia_iniciada: "Transferência iniciada",
  transferencia_concluida: "Transferência concluída",
  familiar_criado: "Familiar criado",
  familiar_editado: "Familiar editado",
  casamento_criado: "Casamento criado",
  evento_criado: "Evento criado",
  evento_editado: "Evento editado",
  comunicado_publicado: "Comunicado publicado",
  cargo_atribuido: "Cargo atribuído",
  cargo_encerrado: "Cargo encerrado",
};

export const LOG_ORIGEM_LABELS = {
  CIM: "CIM",
  Convite: "Convite",
  Recuperacao: "Recuperação",
  Sessao: "Sessão",
  Administracao: "Administração",
};

export function logOriginForEvent(evento) {
  if (["login_sucesso", "login_falha", "conta_bloqueada"].includes(evento)) return "CIM";
  if (["convite_enviado", "convite_aceito", "conta_ativada"].includes(evento)) return "Convite";
  if (["recuperacao_solicitada", "senha_alterada", "senha_redefinida"].includes(evento)) return "Recuperacao";
  if (evento === "logout") return "Sessao";
  return "Administracao";
}

export function logContainsSecret(row) {
  const blob = JSON.stringify(row || {}).toLowerCase();
  return ["password", "senha", "refresh_token", "access_token", "cookie", "service_role"].some((key) => blob.includes(key));
}
