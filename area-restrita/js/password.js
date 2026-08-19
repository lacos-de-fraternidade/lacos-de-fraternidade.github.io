const COMMON = new Set([
  "password123", "password1234", "senha12345", "senha123456", "1234567890",
  "123456789a", "qwerty1234", "admin12345", "welcome123", "abc1234567",
  "iloveyou12", "maconaria1", "fraternidade1", "lacos12345",
]);

export function inspectPassword(password, extras = {}) {
  const errors = [];
  const value = String(password ?? "");
  if (value.length < 10) errors.push("Use pelo menos 10 caracteres.");
  if (!/[A-ZÀ-Ü]/.test(value)) errors.push("Inclua ao menos uma letra maiúscula.");
  if (!/[a-zà-ü]/.test(value)) errors.push("Inclua ao menos uma letra minúscula.");
  if (!/[0-9]/.test(value)) errors.push("Inclua ao menos um número.");
  if (!/[^A-Za-z0-9À-ü]/.test(value)) errors.push("Inclua ao menos um caractere especial.");
  if (COMMON.has(value.toLowerCase())) errors.push("Esta senha é excessivamente comum.");
  if (extras.cim && value.includes(extras.cim)) errors.push("A senha não pode conter a CIM.");
  if (extras.email && value.toLowerCase().includes(String(extras.email).toLowerCase())) {
    errors.push("A senha não pode conter o e-mail.");
  }
  let score = 0;
  if (value.length >= 10) score += 1;
  if (value.length >= 14) score += 1;
  if (/[A-ZÀ-Ü]/.test(value) && /[a-zà-ü]/.test(value)) score += 1;
  if (/[0-9]/.test(value) && /[^A-Za-z0-9À-ü]/.test(value)) score += 1;
  if (!errors.length) score = Math.max(score, 3);
  return { ok: errors.length === 0, score: Math.min(score, 4), errors };
}

export function strengthLabel(score) {
  return ["Muito fraca", "Fraca", "Razoável", "Forte", "Excelente"][score] || "Muito fraca";
}
