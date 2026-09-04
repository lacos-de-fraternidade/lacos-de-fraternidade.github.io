import { bootPage } from "../js/page.js";
import { el } from "../js/ui-state.js";
import { iconSvg } from "../js/datas.js";
import { isOwnIrmao } from "../js/vinculo.js";
import { buildProfileView } from "../js/perfil-painel.js";

await bootPage("Meu perfil", async (ctx) => {
  const view = buildProfileView({
    profile: ctx.profile,
    irmao: await loadOwnIrmao(ctx),
    eventos: await loadSessions(ctx),
  });
  renderIdentity(view.identity);
  renderWelcome(view.welcome);
  renderFields("card-conta", "titulo-conta", "Conta", view.account);
  renderFields("card-institucional", "titulo-institucional", "Dados institucionais", view.institutional);
  renderFields("card-datas", "titulo-datas", "Datas", view.dates);
  renderSecurity(view.security);
  renderNextSession(view.nextSession);
  renderBirthday(view.birthday);
  renderStats(view.stats);
  renderTimeline(view.timeline);
});

async function loadOwnIrmao(ctx) {
  if (!ctx.profile.irmao_id) return null;
  const { data } = await ctx.supabase
    .from("irmaos")
    .select("id, nome, dia_nascimento, mes_nascimento, data_iniciacao, loja_iniciacao, exibir_aniversario, situacao")
    .eq("id", ctx.profile.irmao_id)
    .maybeSingle();
  if (!data || !isOwnIrmao(ctx.profile, data.id || ctx.profile.irmao_id)) return null;
  return data;
}

async function loadSessions(ctx) {
  const { data } = await ctx.supabase
    .from("eventos_internos")
    .select("id, titulo, inicia_em, tipo_evento, publicado, ativo, presenca_obrigatoria, grau, cafe_fraternal, cafe_horario, sessoes_pauta_itens(id, titulo, ordem)")
    .eq("publicado", true)
    .eq("ativo", true);
  return data || [];
}

function renderIdentity(identity) {
  const node = document.querySelector("#perfil-identidade");
  const avatar = el("span", "profile-avatar", identity.initials);
  avatar.setAttribute("aria-hidden", "true");
  const text = el("div", "profile-identity__text");
  text.append(
    el("p", "profile-kicker", "Meu perfil"),
    el("h1", "profile-name", identity.name),
    el("p", "profile-role", identity.role),
    el("p", "profile-lodge", identity.lodge),
  );
  const badge = el("span", identity.active ? "profile-status is-active" : "profile-status", identity.status);
  text.append(badge);
  node.replaceChildren(avatar, text);
}

function renderWelcome(welcome) {
  const node = document.querySelector("#perfil-boas-vindas");
  node.replaceChildren(
    el("p", "profile-welcome__kicker", welcome.kicker),
    el("p", "profile-welcome__name", welcome.name),
    el("p", "profile-welcome__meta", `Último acesso: ${welcome.lastAccess}`),
  );
  if (welcome.sessionWhen) {
    node.append(
      el("p", "profile-welcome__session", welcome.sessionLabel),
      el("p", "profile-welcome__when", welcome.sessionWhen),
    );
  }
}

function renderFields(id, titleId, title, fields) {
  const node = document.querySelector(`#${id}`);
  const heading = el("h2", "profile-card__title", title);
  heading.id = titleId;
  const list = el("dl", "profile-fields");
  fields.forEach((field) => list.append(fieldRow(field)));
  node.replaceChildren(heading, list);
}

function fieldRow(field) {
  const row = el("div", "profile-field");
  const icon = el("span", "profile-field__icon");
  icon.setAttribute("aria-hidden", "true");
  icon.insertAdjacentHTML("afterbegin", iconSvg(field.icon));
  const body = el("div", "profile-field__body");
  body.append(el("dt", "", field.label), el("dd", "", field.value));
  row.append(icon, body);
  return row;
}

function renderSecurity(security) {
  const node = document.querySelector("#card-seguranca");
  const heading = el("h2", "profile-card__title", security.heading);
  heading.id = "titulo-seguranca";
  const icon = el("span", "profile-card__icon");
  icon.setAttribute("aria-hidden", "true");
  icon.insertAdjacentHTML("afterbegin", iconSvg("seguranca"));
  heading.prepend(icon);
  const hint = el("p", "profile-security__hint", security.hint);
  const action = document.createElement("a");
  action.className = "button button-secondary";
  action.href = "../redefinir-senha/";
  action.textContent = security.action;
  const meta = el("dl", "profile-fields");
  meta.append(fieldRow({ icon: "evento", label: "Último acesso", value: security.lastAccess }));
  const soon = el("div", "profile-soon");
  soon.append(
    el("span", "profile-soon__label", security.sessionsLabel),
    el("span", "profile-soon__value", security.sessionsValue),
  );
  node.replaceChildren(heading, hint, action, meta, soon);
}

function renderNextSession(copy) {
  const node = document.querySelector("#card-proxima-sessao");
  if (!copy) {
    node.replaceChildren(el("p", "profile-highlight__kicker", "Próxima sessão"), el("p", "muted", "Nenhuma sessão futura está publicada no momento."));
    return;
  }
  const nodes = [
    el("p", "profile-highlight__kicker", copy.title),
    el("p", "profile-highlight__date", copy.dateLabel),
    el("p", "profile-highlight__title", copy.eventLabel),
    el("p", "profile-highlight__meta", [copy.typeLabel, copy.timeLabel].filter(Boolean).join(" • ")),
    el("p", "profile-highlight__presence", copy.presence),
  ];
  if (copy.program?.length) {
    const list = el("ul", "next-session-card__list");
    copy.program.forEach((line) => list.append(el("li", "", line)));
    nodes.push(list);
  }
  node.replaceChildren(...nodes);
}

function renderBirthday(copy) {
  const node = document.querySelector("#card-aniversario");
  if (!copy) {
    node.replaceChildren(el("p", "profile-highlight__kicker", "Seu aniversário"), el("p", "muted", "A Secretaria ainda não cadastrou esta data."));
    return;
  }
  node.replaceChildren(
    el("p", "profile-highlight__kicker", copy.title),
    el("p", "profile-highlight__date", copy.dateLabel),
    el("p", `profile-highlight__relative is-${copy.tone}`, copy.relative),
  );
}

function renderStats(stats) {
  const node = document.querySelector("#perfil-estatisticas");
  const list = el("dl", "profile-stats__list");
  stats.forEach((stat) => {
    const item = el("div", "profile-stats__item");
    item.append(el("dt", "", stat.label), el("dd", "", stat.value));
    list.append(item);
  });
  node.replaceChildren(list);
}

function renderTimeline(items) {
  const node = document.querySelector("#perfil-timeline");
  const heading = el("h2", "profile-card__title", "Minha caminhada");
  heading.id = "titulo-caminhada";
  if (!items.length) {
    node.replaceChildren(heading, el("p", "muted", "Sua linha do tempo será preenchida quando a Secretaria concluir o cadastro institucional."));
    return;
  }
  const list = el("ol", "profile-timeline__list");
  items.forEach((item) => {
    const li = el("li", item.past ? "profile-timeline__item is-past" : "profile-timeline__item");
    li.append(el("p", "profile-timeline__date", item.dateLabel), el("p", "profile-timeline__title", item.title));
    list.append(li);
  });
  node.replaceChildren(heading, list);
}
