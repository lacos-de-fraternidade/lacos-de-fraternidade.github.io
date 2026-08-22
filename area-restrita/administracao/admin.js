import { bootPage } from "../js/page.js";
import { invokeFunction } from "../js/client.js";
import { displayPersonName } from "../js/vinculo.js";
import { el } from "../js/ui-state.js";

await bootPage("Gerenciar membros", async (ctx) => {
  const status = document.querySelector("#status");
  const list = document.querySelector("#membros");

  async function staffAction(payload) {
    return invokeFunction("gerenciar-irmao", payload, ctx.session.access_token);
  }

  async function refresh() {
    const { data } = await staffAction({ acao: "listar" });
    list.replaceChildren();
    (data.membros || []).forEach((membro) => {
      const card = el("article", "member-card");
      const body = el("div");
      const situacao = `${membro.ativo ? "Ativo" : "Inativo"} · ${membro.conta_ativada ? "conta ativada" : "conta pendente"}`;
      body.append(
        el("strong", "person-name", displayPersonName(membro.nome)),
        el("p", "muted", `${labelPerfil(membro.perfil)} · CIM ${membro.cim_mascarada}`),
        el("p", "muted", situacao),
        el("p", "muted", `Último acesso: ${membro.ultimo_acesso_em ? new Date(membro.ultimo_acesso_em).toLocaleDateString("pt-BR") : "—"}`),
      );
      const menu = el("div", "actions-menu");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "button button-secondary table-action";
      toggle.setAttribute("aria-haspopup", "true");
      toggle.textContent = "•••";
      const panel = el("div", "nav-dropdown-menu");
      panel.hidden = true;
      const actions = [
        ["Enviar convite", { acao: "enviar_convite", id: membro.id }, true],
        [membro.ativo ? "Desativar" : "Ativar", { acao: membro.ativo ? "desativar" : "ativar", id: membro.id }, true],
        ["Desbloquear", { acao: "desbloquear", id: membro.id }, false],
      ];
      if (ctx.profile.perfil === "administrador") {
        actions.push(["Revogar acesso", { acao: "revogar", id: membro.id }, true]);
      }
      actions.forEach(([label, payload, confirm]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", async () => {
          if (confirm && !window.confirm(`Confirmar ação: ${label}?`)) return;
          const result = await staffAction(payload);
          status.textContent = result.data?.ok ? "Ação concluída." : (result.data?.error || "Não foi possível concluir esta ação.");
          status.classList.toggle("is-ok", Boolean(result.data?.ok));
          await refresh();
        });
        panel.append(button);
      });
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        panel.hidden = !panel.hidden;
      });
      menu.append(toggle, panel);
      card.append(body, menu);
      list.append(card);
    });
  }

  document.querySelector("#criar-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      acao: "criar",
      nome: document.querySelector("#nome").value,
      cim: document.querySelector("#cim").value,
      email: document.querySelector("#email").value,
      perfil: document.querySelector("#perfil")?.value || "irmao",
    };
    const result = await staffAction(payload);
    status.textContent = result.data?.ok ? "Irmão cadastrado." : (result.data?.error || "Não foi possível cadastrar.");
    status.classList.toggle("is-ok", Boolean(result.data?.ok));
    await refresh();
  });

  await refresh();
}, { staff: true });

function labelPerfil(perfil) {
  return { irmao: "Irmão", secretario: "Secretário", administrador: "Administrador" }[perfil] || perfil;
}
