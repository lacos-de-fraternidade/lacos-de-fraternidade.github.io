import { requireMember, signOut } from "../js/guard.js";
import { renderFooter, renderShell } from "../js/shell.js";

export async function bootPage(title, render, options = {}) {
  const ctx = await requireMember(options);
  if (!ctx) return;
  document.body.dataset.perfil = ctx.profile.perfil;
  document.querySelector("#shell").innerHTML = renderShell(ctx.profile, title, options.fromRoot === true);
  if (!document.querySelector(".area-footer")) {
    document.body.insertAdjacentHTML("beforeend", renderFooter(options.fromRoot === true));
  }
  bindShell(ctx);
  if (!document.querySelector("#toast-root")) {
    document.body.insertAdjacentHTML("beforeend", '<div id="toast-root" class="toast-root" aria-live="polite"></div>');
  }
  await render(ctx);
}

export function bindShell(ctx) {
  const leave = () => signOut(ctx.supabase, ctx.session.access_token);
  document.querySelector("#sair")?.addEventListener("click", leave);
  document.querySelector("#sair-mobile")?.addEventListener("click", leave);
  const toggle = document.querySelector("#menu-toggle");
  const header = document.querySelector(".area-header");
  toggle?.addEventListener("click", () => {
    const open = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("[data-dropdown]").forEach((dropdown) => {
    const button = dropdown.querySelector(".nav-dropdown-toggle");
    const menu = dropdown.querySelector(".nav-dropdown-menu");
    if (!button || !menu) return;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = menu.hidden;
      document.querySelectorAll(".nav-dropdown-menu").forEach((node) => {
        node.hidden = true;
        node.closest("[data-dropdown]")?.querySelector(".nav-dropdown-toggle")?.setAttribute("aria-expanded", "false");
      });
      menu.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    });
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".nav-dropdown-menu").forEach((node) => {
      node.hidden = true;
      node.closest("[data-dropdown]")?.querySelector(".nav-dropdown-toggle")?.setAttribute("aria-expanded", "false");
    });
  });
}

export function setText(id, value) {
  const node = document.querySelector(id);
  if (node) node.textContent = value;
}
