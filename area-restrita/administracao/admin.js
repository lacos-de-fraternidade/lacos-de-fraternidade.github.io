import { bootPage } from "../js/page.js";
import { invokeFunction } from "../js/client.js";
import { requireMember } from "../js/guard.js";

const ctx = await requireMember({ staff: true });
if (!ctx) throw new Error("redirect");

await bootPage("Gerenciar membros", async () => {
  const status = document.querySelector("#status");
  const body = document.querySelector("#membros");

  async function staffAction(payload) {
    return invokeFunction("gerenciar-irmao", payload, ctx.session.access_token);
  }

  async function refresh() {
    const { data } = await staffAction({ acao: "listar" });
    body.replaceChildren();
    (data.membros || []).forEach((membro) => {
      const tr = document.createElement("tr");
      const cells = [
        membro.nome,
        membro.cim_mascarada,
        membro.email,
        membro.perfil,
        membro.ativo ? "Ativo" : "Inativo",
        membro.conta_ativada ? "Sim" : "Não",
        membro.convite_enviado_em ? new Date(membro.convite_enviado_em).toLocaleDateString("pt-BR") : "—",
        membro.ultimo_acesso_em ? new Date(membro.ultimo_acesso_em).toLocaleDateString("pt-BR") : "—",
      ];
      cells.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      });
      const actions = document.createElement("td");
      const buttons = [
        ["Convite", { acao: "enviar_convite", id: membro.id }, true],
        [membro.ativo ? "Desativar" : "Ativar", { acao: membro.ativo ? "desativar" : "ativar", id: membro.id }, true],
        ["Desbloquear", { acao: "desbloquear", id: membro.id }, false],
        ["Revogar", { acao: "revogar", id: membro.id }, true],
      ];
      buttons.forEach(([label, payload, confirm]) => {
        if (label === "Revogar" && ctx.profile.perfil !== "administrador") return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button-secondary";
        button.textContent = label;
        button.addEventListener("click", async () => {
          if (confirm && !window.confirm(`Confirmar ação: ${label}?`)) return;
          const result = await staffAction(payload);
          status.textContent = result.data?.ok ? "Ação concluída." : (result.data?.error || "Não foi possível concluir esta ação.");
          status.classList.toggle("is-ok", Boolean(result.data?.ok));
          await refresh();
        });
        actions.append(button);
      });
      tr.append(actions);
      body.append(tr);
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
});
