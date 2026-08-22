import { bootPage } from "./js/page.js";
import { firstName } from "./js/guard.js";
import { el, showEmpty, showError, showSkeleton } from "./js/ui-state.js";
import { upcomingByMonthDay } from "./js/datas.js";
import { collectMasonicDates } from "./js/datas-maconicas.js";
import {
  birthdayMeta,
  dateBadge,
  displayPersonName,
  firstGivenName,
  highlightCopy,
  initiationMeta,
  isOwnIrmao,
  nearestPersonalHighlight,
  personalUpcomingDates,
} from "./js/vinculo.js";
import {
  daysUntilDate,
  LODGE_NAME,
  nextLodgeSession,
  relativeDaysLabel,
  sessionTitle,
} from "./js/sessoes.js";
import { pickDashboardNotice, relatedSessionNotices, relatedEventForNotice, noticePublicDateLabel, sessionNoticeCopy, NOTICE_TYPE_LABELS, truncateText } from "./js/comunicados.js";

await bootPage("Início", async (ctx) => {
  document.querySelector("#saudacao").textContent = `Bem-vindo, ${firstName(ctx.profile.nome)}.`;
  document.querySelector("#data-hoje").textContent = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  await loadDashboard(ctx);
}, { fromRoot: true });

async function loadDashboard(ctx) {
  const niverNode = document.querySelector("#proximos-niver");
  const inicNode = document.querySelector("#proximas-iniciacoes");
  const eventoNode = document.querySelector("#proximo-evento");
  const comunicadosNode = document.querySelector("#comunicados");
  showSkeleton(niverNode);
  showSkeleton(inicNode);
  showSkeleton(eventoNode, 2);
  showSkeleton(comunicadosNode, 2);

  const irmaoId = ctx.profile.irmao_id || null;
  const queries = [
    ctx.supabase.from("irmaos").select("id, nome, dia_nascimento, mes_nascimento, exibir_aniversario, data_iniciacao, loja_iniciacao, exibir_iniciacao").eq("ativo", true),
    ctx.supabase.from("eventos_internos").select("id, titulo, descricao, inicia_em, tipo_evento, data_evento, publicado, ativo, destaque, presenca_obrigatoria").eq("publicado", true).eq("ativo", true),
    ctx.supabase.from("comunicados_internos").select("id, titulo, corpo, tipo, prioridade, destaque, presenca_obrigatoria, inicio_exibicao, fim_exibicao, publicado, criado_em").eq("publicado", true).order("criado_em", { ascending: false }).limit(8),
  ];
  if (irmaoId) {
    queries.push(
      ctx.supabase.from("casamentos").select("irmao_id, data_casamento, autorizado_exibicao").eq("irmao_id", irmaoId).eq("ativo", true).limit(1),
    );
  }

  const [irmaosRes, eventosRes, comunicadosRes, casamentoRes] = await Promise.all(queries);

  if (irmaosRes.error) {
    showError(niverNode, () => loadDashboard(ctx));
    showError(inicNode, () => loadDashboard(ctx));
  } else {
    const irmaos = irmaosRes.data || [];
    const casamento = Array.isArray(casamentoRes?.data) ? casamentoRes.data[0] : casamentoRes?.data || null;
    renderPersonalHighlight(ctx, irmaos, casamento);
    renderBirthdays(ctx, niverNode, irmaos);
    renderInitiations(ctx, inicNode, irmaos);
  }

  const eventos = eventosRes.data || [];
  if (eventosRes.error) showError(eventoNode, () => loadDashboard(ctx));
  else renderEvent(eventoNode, eventos, comunicadosRes.data || []);

  if (comunicadosRes.error) showError(comunicadosNode, () => loadDashboard(ctx));
  else renderNotices(comunicadosNode, comunicadosRes.data || [], eventos);
}

function renderPersonalHighlight(ctx, irmaos, casamento) {
  const node = document.querySelector("#destaque-pessoal");
  const own = (irmaos || []).find((row) => isOwnIrmao(ctx.profile, row.id));
  if (!own) {
    node.hidden = true;
    node.replaceChildren();
    return;
  }
  const dates = personalUpcomingDates({ irmao: own, casamento });
  const next = nearestPersonalHighlight(dates);
  if (!next) {
    node.hidden = true;
    node.replaceChildren();
    return;
  }
  const copy = highlightCopy(next, firstGivenName(own.nome));
  node.hidden = false;
  const icon = document.createElement("img");
  icon.src = "../assets/icons/calendario.svg";
  icon.alt = "";
  icon.width = 28;
  icon.height = 28;
  const clock = document.createElement("img");
  clock.src = "../assets/icons/relogio.svg";
  clock.alt = "";
  clock.width = 20;
  clock.height = 20;
  const kicker = el("p", "highlight-kicker", copy.title);
  const row = el("div", "highlight-row");
  const date = el("p", "highlight-date", copy.dateLabel);
  const relative = el("p", "highlight-relative", "");
  relative.append(clock, document.createTextNode(copy.relative));
  row.append(date, relative);
  const note = el("p", "highlight-note", "Que este novo ciclo seja marcado por fraternidade e aperfeiçoamento.");
  node.replaceChildren(icon, kicker, row, next.tipo === "aniversario" ? note : el("span"));
}

function renderBirthdays(ctx, node, irmaos) {
  const items = upcomingByMonthDay(
    irmaos
      .filter((row) => row.exibir_aniversario && row.dia_nascimento && row.mes_nascimento)
      .map((row) => ({
        id: row.id,
        nome: row.nome,
        dia: row.dia_nascimento,
        mes: row.mes_nascimento,
        proprio: isOwnIrmao(ctx.profile, row.id),
      })),
    3,
  );
  if (!items.length) {
    showEmpty(node, "Nenhum aniversário cadastrado para este período.");
    return;
  }
  node.replaceChildren(upcomingList(items, (item) => birthdayMeta(item)), moreLink("./aniversarios/", "Ver todos os aniversários"));
}

function renderInitiations(ctx, node, irmaos) {
  const items = upcomingByMonthDay(
    collectMasonicDates({ irmaos }, { isOwn: (id) => isOwnIrmao(ctx.profile, id) }),
    3,
  );
  if (!items.length) {
    showEmpty(node, "Nenhuma data maçônica cadastrada para este período.");
    return;
  }
  node.replaceChildren(
    upcomingList(items, (item) => initiationMeta(item)),
    moreLink("./iniciacoes/", "Ver todas as datas maçônicas"),
  );
}

function upcomingList(items, metaFn) {
  const list = el("ul", "upcoming-list");
  items.forEach((item) => {
    const li = el("li", item.proprio ? "upcoming-item is-own" : "upcoming-item");
    const badge = el("span", "date-block");
    badge.append(el("strong", "", String(item.dia).padStart(2, "0")), el("span", "", dateBadge(item).slice(-3)));
    const body = el("div", "upcoming-body");
    body.append(
      el("strong", "person-name", displayPersonName(item.nome)),
      el("span", "upcoming-meta", metaFn(item)),
    );
    li.append(badge, body);
    list.append(li);
  });
  return list;
}

function moreLink(href, label) {
  const more = document.createElement("a");
  more.className = "inline-link";
  more.href = href;
  more.textContent = label;
  return more;
}

function sessionNoticeCue(copy) {
  const block = document.createElement("a");
  block.className = "session-notice";
  block.href = "#card-comunicados";
  const kicker = el("p", "session-notice-kicker");
  const icon = document.createElement("span");
  icon.className = "session-notice-icon";
  icon.setAttribute("aria-hidden", "true");
  kicker.append(icon, document.createTextNode("Comunicado da Loja"));
  const text = el("p", "session-notice-text", copy);
  const action = el("span", "session-notice-link", "Ler comunicado →");
  block.append(kicker, text, action);
  block.addEventListener("click", (event) => {
    event.preventDefault();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    document.querySelector("#card-comunicados")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
  return block;
}

function renderEvent(node, eventos, comunicados = []) {
  const card = document.querySelector("#card-eventos");
  const next = nextLodgeSession(eventos, new Date());
  card.classList.toggle("is-empty", !next);
  if (!next) {
    showEmpty(node, "Nenhuma sessão futura está publicada no momento.", { compact: true, icon: "../assets/icons/calendario.svg" });
    return;
  }
  const days = daysUntilDate(next.when);
  const weekday = next.when.toLocaleDateString("pt-BR", { weekday: "long" });
  const time = `${String(next.when.getHours()).padStart(2, "0")}h${String(next.when.getMinutes()).padStart(2, "0")}`;
  node.replaceChildren(
    el("p", "session-date", next.when.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })),
    el("p", "session-meta muted", `${weekday} • ${time}`),
    el("p", "session-relative", relativeDaysLabel(days)),
  );
  const related = relatedSessionNotices(comunicados, next);
  if (related.length) {
    node.append(sessionNoticeCue(sessionNoticeCopy(related.length)));
  } else {
    node.append(el("p", "session-note muted", "Organize sua agenda para estar presente."));
  }
  void sessionTitle(next);
  void LODGE_NAME;
}

function renderNotices(node, comunicados, eventos) {
  const card = document.querySelector("#card-comunicados");
  const notice = pickDashboardNotice({ comunicados, eventos, from: new Date() });
  card.classList.toggle("is-empty", !notice);
  if (!notice) {
    showEmpty(node, "Não há comunicados ativos no momento.", { compact: true, icon: "../assets/icons/conhecimento.svg" });
    return;
  }
  const full = String(notice.corpo || "");
  const block = el("article", "notice");
  block.append(el("p", "notice-kicker", "Comunicado da Loja"));
  block.append(el("strong", "", notice.titulo));
  const badges = el("div", "badge-row");
  badges.append(el("span", "chip", NOTICE_TYPE_LABELS[notice.tipo] || notice.tipo || "Informativo"));
  if (notice.destaque) badges.append(el("span", "chip chip-gold", "Destaque"));
  if (notice.presenca_obrigatoria) badges.append(el("span", "chip", "Presença necessária"));
  block.append(badges);
  const body = el("p", "notice-body-clamp", truncateText(full, 220));
  block.append(body);
  const eventLabel = noticePublicDateLabel(relatedEventForNotice(notice, eventos));
  if (eventLabel) block.append(el("p", "muted", eventLabel));
  if (full.length > 180) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "button button-secondary";
    more.textContent = "Ver comunicado";
    more.addEventListener("click", () => {
      const open = body.classList.toggle("is-expanded");
      body.textContent = open ? full : truncateText(full, 220);
      more.textContent = open ? "Ocultar" : "Ver comunicado";
    });
    block.append(more);
  }
  node.replaceChildren(block);
}
