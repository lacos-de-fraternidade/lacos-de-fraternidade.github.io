export function normalizeCim(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidCim(value) {
  return /^[0-9]{4,12}$/.test(normalizeCim(value));
}
