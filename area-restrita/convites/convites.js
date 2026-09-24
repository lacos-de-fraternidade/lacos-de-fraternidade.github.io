import { bootPage } from "../js/page.js";
import { invokeFunction } from "../js/client.js";
import { el, showEmpty } from "../js/ui-state.js";
import { displayPersonName } from "../js/vinculo.js";
import { inviteStatus, inviteStatusLabel, maskEmail } from "../js/convite-status.js";
import { beginSubmit, endSubmit, showToast } from "../js/feedback.js";

await bootPage("Convites", async (ctx) => {
  const root = document.querySelector("#lista");

  async function refresh() {
    const { data } = await invokeFunction("gerenciar-irmao", { acao: "listar" }, ctx.session.access_token);
    const membros = data.membros || [];
    if (!membros.length) {
      showEmpty(root, "Nenhum convite registrado.");
      return;
    }
    root.replaceChildren();
    membros.forEach((membro) => {
      const state = inviteStatus(membro);
      const card = el("article", "invite-card");
      const body = el("div");
      body.append(
        el("strong", "person-name", displayPersonName(membro.nome)),
        el("p", "muted", `CIM ${membro.cim_mascarada} · ${maskEmail(membro.email)}`),
        el("p", "muted", `Enviado em ${membro.convite_enviado_em ? new Date(membro.convite_enviado_em).toLocaleDateString("pt-BR") : "—"} · Expira em ${membro.convite_expira_em ? new Date(membro.convite_expira_em).toLocaleDateString("pt-BR") : "—"}`),
      );
      const side = el("div");
      side.append(el("span", "status-pill", inviteStatusLabel(state)));
      if (state === "pendente" || state === "enviado" || state === "expirado") {
        const reenviar = document.createElement("button");
        reenviar.type = "button";
        reenviar.className = "button button-secondary table-action";
        reenviar.textContent = "Reenviar";
        reenviar.addEventListener("click", async () => {
          if (!beginSubmit(reenviar, "Enviando...")) return;
          try {
            const result = await invokeFunction("gerenciar-irmao", { acao: "enviar_convite", id: membro.id, site_origin: location.origin }, ctx.session.access_token);
            endSubmit(reenviar);
            showToast({
              type: result.data?.ok ? "success" : "error",
              message: result.data?.ok ? "Convite enviado para o e-mail cadastrado." : (result.data?.error || "Não foi possível enviar o convite."),
            });
            if (result.data?.ok) await refresh();
          } catch {
            endSubmit(reenviar);
            showToast({ type: "error", message: "Não foi possível enviar o convite." });
          }
        });
        side.append(reenviar);
      }
      if (state === "enviado") {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "button button-danger table-action";
        cancel.textContent = "Cancelar convite";
        cancel.addEventListener("click", async () => {
          if (!beginSubmit(cancel, "Cancelando...")) return;
          try {
            const result = await invokeFunction("gerenciar-irmao", { acao: "cancelar_convite", id: membro.id }, ctx.session.access_token);
            showToast({ type: result.data?.ok ? "success" : "error", message: result.data?.ok ? "Convite cancelado." : "Não foi possível concluir esta ação." });
            await refresh();
          } finally {
            endSubmit(cancel);
          }
        });
        side.append(cancel);
      }
      card.append(body, side);
      root.append(card);
    });
  }

  await refresh();
}, { staff: true });
