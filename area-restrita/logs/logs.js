import { bootPage } from "../js/page.js";
import { invokeFunction } from "../js/client.js";
import { LOG_LABELS, LOG_ORIGEM_LABELS, logContainsSecret, logOriginForEvent } from "../js/comunicados.js";
import { paginate, sortByDate } from "../js/list-page.js";
import { formatDateTimeBr } from "../js/dates-br.js";

const PAGE_SIZE = 20;
let rows = [];
let page = 1;

await bootPage("Logs", async (ctx) => {
  const select = document.querySelector("#filtro-evento");
  Object.entries(LOG_LABELS).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  ["filtro-periodo", "filtro-evento", "filtro-resultado", "filtro-usuario", "filtro-ordem"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", () => { page = 1; render(); });
    document.querySelector(`#${id}`).addEventListener("change", () => { page = 1; render(); });
  });
  document.querySelector("#limpar-filtros").addEventListener("click", () => {
    document.querySelector("#filtro-periodo").value = "30";
    document.querySelector("#filtro-evento").value = "";
    document.querySelector("#filtro-resultado").value = "";
    document.querySelector("#filtro-usuario").value = "";
    document.querySelector("#filtro-ordem").value = "desc";
    page = 1;
    render();
  });
  document.querySelector("#logs-prev").addEventListener("click", () => { page -= 1; render(); });
  document.querySelector("#logs-next").addEventListener("click", () => { page += 1; render(); });
  document.querySelector("#logs-count").textContent = "Carregando registros...";
  const { data } = await invokeFunction("gerenciar-irmao", { acao: "logs" }, ctx.session.access_token);
  rows = Array.isArray(data?.logs) ? data.logs.filter((row) => !logContainsSecret(row)) : [];
  if (!rows.length) {
    const fallback = await ctx.supabase.from("logs_autenticacao").select("id, evento, sucesso, criado_em, origem").order("criado_em", { ascending: false }).limit(400);
    rows = (fallback.data || []).map((row) => ({
      ...row,
      usuario: "Sistema",
      origem: row.origem || logOriginForEvent(row.evento),
    }));
  }
  render();
}, { admin: true });

function render() {
  const days = document.querySelector("#filtro-periodo").value;
  const evento = document.querySelector("#filtro-evento").value;
  const resultado = document.querySelector("#filtro-resultado").value;
  const usuario = document.querySelector("#filtro-usuario").value.trim().toLocaleLowerCase("pt-BR");
  const order = document.querySelector("#filtro-ordem").value;
  const since = days === "all" ? 0 : Date.now() - Number(days) * 86400000;
  const filtered = sortByDate(rows.filter((row) => {
    if (since && new Date(row.criado_em).getTime() < since) return false;
    if (evento && row.evento !== evento) return false;
    if (resultado === "ok" && row.sucesso !== true) return false;
    if (resultado === "fail" && row.sucesso === true) return false;
    if (usuario && !String(row.usuario || "").toLocaleLowerCase("pt-BR").includes(usuario)) return false;
    return true;
  }), "criado_em", order);
  const slice = paginate(filtered, page, PAGE_SIZE);
  page = slice.page;
  const body = document.querySelector("#logs");
  const empty = document.querySelector("#logs-empty");
  const pager = document.querySelector("#logs-pager");
  body.replaceChildren();
  document.querySelector("#logs-count").textContent = `${slice.total} registro${slice.total === 1 ? "" : "s"} encontrado${slice.total === 1 ? "" : "s"}`;
  empty.hidden = slice.total > 0;
  pager.hidden = slice.total === 0;
  document.querySelector("#logs-page").textContent = `Página ${slice.page} de ${slice.pages}`;
  document.querySelector("#logs-prev").disabled = slice.page <= 1;
  document.querySelector("#logs-next").disabled = slice.page >= slice.pages;
  slice.rows.forEach((item) => {
    const tr = document.createElement("tr");
    [
      formatDateTimeBr(item.criado_em) || new Date(item.criado_em).toLocaleString("pt-BR"),
      LOG_LABELS[item.evento] || item.evento,
      item.usuario || "Sistema",
      item.sucesso ? "Sucesso" : "Falha",
      LOG_ORIGEM_LABELS[item.origem] || item.origem || LOG_ORIGEM_LABELS[logOriginForEvent(item.evento)] || "Administração",
    ].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    });
    body.append(tr);
  });
}
