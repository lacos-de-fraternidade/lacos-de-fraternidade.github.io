import {
  ESTADOS,
  collapseSpaces,
  idadeEmAnos,
  isValidCpf,
  isValidNome,
  isValidWhatsapp,
  normalizeInteresse,
  onlyDigits,
} from "./validation.ts";

export const DOCUMENT_TYPES = [
  "certidao_nascimento",
  "certidao_casamento",
  "identidade",
  "cpf",
  "titulo_eleitoral",
  "comprovante_rendimentos",
  "comprovante_residencia",
] as const;

export const ALLOWED_DOC_MIME = ["application/pdf", "image/jpeg", "image/png"];
export const ALLOWED_DOC_EXT = ["pdf", "jpg", "jpeg", "png"];
export const MAX_DOC_MB = 5;
export const MAX_DOC_BYTES = MAX_DOC_MB * 1024 * 1024;
export const PROPONENTE_MIN_CHARS = 4;
export const PLANO_SAUDE_AUSENTE = "nao_possui";

export type DocumentType = typeof DOCUMENT_TYPES[number];

const TIPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "nao_informado"];
const GRAUS_INSTRUCAO = [
  "fundamental",
  "medio",
  "tecnico",
  "superior",
  "pos_graduacao",
  "mestrado",
  "doutorado",
  "outro",
];

function str(input: Record<string, unknown>, key: string) {
  return collapseSpaces(String(input[key] ?? ""));
}

function boolish(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function optionalDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return raw;
}

function optionalPhone(value: unknown) {
  const digits = onlyDigits(String(value ?? ""));
  if (!digits) return null;
  return isValidWhatsapp(digits) || (digits.length >= 10 && digits.length <= 11) ? digits : undefined;
}

export function requiredCertidaoTipo(estadoCivil: string) {
  return estadoCivil === "casado" || estadoCivil === "uniao_estavel"
    ? "certidao_casamento"
    : "certidao_nascimento";
}

export function requiredDocumentTypes(estadoCivil: string) {
  return [
    requiredCertidaoTipo(estadoCivil),
    "identidade",
    "cpf",
    "titulo_eleitoral",
    "comprovante_rendimentos",
    "comprovante_residencia",
  ] as DocumentType[];
}

export function isAllowedDocumentType(value: unknown): value is DocumentType {
  return DOCUMENT_TYPES.includes(String(value || "") as DocumentType);
}

export function documentExtension(mime: string, originalName = "") {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") {
    return String(originalName).toLowerCase().endsWith(".jpg") ? "jpg" : "jpeg";
  }
  const match = String(originalName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match && ALLOWED_DOC_EXT.includes(match[1]) ? match[1] : "";
}

export function validateDocumentFile(input: {
  tipo: unknown;
  mime: string;
  size: number;
  name: string;
}) {
  if (!isAllowedDocumentType(input.tipo)) return "Tipo de documento inválido.";
  if (!ALLOWED_DOC_MIME.includes(input.mime)) return "Envie o documento em PDF, JPG ou PNG.";
  if (input.size <= 0 || input.size > MAX_DOC_BYTES) {
    return `Cada documento deve ter no máximo ${MAX_DOC_MB} MB.`;
  }
  const ext = documentExtension(input.mime, input.name);
  if (!ext) return "Extensão de arquivo não permitida.";
  return "";
}

function normalizeFilhos(value: unknown, required: boolean, errors: string[]) {
  if (!required) return [];
  if (!Array.isArray(value) || value.length < 1) {
    errors.push("Informe os dados de pelo menos um filho.");
    return [];
  }
  if (value.length > 20) errors.push("Informe no máximo 20 filhos.");
  return value.slice(0, 20).map((item, index) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const nome = str(row, "nome");
    const sexo = String(row.sexo || "");
    const dataNascimento = optionalDate(row.dataNascimento || row.data_nascimento);
    if (!isValidNome(nome)) errors.push(`Informe o nome completo do filho ${index + 1}.`);
    if (sexo !== "masculino" && sexo !== "feminino") errors.push(`Informe o sexo do filho ${index + 1}.`);
    if (dataNascimento === undefined || !dataNascimento) {
      errors.push(`Informe a data de nascimento do filho ${index + 1}.`);
    }
    return {
      nome,
      sexo,
      data_nascimento: dataNascimento || null,
      ordem: index + 1,
    };
  }).filter((row) => row.nome && row.sexo && row.data_nascimento);
}

function normalizeReferencias(value: unknown, errors: string[]) {
  if (!Array.isArray(value) || value.length !== 3) {
    errors.push("Informe as 3 referências pessoais.");
    return [];
  }
  return value.map((item, index) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const nome = str(row, "nome");
    const telefone = onlyDigits(String(row.telefone ?? ""));
    if (!isValidNome(nome)) errors.push(`Informe o nome da referência ${index + 1}.`);
    if (!isValidWhatsapp(telefone) && telefone.length < 10) {
      errors.push(`Informe o telefone da referência ${index + 1}.`);
    }
    const estado = String(row.estado || "").trim().toUpperCase();
    return {
      ordem: index + 1,
      nome,
      telefone,
      logradouro: str(row, "logradouro") || null,
      bairro: str(row, "bairro") || null,
      cidade: str(row, "cidade") || null,
      estado: ESTADOS.includes(estado) ? estado : null,
      cep: onlyDigits(String(row.cep ?? "")) || null,
    };
  });
}

export function normalizeCandidatura(input: Record<string, unknown>) {
  const base = normalizeInteresse(input);
  if (base.spam) return base;
  const errors = [...base.errors];
  if (!base.data) return { ...base, errors };

  const proponenteId = String(input.proponente_id || input.proponenteId || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proponenteId)) {
    errors.push("Selecione o Irmão que o convidou a ser iniciado.");
  }

  const rg = str(input, "rg");
  const rgOrgao = str(input, "rgOrgao") || str(input, "rg_orgao");
  const rgExpedicao = optionalDate(input.rgExpedicao || input.rg_expedicao);
  if (rg.length < 4) errors.push("Informe o RG.");
  if (rgOrgao.length < 2) errors.push("Informe o órgão expedidor do RG.");
  if (rgExpedicao === undefined) errors.push("Informe a data de expedição do RG.");
  else if (!rgExpedicao) errors.push("Informe a data de expedição do RG.");

  const nomeMae = str(input, "nomeMae") || str(input, "nome_mae");
  const nomePai = str(input, "nomePai") || str(input, "nome_pai");
  if (!isValidNome(nomeMae)) errors.push("Informe o nome completo da mãe.");
  if (nomePai && !isValidNome(nomePai)) errors.push("Informe um nome válido para o pai.");

  const naturalidade = str(input, "naturalidade");
  const nacionalidade = str(input, "nacionalidade") || "Brasileira";
  const ufNascimento = String(input.ufNascimento || input.uf_nascimento || "").trim().toUpperCase();
  if (naturalidade.length < 2) errors.push("Informe a naturalidade.");
  if (nacionalidade.length < 3) errors.push("Informe a nacionalidade.");
  if (!ESTADOS.includes(ufNascimento)) errors.push("Informe a UF de nascimento.");

  const telefoneEmergencia = optionalPhone(input.telefoneEmergencia || input.telefone_emergencia);
  if (telefoneEmergencia === undefined) errors.push("Informe um telefone de emergência válido.");
  else if (!telefoneEmergencia) errors.push("Informe o telefone de emergência.");

  const planoInformado = str(input, "planoSaude") || str(input, "plano_saude");
  const semPlano = boolish(input.naoPossuiPlanoSaude || input.nao_possui_plano_saude)
    || planoInformado === PLANO_SAUDE_AUSENTE;
  const planoSaude = semPlano ? PLANO_SAUDE_AUSENTE : planoInformado;
  const tipoSanguineo = String(input.tipoSanguineo || input.tipo_sanguineo || "nao_informado");
  const tratamentoSaude = str(input, "tratamentoSaude") || str(input, "tratamento_saude");
  if (!semPlano && planoSaude.length < 2) errors.push("Informe o plano de saúde.");
  if (!TIPOS_SANGUINEOS.includes(tipoSanguineo)) errors.push("Selecione o tipo sanguíneo.");

  const pais = str(input, "pais") || "Brasil";
  const tempoResidencia = str(input, "tempoResidencia") || str(input, "tempo_residencia");
  if (tempoResidencia.length < 2) errors.push("Informe o tempo de residência no endereço.");

  const conjuge = base.data.estado_civil === "casado" || base.data.estado_civil === "uniao_estavel";
  const dataCasamento = optionalDate(input.dataCasamento || input.data_casamento);
  const esposaNascimento = optionalDate(input.esposaNascimento || input.esposa_nascimento);
  if (conjuge) {
    if (dataCasamento === undefined || !dataCasamento) errors.push("Informe a data de casamento.");
    if (esposaNascimento === undefined || !esposaNascimento) {
      errors.push("Informe a data de nascimento da esposa ou companheira.");
    }
  }

  const possuiFilhos = boolish(input.possuiFilhos || input.possui_filhos);
  const filhos = normalizeFilhos(input.filhos, possuiFilhos, errors);

  const grauInstrucao = String(input.grauInstrucao || input.grau_instrucao || "");
  const formacao = str(input, "formacao");
  if (!GRAUS_INSTRUCAO.includes(grauInstrucao)) errors.push("Selecione o grau de instrução.");
  if (formacao.length < 2) errors.push("Informe a formação.");

  const profissao = str(input, "profissao");
  // V1 pública: um único campo "Profissão". ocupacao permanece no banco e é copiada da profissão.
  const ocupacao = str(input, "ocupacao") || profissao;
  const rendaMensal = str(input, "rendaMensal") || str(input, "renda_mensal");
  const rendaFamiliar = str(input, "rendaFamiliar") || str(input, "renda_familiar");
  const empresa = str(input, "empresa");
  const cargoEmpresa = str(input, "cargoEmpresa") || str(input, "cargo_empresa");
  if (profissao.length < 2) errors.push("Informe a profissão.");
  if (rendaMensal.length < 1) errors.push("Informe a renda mensal.");
  if (rendaFamiliar.length < 1) errors.push("Informe a renda familiar.");
  if (empresa.length < 2) errors.push("Informe a empresa.");
  if (cargoEmpresa.length < 2) errors.push("Informe o cargo na empresa.");

  const empresaCep = onlyDigits(String(input.empresaCep || input.empresa_cep || ""));
  const empresaCidade = str(input, "empresaCidade") || str(input, "empresa_cidade");
  const empresaEstado = String(input.empresaEstado || input.empresa_estado || "").trim().toUpperCase();
  if (empresaCep && empresaCep.length !== 8) errors.push("Informe um CEP profissional válido.");
  if (empresaEstado && !ESTADOS.includes(empresaEstado)) errors.push("Informe a UF profissional.");

  const foiMilitar = boolish(input.foiMilitar || input.foi_militar);
  const patenteMilitar = str(input, "patenteMilitar") || str(input, "patente_militar");
  const localMilitar = str(input, "localMilitar") || str(input, "local_militar");
  if (foiMilitar) {
    if (patenteMilitar.length < 2) errors.push("Informe a patente ou graduação militar.");
    if (localMilitar.length < 2) errors.push("Informe o local ou organização militar.");
  }

  const referencias = normalizeReferencias(input.referencias, errors);
  const comercialRaw = input.referenciaComercial && typeof input.referenciaComercial === "object"
    ? input.referenciaComercial as Record<string, unknown>
    : {};
  const comercialNome = str(comercialRaw, "razaoSocial") || str(comercialRaw, "nome") || str(input, "referenciaComercialNome");
  if (comercialNome.length < 3) {
    errors.push("Informe a referência comercial ou bancária.");
  }

  const processoCriminal = boolish(input.processoCriminal || input.processo_criminal);
  const processoDetalhe = str(input, "processoCriminalDetalhe") || str(input, "processo_criminal_detalhe");
  if (processoCriminal && processoDetalhe.length < 8) {
    errors.push("Descreva o processo criminal informado.");
  }
  const filiacaoPartidaria = boolish(input.filiacaoPartidaria || input.filiacao_partidaria);
  const partido = str(input, "partido");
  if (filiacaoPartidaria && partido.length < 2) errors.push("Informe o partido político.");

  return {
    errors,
    spam: false as const,
    data: errors.length ? null : {
      ...base.data,
      pais,
      tempo_residencia: tempoResidencia,
      proponente_id: proponenteId,
      rg,
      rg_orgao: rgOrgao,
      rg_expedicao: rgExpedicao,
      nome_mae: nomeMae,
      nome_pai: nomePai || null,
      naturalidade,
      nacionalidade,
      uf_nascimento: ufNascimento,
      data_casamento: conjuge ? dataCasamento : null,
      esposa_nascimento: conjuge ? esposaNascimento : null,
      telefone_emergencia: telefoneEmergencia,
      plano_saude: planoSaude,
      tipo_sanguineo: tipoSanguineo,
      tratamento_saude: tratamentoSaude || null,
      grau_instrucao: grauInstrucao,
      formacao,
      especializacao: str(input, "especializacao") || null,
      profissao,
      ocupacao,
      especialidade_profissional: str(input, "especialidadeProfissional") || str(input, "especialidade_profissional") || null,
      renda_mensal: rendaMensal,
      renda_familiar: rendaFamiliar,
      empresa,
      cargo_empresa: cargoEmpresa,
      data_admissao_empresa: optionalDate(input.dataAdmissaoEmpresa || input.data_admissao_empresa) || null,
      empresa_logradouro: str(input, "empresaLogradouro") || str(input, "empresa_logradouro") || null,
      empresa_numero: str(input, "empresaNumero") || str(input, "empresa_numero") || null,
      empresa_bairro: str(input, "empresaBairro") || str(input, "empresa_bairro") || null,
      empresa_cep: empresaCep || null,
      empresa_cidade: empresaCidade || null,
      empresa_estado: ESTADOS.includes(empresaEstado) ? empresaEstado : null,
      empresa_pais: str(input, "empresaPais") || str(input, "empresa_pais") || "Brasil",
      empresa_telefone: onlyDigits(String(input.empresaTelefone || input.empresa_telefone || "")) || null,
      empresa_ramal: str(input, "empresaRamal") || str(input, "empresa_ramal") || null,
      foi_militar: foiMilitar,
      patente_militar: foiMilitar ? patenteMilitar : null,
      local_militar: foiMilitar ? localMilitar : null,
      possui_filhos: possuiFilhos,
      entidades: str(input, "entidades") || null,
      processo_criminal: processoCriminal,
      processo_criminal_detalhe: processoCriminal ? processoDetalhe : null,
      filiacao_partidaria: filiacaoPartidaria,
      partido: filiacaoPartidaria ? partido : null,
      outras_informacoes: str(input, "outrasInformacoes") || str(input, "outras_informacoes") || null,
      documentacao_completa: false,
      status: "Aguardando_documentos",
      filhos,
      referencias,
      referencia_comercial: {
        razao_social: comercialNome,
        telefone: onlyDigits(String(comercialRaw.telefone || input.referenciaComercialTelefone || "")) || null,
        logradouro: str(comercialRaw, "logradouro") || null,
        bairro: str(comercialRaw, "bairro") || null,
        cidade: str(comercialRaw, "cidade") || null,
        estado: ESTADOS.includes(String(comercialRaw.estado || "").toUpperCase())
          ? String(comercialRaw.estado).toUpperCase()
          : null,
        cep: onlyDigits(String(comercialRaw.cep || "")) || null,
      },
    },
  };
}

export { idadeEmAnos };
