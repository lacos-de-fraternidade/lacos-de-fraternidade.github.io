const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function normalizeInteresse(input: Record<string, unknown>) {
  const nome = String(input.nome ?? "").trim().replace(/\s+/g, " ");
  const email = String(input.email ?? "").trim().toLowerCase();
  const endereco = String(input.endereco ?? "").trim().replace(/\s+/g, " ");
  const cpf = onlyDigits(String(input.cpf ?? ""));
  const consentimento = Boolean(input.consentimento);

  const errors: string[] = [];

  if (nome.length < 5 || nome.split(" ").length < 2) {
    errors.push("Informe seu nome completo.");
  }

  if (!isValidCpf(cpf)) {
    errors.push("Informe um CPF válido.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    errors.push("Informe um endereço de e-mail válido.");
  }

  if (endereco.length < 8) {
    errors.push("Informe um endereço mais completo.");
  }

  if (!consentimento) {
    errors.push("É necessário autorizar o registro dos dados.");
  }

  return {
    errors,
    data: { nome, cpf, email, endereco },
  };
}
