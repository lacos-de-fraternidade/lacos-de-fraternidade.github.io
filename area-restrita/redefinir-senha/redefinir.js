import { areaClient, invokeFunction } from "../js/client.js";
import { establishAuthSession } from "../js/auth-session.js";
import { inspectPassword } from "../js/password.js";
import { bindPasswordToggle } from "../js/password-toggle.js";
import { bindPasswordRequirements } from "../js/password-ui.js";

const supabase = areaClient({ flowType: "implicit" });
const form = document.querySelector("#redefinir-form");
const status = document.querySelector("#status");
const senha = document.querySelector("#senha");
const established = await establishAuthSession(supabase);
if (!established.session) {
  status.textContent = established.error || "Abra o link enviado ao seu e-mail para continuar.";
}

bindPasswordToggle(senha, document.querySelector("#toggle-senha"));
bindPasswordToggle(form.confirma, document.querySelector("#toggle-confirma"));
bindPasswordRequirements(
  senha,
  document.querySelector("#req-list"),
  document.querySelector("#meter-bar"),
  document.querySelector("#meter-label"),
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { data: { session } } = await supabase.auth.getSession();
  const current = session || established.session;
  if (!current) {
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
  await invokeFunction("gerenciar-irmao", { acao: "registrar_senha_alterada" }, current.access_token);
  await supabase.auth.signOut();
  status.classList.add("is-ok");
  status.textContent = "Senha alterada. Faça o acesso novamente.";
  window.location.replace("../login/");
});
