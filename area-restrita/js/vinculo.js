import {
  anniversaryYears,
  daysUntil,
  monthAbbr,
  monthName,
  relativeDayLabel,
} from "./datas.js";
import { caminhadaLabel } from "./datas-maconicas.js";

const NAME_PARTICLES = new Set(["de", "da", "das", "do", "dos", "e", "del"]);
const LODGE_ACRONYMS = new Set(["arls", "glmerj", "glej", "gob", "gole"]);

export function isOwnIrmao(profile, irmaoId) {
  if (!profile || profile.ativo !== true || profile.conta_ativada !== true) return false;
  if (!profile.irmao_id || !irmaoId) return false;
  return String(profile.irmao_id) === String(irmaoId);
}

export function displayPersonName(nome) {
  const raw = String(nome || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  return raw
    .split(" ")
    .map((part, index) => {
      const lower = part.toLocaleLowerCase("pt-BR");
      if (index > 0 && NAME_PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

export function displayLodgeName(nome) {
  const raw = String(nome || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  return raw
    .replace(/n[ºo°]/gi, "nº")
    .split(" ")
    .map((part, index) => {
      const lower = part.toLocaleLowerCase("pt-BR");
      if (LODGE_ACRONYMS.has(lower)) return lower.toLocaleUpperCase("pt-BR");
      if (lower.startsWith("nº")) return lower;
      if (index > 0 && NAME_PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

export function firstGivenName(nome) {
  return displayPersonName(nome).split(/\s+/)[0] || "Irmão";
}

export function displayMainName(nome) {
  const parts = displayPersonName(nome)
    .split(/\s+/)
    .filter((part) => !NAME_PARTICLES.has(part.toLocaleLowerCase("pt-BR")));
  if (!parts.length) return "";
  return parts.slice(0, 3).join(" ");
}

export function daquiALabel(days) {
  if (days === 0) return "É hoje";
  if (days === 1) return "Amanhã";
  return `Daqui a ${days} dias`;
}

export function personalUpcomingDates({ irmao, casamento, from = new Date() } = {}) {
  if (!irmao) return [];
  const dates = [];
  if (irmao.exibir_aniversario && irmao.dia_nascimento && irmao.mes_nascimento) {
    const days = daysUntil(irmao.mes_nascimento, irmao.dia_nascimento, from);
    if (days !== null) {
      dates.push({
        tipo: "aniversario",
        dia: Number(irmao.dia_nascimento),
        mes: Number(irmao.mes_nascimento),
        days,
        nome: irmao.nome,
      });
    }
  }
  if (irmao.exibir_iniciacao && irmao.data_iniciacao) {
    const [, month, day] = irmao.data_iniciacao.slice(0, 10).split("-").map(Number);
    const days = daysUntil(month, day, from);
    if (days !== null) {
      dates.push({
        tipo: "iniciacao",
        dia: day,
        mes: month,
        days,
        data: irmao.data_iniciacao,
        nome: irmao.nome,
      });
    }
  }
  if (casamento?.autorizado_exibicao && casamento.data_casamento) {
    const [, month, day] = casamento.data_casamento.slice(0, 10).split("-").map(Number);
    const days = daysUntil(month, day, from);
    if (days !== null) {
      dates.push({
        tipo: "casamento",
        dia: day,
        mes: month,
        days,
        data: casamento.data_casamento,
        nome: irmao.nome,
      });
    }
  }
  return dates.sort((a, b) => a.days - b.days);
}

export function nearestPersonalHighlight(dates, { maxDays = 45 } = {}) {
  return (dates || []).find((item) => item.days != null && item.days <= maxDays) || null;
}

export function highlightCopy(item, firstName) {
  if (!item) return null;
  const dateLabel = `${item.dia} de ${monthName(item.mes).toLowerCase()}`;
  const relative = daquiALabel(item.days);
  if (item.tipo === "aniversario" && item.days === 0) {
    return {
      title: `Feliz aniversário, ${firstName}!`,
      dateLabel,
      relative: "É hoje",
    };
  }
  if (item.tipo === "aniversario") {
    return { title: "Seu aniversário está chegando!", dateLabel, relative };
  }
  if (item.tipo === "iniciacao" && item.days === 0) {
    return { title: "Hoje é o aniversário da sua iniciação", dateLabel, relative: "É hoje" };
  }
  if (item.tipo === "iniciacao") {
    return { title: "Seu aniversário de iniciação está chegando!", dateLabel, relative };
  }
  if (item.tipo === "casamento" && item.days === 0) {
    return { title: "Hoje é o aniversário do seu casamento", dateLabel, relative: "É hoje" };
  }
  if (item.tipo === "casamento") {
    return { title: "Seu aniversário de casamento está chegando!", dateLabel, relative };
  }
  return { title: "Uma data sua está chegando!", dateLabel, relative };
}

export function withOwnFlag(items, profile) {
  return (items || []).map((item) => ({
    ...item,
    proprio: isOwnIrmao(profile, item.id),
  }));
}

export function birthdayMeta(item) {
  const relative = relativeDayLabel(item.mes, item.dia, item.from);
  if (item.proprio) return `Seu aniversário · ${relative}`;
  return relative;
}

export function initiationMeta(item) {
  const yearsText = caminhadaLabel(anniversaryYears(item.data, item.from));
  if (item.proprio) return `Seu aniversário de iniciação · ${yearsText}`;
  return yearsText;
}

export function dateBadge(item) {
  return `${padDaySafe(item.dia)} ${monthAbbr(item.mes)}`;
}

function padDaySafe(day) {
  return String(day).padStart(2, "0");
}
