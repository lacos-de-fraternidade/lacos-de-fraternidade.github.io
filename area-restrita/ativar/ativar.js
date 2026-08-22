import { areaClient, invokeFunction } from "../js/client.js";
import { establishAuthSession } from "../js/auth-session.js";
import { bindPasswordToggle } from "../js/password-toggle.js";
import { bindPasswordRequirements } from "../js/password-ui.js";
import { beginSubmit, endSubmit, showToast } from "../js/feedback.js";
import {
  ACTIVATE_SUCCESS_TOAST,
  GENERIC_ACTIVATE_ERROR,
  canSubmitActivation,
  localActivateMessage,
  mapActivateError,
  sanitizeCimInput,
} from "../js/ativar-acesso.js";

const supabase = areaClient({ flowType: "implicit" });
const form = document.querySelector("#ativar-form");
const status = document.querySelector("#status");
const senha = document.querySelector("#senha");
const submit = document.querySelector("#ativar-submit");
const formView = document.querySelector("#ativar-form-view");
const successView = document.querySelector("#ativar-sucesso");

const established = await establishAuthSession(supabase);
let currentSession = established.session || null;
if (!currentSession) {
  status.textContent = established.error || GENERIC_ACTIVATE_ERROR;
}

supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
  if (session && status.textContent) status.textContent = "";
  syncSubmit();
});

bindPasswordToggle(senha, document.querySelector("#toggle-senha"));
bindPasswordToggle(form.confirma, document.querySelector("#toggle-confirma"));
bindPasswordRequirements(
  senha,
  document.querySelector("#req-list"),
  document.querySelector("#meter-bar"),
  document.querySelector("#meter-label"),
  () => ({ cim: sanitizeCimInput(form.cim.value) }),
);

form.cim.addEventListener("input", () => {
  form.cim.value = sanitizeCimInput(form.cim.value);
  syncSubmit();
});
["input", "change"].forEach((eventName) => {
  form.addEventListener(eventName, syncSubmit);
});

function formState() {
  return {
    cim: form.cim.value,
    password: senha.value,
    confirmacao: form.confirma.value,
    termos: form.termos.checked,
    session: currentSession,
  };
}

function syncSubmit() {
  submit.disabled = !canSubmitActivation(formState());
}

function showSuccess() {
  formView.hidden = true;
  successView.hidden = false;
  successView.querySelector("a")?.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const state = formState();
  if (!state.session) {
    status.textContent = GENERIC_ACTIVATE_ERROR;
    return;
  }
  const localError = localActivateMessage(state);
  if (localError || !canSubmitActivation(state)) {
    status.textContent = localError || GENERIC_ACTIVATE_ERROR;
    return;
  }
  if (!beginSubmit(submit, "Ativando sua conta...")) return;
  try {
    const { data } = await invokeFunction("ativar-conta", {
      cim: sanitizeCimInput(state.cim),
      password: state.password,
      confirmacao: state.confirmacao,
      termos: state.termos,
    }, state.session.access_token);
    if (!data?.ok) {
      status.textContent = mapActivateError(data?.error);
      return;
    }
    status.textContent = "";
    showToast({ type: "success", message: ACTIVATE_SUCCESS_TOAST, duration: 5000 });
    showSuccess();
  } finally {
    endSubmit(submit);
    syncSubmit();
  }
});

syncSubmit();
