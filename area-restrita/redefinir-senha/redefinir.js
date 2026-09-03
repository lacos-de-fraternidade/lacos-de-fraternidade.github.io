import { areaClient, invokeFunction } from "../js/client.js";
import { consumeEmailAuthToken, establishAuthSession } from "../js/auth-session.js";
import { inspectPassword } from "../js/password.js";
import { bindPasswordToggle } from "../js/password-toggle.js";
import { bindPasswordRequirements } from "../js/password-ui.js";
import { beginSubmit, endSubmit } from "../js/feedback.js";

const supabase = areaClient({ flowType: "implicit" });
const form = document.querySelector("#redefinir-form");
const status = document.querySelector("#status");
const gate = document.querySelector("#redefinir-gate");
const gateStatus = document.querySelector("#gate-status");
const continueBtn = document.querySelector("#redefinir-continuar-btn");
const senha = document.querySelector("#senha");
const established = await establishAuthSession(supabase);
let currentSession = established.session || null;

function showGate(message, { showButton = false } = {}) {
  gate.hidden = false;
  form.hidden = true;
  gateStatus.textContent = message || "";
  continueBtn.hidden = !showButton;
}

function showForm() {
  gate.hidden = true;
  form.hidden = false;
  if (status.textContent) status.textContent = "";
}

if (established.pending) {
  showGate("Por segurança, confirme o link nesta página para continuar.", { showButton: true });
} else if (!currentSession) {
  showGate(established.error || "Abra o link enviado ao seu e-mail para continuar.");
} else {
  showForm();
}

bindPasswordToggle(senha, document.querySelector("#toggle-senha"));
bindPasswordToggle(form.confirma, document.querySelector("#toggle-confirma"));
bindPasswordRequirements(
  senha,
  document.querySelector("#req-list"),
  document.querySelector("#meter-bar"),
  document.querySelector("#meter-label"),
);

continueBtn.addEventListener("click", async () => {
  if (!beginSubmit(continueBtn, "Validando o link...")) return;
  try {
    const result = await consumeEmailAuthToken(supabase);
    if (!result.session) {
      showGate(result.error || "Abra o link enviado ao seu e-mail para continuar.", { showButton: true });
      return;
    }
    currentSession = result.session;
    showForm();
    senha.focus();
  } finally {
    endSubmit(continueBtn);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { data: { session } } = await supabase.auth.getSession();
  const current = session || currentSession;
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
