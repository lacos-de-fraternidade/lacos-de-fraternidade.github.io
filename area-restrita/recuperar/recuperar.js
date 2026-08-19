import { invokeFunction } from "../js/client.js";
import { normalizeCim } from "../js/cim.js";

const form = document.querySelector("#recuperar-form");
const status = document.querySelector("#status");
const message = "Caso exista uma conta ativa vinculada à CIM informada, enviaremos as instruções de recuperação ao e-mail cadastrado.";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await invokeFunction("recuperar-senha-cim", { cim: normalizeCim(form.cim.value) });
  status.classList.add("is-ok");
  status.textContent = message;
});
