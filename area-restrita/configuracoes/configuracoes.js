import { bootPage } from "../js/page.js";
import { invokeFunction } from "../js/client.js";
import { beginSubmit, endSubmit, showToast } from "../js/feedback.js";

await bootPage("Configurações", async (ctx) => {
  const { data } = await ctx.supabase.from("configuracoes_autenticacao").select("convite_validade_horas, retencao_logs_dias").eq("id", 1).maybeSingle();
  if (data?.convite_validade_horas) {
    document.querySelector("#convite-validade").textContent = `${data.convite_validade_horas} horas`;
  }
  if (data?.retencao_logs_dias) {
    document.querySelector("#logs-retencao").textContent = `${data.retencao_logs_dias} dias`;
  }
  document.querySelector("#gerar-sessoes").addEventListener("click", async () => {
    const button = document.querySelector("#gerar-sessoes");
    if (!beginSubmit(button, "Gerando...")) return;
    try {
      const result = await invokeFunction("gerenciar-irmao", { acao: "gerar_sessoes" }, ctx.session.access_token);
      showToast({
        type: result.data?.ok ? "success" : "error",
        message: result.data?.ok
          ? "Sessões da 2ª e da 4ª quarta-feira geradas para os próximos 12 meses."
          : (result.data?.error || "Não foi possível gerar as sessões."),
      });
    } finally {
      endSubmit(button);
    }
  });
}, { admin: true });
