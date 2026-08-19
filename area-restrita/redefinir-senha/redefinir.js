import { areaClient, invokeFunction } from "../js/client.js";
import { inspectPassword, strengthLabel } from "../js/password.js";

const supabase = areaClient();
const form = document.querySelector("#redefinir-form");
const status = document.querySelector("#status");
const senha = document.querySelector("#senha");
const meter = document.querySelector("#meter-bar");
const meterLabel = document.querySelector("#meter-label");

senha.addEventListener("input", () => {
  const check = inspectPassword(senha.value);
  meter.style.width = `${check.score * 25}%`;
  meterLabel.textContent = check.errors[0] || `Força da senha: ${strengthLabel(check.score)}`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    status.textContent = "Abra o link enviado ao seu e-mail para continuar.";
    return;
  }
  if (senha.value !== form.confirma.value) {
    status.textContent = "As senhas não coincidem.";
    return;
  }
  const check = inspectPassword(senha.value);
  if (!check.ok) {
    status.textContent = check.errors[0];
    return;
  }
  const { error } = await supabase.auth.updateUser({ password: senha.value });
  if (error) {
    status.textContent = "Não foi possível concluir esta ação. Tente novamente ou fale com a Secretaria.";
    return;
  }
  await invokeFunction("gerenciar-irmao", { acao: "registrar_senha_alterada" }, session.access_token);
  await supabase.auth.signOut();
  status.classList.add("is-ok");
  status.textContent = "Senha alterada. Faça o acesso novamente.";
  window.location.replace("../login/");
});
