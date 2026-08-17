const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOME_PATTERN = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]*[A-Za-zÀ-ÿ]$/;
const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];
const ESTADOS_CIVIS = [
  "solteiro",
  "casado",
  "divorciado",
  "viuvo",
  "uniao_estavel",
  "outro",
];
const CONJUGUE = new Set(["casado", "uniao_estavel"]);
const MAE = new Set(["solteiro", "divorciado"]);

export const IDADE_MINIMA = 21;
export const MOTIVACAO_MIN = 100;
export const MOTIVACAO_MAX = 2000;
export const LGPD_VERSAO = "2026-08-17";
export const NOME_MAX = 120;

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function collapseSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
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

export function isValidNome(value: string) {
  const nome = collapseSpaces(value);
  if (nome.length < 5 || nome.length > NOME_MAX) return false;
  if (nome.split(" ").length < 2) return false;
  if (!NOME_PATTERN.test(nome)) return false;
  if (/\d/.test(nome)) return false;
  return true;
}

export function isValidWhatsapp(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== "9") return false;
  return true;
}

export function idadeEmAnos(isoDate: string) {
  const birth = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return -1;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function str(input: Record<string, unknown>, key: string) {
  return collapseSpaces(String(input[key] ?? ""));
}

export function normalizeInteresse(input: Record<string, unknown>) {
  if (String(input.website ?? "").trim()) {
    return { errors: ["spam"], data: null, spam: true as const };
  }

  const nome = str(input, "nome");
  const dataNascimento = String(input.dataNascimento ?? "").trim();
  const cpf = onlyDigits(String(input.cpf ?? ""));
  const estadoCivil = String(input.estadoCivil ?? "").trim();
  const familiarNome = str(input, "familiarNome");
  const familiarWhatsapp = onlyDigits(String(input.familiarWhatsapp ?? ""));
  const situacaoFamiliar = str(input, "situacaoFamiliar");
  const consentimentoFamiliar = Boolean(input.consentimentoFamiliar);
  const whatsapp = onlyDigits(String(input.whatsapp ?? ""));
  const email = String(input.email ?? "").trim().toLowerCase();
  const emailConfirmacao = String(input.emailConfirmacao ?? "").trim().toLowerCase();
  const cep = onlyDigits(String(input.cep ?? ""));
  const logradouro = str(input, "logradouro");
  const numero = collapseSpaces(String(input.numero ?? ""));
  const complemento = str(input, "complemento");
  const bairro = str(input, "bairro");
  const cidade = str(input, "cidade");
  const estado = String(input.estado ?? "").trim().toUpperCase();
  const motivacao = String(input.motivacao ?? "").trim();
  const lgpdAceite = Boolean(input.lgpdAceite);
  const lgpdVersao = String(input.lgpdVersao ?? LGPD_VERSAO).trim();

  const errors: string[] = [];

  if (!isValidNome(nome)) errors.push("Informe seu nome completo.");
  if (!dataNascimento) {
    errors.push("Informe sua data de nascimento.");
  } else {
    const age = idadeEmAnos(dataNascimento);
    if (age < 0 || new Date(`${dataNascimento}T00:00:00`) > new Date()) {
      errors.push("Informe uma data de nascimento válida.");
    } else if (age < IDADE_MINIMA) {
      errors.push(`A idade mínima para manifestar interesse é ${IDADE_MINIMA} anos.`);
    }
  }

  if (!isValidCpf(cpf)) errors.push("Informe um CPF válido.");
  if (!ESTADOS_CIVIS.includes(estadoCivil)) errors.push("Selecione o estado civil.");

  let familiarPapel = "";
  if (CONJUGUE.has(estadoCivil)) {
    familiarPapel = estadoCivil === "casado" ? "esposa" : "companheira";
    if (!isValidNome(familiarNome)) {
      errors.push("Informe o nome completo da esposa ou companheira.");
    }
    if (!isValidWhatsapp(familiarWhatsapp)) {
      errors.push("Informe o WhatsApp da esposa ou companheira.");
    }
    if (!consentimentoFamiliar) {
      errors.push("Confirme a ciência sobre o consentimento da esposa ou companheira.");
    }
  } else if (MAE.has(estadoCivil)) {
    familiarPapel = "mae";
    if (!isValidNome(familiarNome)) errors.push("Informe o nome completo da mãe.");
    if (!isValidWhatsapp(familiarWhatsapp)) errors.push("Informe o WhatsApp da mãe.");
    if (!consentimentoFamiliar) {
      errors.push("Confirme a ciência sobre o consentimento da mãe.");
    }
  } else if (estadoCivil === "viuvo" || estadoCivil === "outro") {
    if (situacaoFamiliar.length < 8) {
      errors.push("Descreva brevemente sua situação familiar.");
    }
  }

  if (!isValidWhatsapp(whatsapp)) errors.push("Informe um WhatsApp com DDD.");
  if (!EMAIL_PATTERN.test(email)) errors.push("Informe um endereço de e-mail válido.");
  if (emailConfirmacao && emailConfirmacao !== email) {
    errors.push("A confirmação de e-mail não confere.");
  }
  if (cep.length !== 8) errors.push("Informe um CEP válido.");
  if (logradouro.length < 3) errors.push("Informe o logradouro.");
  if (!numero) errors.push("Informe o número ou S/N.");
  if (bairro.length < 2) errors.push("Informe o bairro.");
  if (cidade.length < 2) errors.push("Informe a cidade.");
  if (!ESTADOS.includes(estado)) errors.push("Selecione o estado.");
  if (motivacao.replace(/\s+/g, " ").length < MOTIVACAO_MIN) {
    errors.push(`Sua resposta deve possuir pelo menos ${MOTIVACAO_MIN} caracteres.`);
  }
  if (motivacao.length > MOTIVACAO_MAX) {
    errors.push(`Sua resposta deve ter no máximo ${MOTIVACAO_MAX} caracteres.`);
  }
  if (!lgpdAceite) {
    errors.push("É necessário autorizar o tratamento dos dados para continuar.");
  }

  const endereco = [logradouro, numero, complemento, bairro, cidade, estado, cep.replace(/(\d{5})(\d{3})/, "$1-$2")]
    .filter(Boolean)
    .join(", ");

  const now = new Date().toISOString();

  return {
    errors,
    spam: false as const,
    data: {
      nome,
      cpf,
      email,
      endereco,
      data_nascimento: dataNascimento || null,
      estado_civil: estadoCivil,
      familiar_nome: familiarPapel ? familiarNome : null,
      familiar_whatsapp: familiarPapel ? familiarWhatsapp : null,
      familiar_papel: familiarPapel || null,
      consentimento_familiar: familiarPapel ? consentimentoFamiliar : null,
      situacao_familiar: familiarPapel ? null : situacaoFamiliar || null,
      whatsapp,
      cep,
      logradouro,
      numero,
      complemento: complemento || null,
      bairro,
      cidade,
      estado,
      motivacao,
      lgpd_aceite: lgpdAceite,
      lgpd_versao: lgpdVersao || LGPD_VERSAO,
      lgpd_aceite_em: now,
      status: "Recebida",
    },
  };
}
