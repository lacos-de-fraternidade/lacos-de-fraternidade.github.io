import { areaClient, invokeFunction } from "../js/client.js";
import { normalizeCim } from "../js/cim.js";
import { inspectPassword, strengthLabel } from "../js/password.js";

const supabase = areaClient();
const form = document.querySelector("#ativar-form");
const status = document.querySelector("#status");
const senha = document.querySelector("#senha");
const meter = document.querySelector("#meter-bar");
const meterLabel = document.querySelector("#meter-label");

const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  status.textContent = "Abra o convite recebido por e-mail para continuar.";
}

senha.addEventListener("input", () => {
  const check = inspectPassword(senha.value, { cim: normalizeCim(form.cim.value) });
  meter.style.width = `${check.score * 25}%`;
  meterLabel.textContent = `Força da senha: ${strengthLabel(check.score)}`;
  if (check.errors[0]) meterLabel.textContent = check.errors[0];
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const current = (await supabase.auth.getSession()).data.session;
  if (!current) {
    status.textContent = "Não foi possível concluir esta ação. Tente novamente ou fale com a Secretaria.";
    return;
  }
  const cim = normalizeCim(form.cim.value);
  const password = senha.value;
  const confirmacao = form.confirma.value;
  const { data } = await invokeFunction("ativar-conta", {
    cim,
    password,
    confirmacao,
    termos: form.termos.checked,
  }, current.access_token);
  if (!data?.ok) {
    status.textContent = data?.error || "Não foi possível concluir esta ação. Tente novamente ou fale com a Secretaria.";
    return;
  }
  status.classList.add("is-ok");
  status.textContent = "Conta ativada. Redirecionando…";
  window.location.replace("../");
});
