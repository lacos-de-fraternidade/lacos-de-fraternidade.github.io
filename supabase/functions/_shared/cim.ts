export function normalizeCim(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidCim(value: unknown) {
  return /^[0-9]{4,12}$/.test(normalizeCim(value));
}

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}
