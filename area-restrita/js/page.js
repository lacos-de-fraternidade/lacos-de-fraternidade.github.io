import { requireMember, signOut } from "../js/guard.js";
import { renderShell } from "../js/shell.js";

export async function bootPage(title, render) {
  const ctx = await requireMember();
  if (!ctx) return;
  document.body.dataset.perfil = ctx.profile.perfil;
  document.querySelector("#shell").innerHTML = renderShell(ctx.profile, title, false);
  document.querySelector("#sair").addEventListener("click", () => signOut(ctx.supabase, ctx.session.access_token));
  await render(ctx);
}

export function setText(id, value) {
  const node = document.querySelector(id);
  if (node) node.textContent = value;
}
