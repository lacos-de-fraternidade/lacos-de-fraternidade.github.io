import { areaClient, invokeFunction } from "../js/client.js";
import { isValidCim, normalizeCim } from "../js/cim.js";

const form = document.querySelector("#login-form");
const status = document.querySelector("#status");
const toggle = document.querySelector("#toggle-senha");
const senha = document.querySelector("#senha");

toggle.addEventListener("click", () => {
  const hidden = senha.type === "password";
  senha.type = hidden ? "text" : "password";
  toggle.textContent = hidden ? "Ocultar" : "Mostrar";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  const cim = normalizeCim(form.cim.value);
  const password = senha.value;
  if (!isValidCim(cim) || !password) {
    status.textContent = "CIM ou senha inválida.";
    return;
  }
  const { data } = await invokeFunction("login-with-cim", { cim, password });
  if (!data?.ok || !data.session) {
    status.textContent = data?.error || "CIM ou senha inválida.";
    return;
  }
  const supabase = areaClient();
  const { error } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (error) {
    status.textContent = "CIM ou senha inválida.";
    return;
  }
  window.location.replace("../");
});
