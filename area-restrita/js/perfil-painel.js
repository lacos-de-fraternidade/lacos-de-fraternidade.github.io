import { daysUntil, monthName, padDay, parseIsoDate, startOfLocalDay } from "./datas.js";
import { isoToBr } from "./dates-br.js";
import { PERFIL_LABELS, SITUACAO_LABELS } from "./comunicados.js";
import { cargoLabel } from "./cargos.js";
import { formatSessionTime, isActiveEvent, isLodgeSessionType, LODGE_NAME, sessionProgramItems, sessionTitle, sessionTypeLabel } from "./sessoes.js";
import { displayLodgeName, displayPersonName, firstGivenName } from "./vinculo.js";

const NAME_PARTICLES = new Set(["de", "da", "das", "do", "dos", "e", "del"]);

export function maskCim(cim) {
  const value = String(cim || "").trim();
  if (value.length < 4) return value || "—";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

export function profileInitials(nome) {
  const parts = displayPersonName(nome)
    .split(/\s+/)
    .filter((part) => part && !NAME_PARTICLES.has(part.toLocaleLowerCase("pt-BR")));
  if (!parts.length) return "IR";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("pt-BR");
  return `${parts[0][0]}${parts[1][0]}`.toLocaleUpperCase("pt-BR");
}

export function roleLabel(perfil) {
  return PERFIL_LABELS[perfil] || "Irmão";
}

export function situacaoLabel(situacao) {
  return SITUACAO_LABELS[situacao] || "Ativo";
}

export function formatAccessDate(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

export function formatDayMonth(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${padDay(date.getDate())}/${padDay(date.getMonth() + 1)}`;
}

export function formatLongDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} de ${monthName(date.getMonth() + 1).toLowerCase()}`;
}

export function completeMonths(isoDate, from = new Date()) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return null;
  const today = startOfLocalDay(from);
  const start = new Date(parsed.year, parsed.month - 1, parsed.day);
  if (Number.isNaN(start.getTime()) || today < start) return 0;
  return Math.max(0, (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()));
}

export function caminhadaDurationLabel(isoDate, from = new Date()) {
  const months = completeMonths(isoDate, from);
  if (months == null) return "";
  if (months < 1) return "Iniciado neste mês";
  if (months < 12) return months === 1 ? "1 mês de caminhada" : `${months} meses de caminhada`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 ano de caminhada" : `${years} anos de caminhada`;
}

export function membershipSinceLabel(isoDate, from = new Date()) {
  const months = completeMonths(isoDate, from);
  if (months == null) return "—";
  if (months < 1) return "Neste mês";
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 ano" : `${years} anos`;
}

export function daysSinceLastBirthday(month, day, from = new Date()) {
  const today = startOfLocalDay(from);
  let last = new Date(today.getFullYear(), Number(month) - 1, Number(day));
  if (Number.isNaN(last.getTime()) || last.getDate() !== Number(day)) return null;
  if (last > today) last = new Date(today.getFullYear() - 1, Number(month) - 1, Number(day));
  return Math.round((today - last) / 86400000);
}

export function birthdayCardCopy(irmao, from = new Date()) {
  if (!irmao?.dia_nascimento || !irmao?.mes_nascimento) return null;
  const dia = Number(irmao.dia_nascimento);
  const mes = Number(irmao.mes_nascimento);
  const dateLabel = `${dia} de ${monthName(mes).toLowerCase()}`;
  const since = daysSinceLastBirthday(mes, dia, from);
  if (since === 0) {
    return { title: "Seu aniversário", dateLabel, relative: "É hoje", tone: "today" };
  }
  if (since > 0 && since <= 14) {
    return {
      title: "Seu aniversário",
      dateLabel,
      relative: since === 1 ? "foi há 1 dia" : `foi há ${since} dias`,
      tone: "past",
    };
  }
  const until = daysUntil(mes, dia, from);
  if (until == null) return { title: "Seu aniversário", dateLabel, relative: "", tone: "upcoming" };
  if (until === 1) return { title: "Seu aniversário", dateLabel, relative: "falta 1 dia", tone: "upcoming" };
  return { title: "Seu aniversário", dateLabel, relative: `faltam ${until} dias`, tone: "upcoming" };
}

export function birthdayStatLabel(irmao, from = new Date()) {
  if (!irmao?.dia_nascimento || !irmao?.mes_nascimento) return "—";
  const until = daysUntil(irmao.mes_nascimento, irmao.dia_nascimento, from);
  if (until == null) return "—";
  if (until === 0) return "Hoje";
  if (until === 1) return "Próximo em 1 dia";
  return `Próximo em ${until} dias`;
}

export function futureLodgeSessions(eventos = [], from = new Date()) {
  return (eventos || [])
    .filter((evento) => isLodgeSessionType(evento.tipo_evento) || isLodgeSessionType(evento.tipo))
    .filter((evento) => isActiveEvent(evento, from))
    .map((evento) => ({ ...evento, when: new Date(evento.inicia_em) }))
    .sort((a, b) => a.when - b.when);
}

export function nextSessionCardCopy(evento) {
  if (!evento?.when) return null;
  return {
    title: "Próxima sessão",
    dateLabel: formatLongDay(evento.when),
    eventLabel: sessionTitle(evento),
    typeLabel: sessionTypeLabel(evento.tipo_evento || evento.tipo),
    timeLabel: formatSessionTime(evento.when),
    presence: evento.presenca_obrigatoria ? "Presença necessária" : "Presença recomendada",
    program: sessionProgramItems({ ...evento, categoria: "sessao", pauta: evento.pauta || evento.sessoes_pauta_itens }),
  };
}

export function welcomeCopy({ profile, nextSession } = {}) {
  const first = firstGivenName(profile?.nome);
  return {
    kicker: "Bem-vindo de volta,",
    name: `${first}.`,
    lastAccess: formatAccessDate(profile?.ultimo_acesso_em),
    sessionLabel: nextSession ? "Próxima sessão" : "",
    sessionWhen: nextSession ? `${formatDayMonth(nextSession.when)} • ${formatSessionTime(nextSession.when)}` : "",
  };
}

export function profileTimeline({ irmao, nextSession, from = new Date() } = {}) {
  const items = [];
  if (irmao?.data_iniciacao) {
    const parsed = parseIsoDate(irmao.data_iniciacao);
    const lodge = displayLodgeName(irmao.loja_iniciacao || LODGE_NAME);
    items.push({
      key: "iniciacao",
      when: parsed ? new Date(parsed.year, parsed.month - 1, parsed.day) : null,
      dateLabel: isoToBr(irmao.data_iniciacao),
      title: lodge ? `Iniciado na ${lodge}` : "Iniciação maçônica",
      past: true,
    });
  }
  if (irmao?.dia_nascimento && irmao?.mes_nascimento) {
    const until = daysUntil(irmao.mes_nascimento, irmao.dia_nascimento, from);
    const today = startOfLocalDay(from);
    const next = new Date(today.getFullYear(), Number(irmao.mes_nascimento) - 1, Number(irmao.dia_nascimento));
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    items.push({
      key: "aniversario",
      when: next,
      dateLabel: `${padDay(irmao.dia_nascimento)}/${padDay(irmao.mes_nascimento)}`,
      title: until === 0 ? "Aniversário hoje" : "Próximo aniversário",
      past: false,
    });
  }
  if (nextSession?.when) {
    items.push({
      key: "sessao",
      when: nextSession.when,
      dateLabel: formatDayMonth(nextSession.when),
      title: "Próxima sessão",
      past: false,
    });
  }
  return items.sort((a, b) => {
    if (Boolean(a.past) !== Boolean(b.past)) return a.past ? -1 : 1;
    return (a.when?.getTime() || 0) - (b.when?.getTime() || 0);
  });
}

export function buildProfileView({ profile, irmao = null, eventos = [], from = new Date() } = {}) {
  const sessions = futureLodgeSessions(eventos, from);
  const nextSession = sessions[0] || null;
  const birthday = birthdayCardCopy(irmao, from);
  return {
    identity: {
      initials: profileInitials(profile?.nome),
      name: displayPersonName(profile?.nome),
      role: roleLabel(profile?.perfil),
      lodge: LODGE_NAME,
      status: profile?.ativo && profile?.conta_ativada ? "Conta ativa" : "Conta pendente",
      active: Boolean(profile?.ativo && profile?.conta_ativada),
    },
    welcome: welcomeCopy({ profile, nextSession }),
    account: [
      { icon: "email", label: "E-mail", value: profile?.email || "—" },
      { icon: "irmao", label: "Perfil", value: roleLabel(profile?.perfil) },
      { icon: "cim", label: "CIM", value: maskCim(profile?.cim) },
      { icon: "evento", label: "Último acesso", value: formatAccessDate(profile?.ultimo_acesso_em) },
    ],
    institutional: [
      { icon: "irmao", label: "Nome completo", value: displayPersonName(irmao?.nome || profile?.nome) },
      { icon: "loja", label: "Loja", value: LODGE_NAME },
      { icon: "loja", label: "Situação", value: situacaoLabel(irmao?.situacao || (profile?.ativo ? "ativo" : "inativo")) },
      { icon: "irmao", label: "Cargo", value: cargoLabel(irmao?.cargo_institucional || profile?.cargo_institucional) },
    ],
    dates: [
      {
        icon: "evento",
        label: "Aniversário",
        value: irmao?.dia_nascimento && irmao?.mes_nascimento
          ? `${padDay(irmao.dia_nascimento)}/${padDay(irmao.mes_nascimento)}`
          : "—",
      },
      { icon: "iniciacao", label: "Iniciação", value: irmao?.data_iniciacao ? isoToBr(irmao.data_iniciacao) : "—" },
      { icon: "iniciacao", label: "Tempo de caminhada maçônica", value: caminhadaDurationLabel(irmao?.data_iniciacao, from) || "—" },
    ],
    security: {
      heading: "Segurança",
      hint: "Sua senha pode ser alterada quando quiser.",
      action: "Alterar senha",
      lastAccess: formatAccessDate(profile?.ultimo_acesso_em),
      sessionsLabel: "Sessões ativas",
      sessionsValue: "Em breve",
    },
    nextSession: nextSessionCardCopy(nextSession),
    birthday,
    stats: [
      { label: "Membro desde", value: membershipSinceLabel(irmao?.data_iniciacao, from) },
      { label: "Sessões futuras", value: String(sessions.length) },
      { label: "Aniversários", value: birthdayStatLabel(irmao, from) },
    ],
    timeline: profileTimeline({ irmao, nextSession, from }),
  };
}
