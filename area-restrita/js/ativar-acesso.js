import { isValidCim, normalizeCim } from "./cim.js";
import { inspectPassword } from "./password.js";

export const GENERIC_ACTIVATE_ERROR = "Não foi possível concluir a ativação. Verifique os dados informados ou solicite um novo convite à Secretaria.";

export const ACTIVATE_SUCCESS_TOAST = "Conta ativada com sucesso.";

export function sanitizeCimInput(value) {
  return normalizeCim(value).slice(0, 12);
}

export function localActivateMessage({ password = "", confirmacao = "", termos = false } = {}) {
  if (password && confirmacao && password !== confirmacao) return "As senhas não coincidem.";
  if (password && !inspectPassword(password).ok) return "A senha ainda não atende aos requisitos mínimos.";
  if (password && confirmacao && inspectPassword(password).ok && password === confirmacao && !termos) {
    return "Aceite os termos de uso para continuar.";
  }
  return "";
}

export function canSubmitActivation({
  cim = "",
  password = "",
  confirmacao = "",
  termos = false,
  session = null,
} = {}) {
  const normalized = normalizeCim(cim);
  return Boolean(
    session
    && isValidCim(normalized)
    && inspectPassword(password).ok
    && password === confirmacao
    && termos,
  );
}

export function mapActivateError(error) {
  const text = String(error || "");
  if (!text) return GENERIC_ACTIVATE_ERROR;
  if (/senhas não coincidem|requisitos mínimos|termos de uso/i.test(text)) return text;
  return GENERIC_ACTIVATE_ERROR;
}
