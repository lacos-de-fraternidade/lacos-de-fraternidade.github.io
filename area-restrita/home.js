import { requireMember, signOut, firstName } from "./js/guard.js";
import { renderShell } from "./js/shell.js";

const ctx = await requireMember();
if (!ctx) throw new Error("redirect");
document.body.dataset.perfil = ctx.profile.perfil;
document.querySelector("#shell").innerHTML = renderShell(ctx.profile, "Início", true);
document.querySelector("#saudacao").textContent = `Bem-vindo, ${firstName(ctx.profile.nome)}.`;
document.querySelector("#sair").addEventListener("click", () => signOut(ctx.supabase, ctx.session.access_token));

function upcoming(list, tipo) {
  const today = new Date();
  const start = today.getMonth() * 31 + today.getDate();
  return (list || [])
    .filter((item) => item.tipo === tipo && item.autorizado)
    .sort((a, b) => (a.mes * 31 + a.dia) - (b.mes * 31 + b.dia))
    .slice(0, 3)
    .map((item) => `${String(item.dia).padStart(2, "0")}/${String(item.mes).padStart(2, "0")} — ${item.nome_exibicao}`)
    .join("\n");
}

const [{ data: eventos }, { data: celebracoes }, { data: comunicados }] = await Promise.all([
  ctx.supabase.from("eventos_internos").select("titulo, inicia_em").eq("publicado", true).gte("inicia_em", new Date().toISOString()).order("inicia_em").limit(1),
  ctx.supabase.from("celebracoes").select("tipo, nome_exibicao, mes, dia, autorizado"),
  ctx.supabase.from("comunicados_internos").select("titulo, corpo, criado_em").eq("publicado", true).order("criado_em", { ascending: false }).limit(3),
]);

if (eventos?.[0]) {
  const when = new Date(eventos[0].inicia_em).toLocaleString("pt-BR");
  document.querySelector("#proximo-evento").textContent = `${eventos[0].titulo} — ${when}`;
}
const niver = upcoming(celebracoes, "aniversario");
if (niver) document.querySelector("#proximos-niver").textContent = niver;
const inic = upcoming(celebracoes, "iniciacao");
if (inic) document.querySelector("#proximas-iniciacoes").textContent = inic;
if (comunicados?.length) {
  const box = document.querySelector("#comunicados");
  box.replaceChildren();
  comunicados.forEach((item) => {
    const title = document.createElement("strong");
    title.textContent = item.titulo;
    const body = document.createElement("p");
    body.textContent = item.corpo;
    box.append(title, body);
  });
}
