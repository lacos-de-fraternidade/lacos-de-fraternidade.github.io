/** Constrói o dossiê da Secretaria e o aviso mínimo do proponente. Sem I/O. */

export const DOC_SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DOC_SIGNED_URL_TTL_LABEL = "7 dias";

export const DOCUMENT_LABELS = {
  certidao_nascimento: "Certidão de nascimento",
  certidao_casamento: "Certidão de casamento",
  identidade: "Documento de identidade",
  cpf: "CPF",
  titulo_eleitoral: "Título de eleitor",
  comprovante_rendimentos: "Comprovante de rendimentos",
  comprovante_residencia: "Comprovante de residência",
};

const GRAU_LABELS = {
  fundamental: "Fundamental",
  medio: "Médio",
  tecnico: "Técnico",
  superior: "Superior",
  pos_graduacao: "Pós-graduação",
  mestrado: "Mestrado",
  doutorado: "Doutorado",
  outro: "Outro",
};

const ESTADO_CIVIL_LABELS = {
  solteiro: "Solteiro",
  casado: "Casado",
  divorciado: "Divorciado",
  viuvo: "Viúvo",
  uniao_estavel: "União estável",
  outro: "Outro",
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) return String(value || "—");
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return String(value || "—");
}

export function formatCep(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 8) return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
  return String(value || "—");
}

export function formatDate(value) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const [year, month, day] = raw.split("-");
  if (!day) return String(value);
  return `${day}/${month}/${year}`;
}

function display(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function yesNo(value) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "—";
}

function familiarPapelLabel(papel) {
  if (papel === "esposa") return "Esposa";
  if (papel === "companheira") return "Companheira";
  if (papel === "mae") return "Mãe";
  return "Familiar";
}

function grauLabel(value) {
  return GRAU_LABELS[String(value || "")] || display(value);
}

function estadoCivilLabel(value) {
  return ESTADO_CIVIL_LABELS[String(value || "")] || display(value);
}

function sexoLabel(value) {
  if (value === "masculino") return "Masculino";
  if (value === "feminino") return "Feminino";
  return display(value);
}

function documentLabel(tipo) {
  return DOCUMENT_LABELS[tipo] || display(tipo);
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;color:#5f6d80;width:190px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;color:#132033;font-weight:700;">${escapeHtml(value || "—")}</td>
  </tr>`;
}

function section(title, body) {
  return `<h2 style="font-size:16px;color:#123a74;margin:24px 0 8px;">${escapeHtml(title)}</h2>${body}`;
}

function table(rows) {
  return `<table width="100%" cellspacing="0" cellpadding="0">${rows}</table>`;
}

function isConjuge(estadoCivil) {
  return estadoCivil === "casado" || estadoCivil === "uniao_estavel";
}

function isMaeConsentimento(estadoCivil) {
  return estadoCivil === "solteiro" || estadoCivil === "divorciado";
}

function enderecoLinha(item) {
  const parts = [
    display(item.logradouro) !== "—" ? item.logradouro : "",
    item.bairro,
    item.cidade && item.estado ? `${item.cidade}/${item.estado}` : (item.cidade || item.estado),
    item.cep ? formatCep(item.cep) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function buildSecretarioDossie(input) {
  const data = input?.interesse || {};
  const filhos = Array.isArray(input?.filhos) ? input.filhos : [];
  const referencias = Array.isArray(input?.referencias) ? [...input.referencias] : [];
  referencias.sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
  const comercial = input?.comercial || null;
  const documentos = Array.isArray(input?.documentos) ? input.documentos : [];
  const proponenteNome = display(input?.proponenteNome);
  const when = input?.recebidoEm || "";
  const estadoCivil = String(data.estado_civil || "");

  const innerParts = [
    `<p style="margin:0 0 18px;color:#44536a;">Um Cadastro do candidato foi concluído e está pronto para conferência da Secretaria.</p>`,
    when ? `<p style="margin:0 0 18px;"><strong>Recebido em:</strong> ${escapeHtml(when)}</p>` : "",
    section("Dados do candidato", table([
      row("Protocolo", display(data.id)),
      row("Nome", display(data.nome)),
      row("Nascimento", formatDate(data.data_nascimento)),
      row("Naturalidade", display(data.naturalidade)),
      row("UF de nascimento", display(data.uf_nascimento)),
      row("Nacionalidade", display(data.nacionalidade)),
      row("Nome da mãe", display(data.nome_mae)),
      row("Nome do pai", display(data.nome_pai)),
      row("WhatsApp", formatPhone(data.whatsapp)),
      row("E-mail", display(data.email)),
      row("Telefone de emergência", formatPhone(data.telefone_emergencia)),
    ].join(""))),
    section("Endereço", table([
      row("CEP", formatCep(data.cep)),
      row("Logradouro", display(data.logradouro)),
      row("Número", display(data.numero)),
      row("Complemento", display(data.complemento)),
      row("Bairro", display(data.bairro)),
      row("Cidade/UF", data.cidade || data.estado ? `${display(data.cidade)}/${display(data.estado)}` : "—"),
      row("País", display(data.pais)),
      row("Tempo de residência", display(data.tempo_residencia)),
    ].join(""))),
  ];

  const familiaRows = [row("Estado civil", estadoCivilLabel(estadoCivil))];
  if (isConjuge(estadoCivil)) {
    familiaRows.push(
      row(familiarPapelLabel(data.familiar_papel), display(data.familiar_nome)),
      row("WhatsApp da esposa ou companheira", formatPhone(data.familiar_whatsapp)),
      row("Ciência do consentimento familiar", yesNo(data.consentimento_familiar)),
    );
  } else if (isMaeConsentimento(estadoCivil)) {
    familiaRows.push(
      row("Nome da mãe (consentimento)", display(data.familiar_nome)),
      row("WhatsApp da mãe", formatPhone(data.familiar_whatsapp)),
      row("Ciência do consentimento familiar", yesNo(data.consentimento_familiar)),
    );
  } else if (estadoCivil === "viuvo" || estadoCivil === "outro") {
    familiaRows.push(row("Situação familiar", display(data.situacao_familiar)));
  }
  familiaRows.push(row("Possui filhos", yesNo(data.possui_filhos)));
  if (data.possui_filhos && filhos.length) {
    filhos.forEach((filho) => {
      familiaRows.push(row("Nome", display(filho.nome)));
    });
  }
  innerParts.push(section("Informações familiares", table(familiaRows.join(""))));

  const profissionalRows = [
    row("Grau de instrução", grauLabel(data.grau_instrucao)),
    row("Formação", display(data.formacao)),
    row("Especialização", display(data.especializacao)),
    row("Profissão", display(data.profissao)),
    row("Especialidade profissional", display(data.especialidade_profissional)),
    row("Empresa", display(data.empresa)),
    row("Cargo ou função", display(data.cargo_empresa)),
    row("Data de admissão", formatDate(data.data_admissao_empresa)),
    row("Endereço profissional", display(data.empresa_logradouro)),
    row("Número profissional", display(data.empresa_numero)),
    row("Bairro profissional", display(data.empresa_bairro)),
    row("CEP profissional", data.empresa_cep ? formatCep(data.empresa_cep) : "—"),
    row("Cidade profissional", display(data.empresa_cidade)),
    row("UF profissional", display(data.empresa_estado)),
    row("País profissional", display(data.empresa_pais)),
    row("Telefone profissional", data.empresa_telefone ? formatPhone(data.empresa_telefone) : "—"),
    row("Ramal", display(data.empresa_ramal)),
    row("Outras informações", display(data.outras_informacoes)),
  ];
  innerParts.push(section("Informações profissionais e outras informações", table(profissionalRows.join(""))));

  innerParts.push(section("Proponente", table(row("Irmão que o convidou a ser iniciado", proponenteNome))));

  const refBlocks = referencias.length
    ? referencias.map((item, index) => {
      const n = item.ordem || index + 1;
      return `<h3 style="font-size:14px;color:#123a74;margin:16px 0 8px;">Referência pessoal ${n}</h3>` + table([
        row("Nome", display(item.nome)),
        row("Telefone", formatPhone(item.telefone)),
        row("Logradouro", display(item.logradouro)),
        row("Bairro", display(item.bairro)),
        row("Cidade", display(item.cidade)),
        row("Estado", display(item.estado)),
        row("CEP", item.cep ? formatCep(item.cep) : "—"),
      ].join(""));
    }).join("")
    : `<p style="margin:0;color:#44536a;">Nenhuma referência pessoal registrada nesta candidatura.</p>`;
  innerParts.push(section("Referências pessoais", refBlocks));

  if (comercial && String(comercial.razao_social || "").trim()) {
    innerParts.push(section("Referência comercial", table([
      row("Razão social ou nome", display(comercial.razao_social)),
      row("Telefone", comercial.telefone ? formatPhone(comercial.telefone) : "—"),
      row("Logradouro", display(comercial.logradouro)),
      row("Bairro", display(comercial.bairro)),
      row("Cidade", display(comercial.cidade)),
      row("Estado", display(comercial.estado)),
      row("CEP", comercial.cep ? formatCep(comercial.cep) : "—"),
    ].join(""))));
  } else {
    innerParts.push(section("Referência comercial", `<p style="margin:0;color:#44536a;">Não informada nesta candidatura.</p>`));
  }

  const docBlocks = documentos.length
    ? documentos.map((doc) => {
      const label = documentLabel(doc.tipo);
      const link = doc.url
        ? `<a href="${escapeHtml(doc.url)}" download style="color:#123a74;font-weight:700;">Baixar documento</a> <span style="color:#5f6d80;font-weight:400;">(acesso temporário, ${DOC_SIGNED_URL_TTL_LABEL})</span>`
        : `<span style="color:#5f6d80;">Recebido. Link temporário indisponível — solicite à equipe técnica pelo protocolo.</span>`;
      return `<p style="margin:0 0 10px;color:#132033;"><strong>${escapeHtml(label)}</strong> — recebido<br />${link}</p>`;
    }).join("")
    : `<p style="margin:0;color:#44536a;">Nenhum documento listado nesta candidatura.</p>`;
  innerParts.push(section("Documentação", `
    <p style="margin:0 0 12px;color:#44536a;">Os arquivos permanecem no bucket privado. Os links abaixo expiram em ${escapeHtml(DOC_SIGNED_URL_TTL_LABEL)}.</p>
    ${docBlocks}
  `));

  innerParts.push(section("Motivação", `<p style="white-space:pre-wrap;background:#f6f9fc;border-radius:12px;padding:16px;color:#24364d;">${escapeHtml(display(data.motivacao))}</p>`));
  innerParts.push(`<p style="margin:24px 0 0;font-size:13px;color:#5f6d80;">Status: ${escapeHtml(display(data.status))} · Versão LGPD: ${escapeHtml(display(data.lgpd_versao))} · Documentação completa: ${escapeHtml(yesNo(data.documentacao_completa))}</p>`);

  const textLines = [
    "Cadastro do candidato",
    when ? `Recebido em: ${when}` : "",
    `Protocolo: ${display(data.id)}`,
    `Nome: ${display(data.nome)}`,
    `WhatsApp: ${formatPhone(data.whatsapp)}`,
    `E-mail: ${display(data.email)}`,
    `Proponente: ${proponenteNome}`,
    "",
    "Referências pessoais:",
    ...(referencias.length
      ? referencias.map((item, index) => {
        const n = item.ordem || index + 1;
        return `- ${n}. ${display(item.nome)} · ${formatPhone(item.telefone)} · ${enderecoLinha(item)}`;
      })
      : ["- Nenhuma referência pessoal registrada nesta candidatura."]),
    "",
    comercial && String(comercial.razao_social || "").trim()
      ? `Referência comercial: ${display(comercial.razao_social)} · ${comercial.telefone ? formatPhone(comercial.telefone) : "—"}`
      : "Referência comercial: não informada nesta candidatura.",
    "",
    "Documentos:",
    ...(documentos.length
      ? documentos.map((doc) => `- ${documentLabel(doc.tipo)}: recebido${doc.url ? ` · ${doc.url}` : ""}`)
      : ["- Nenhum documento listado nesta candidatura."]),
    "",
    "Motivação:",
    display(data.motivacao),
  ].filter((line, index, all) => !(line === "" && all[index - 1] === ""));

  return {
    subject: `Cadastro do candidato — ${display(data.nome)}`,
    title: "Cadastro do candidato",
    inner: innerParts.join(""),
    text: textLines.join("\n"),
  };
}

function filled(value) {
  return String(value ?? "").trim() !== "";
}

function flag(ok, aplicavel = true) {
  if (!aplicavel) return "NÃO APLICÁVEL";
  return ok ? "OK" : "AUSENTE";
}

export function inspectDossieCompleteness(input) {
  const data = input?.interesse || {};
  const filhos = Array.isArray(input?.filhos) ? input.filhos : [];
  const referencias = Array.isArray(input?.referencias) ? input.referencias : [];
  const comercial = input?.comercial || null;
  const documentos = Array.isArray(input?.documentos) ? input.documentos : [];
  const estadoCivil = String(data.estado_civil || "");
  const refsValidas = referencias.filter((item) => filled(item?.nome) && filled(item?.telefone));
  const familiaOk = isConjuge(estadoCivil)
    ? filled(data.familiar_nome) && Boolean(data.data_casamento)
    : isMaeConsentimento(estadoCivil)
      ? filled(data.familiar_nome)
      : estadoCivil === "viuvo" || estadoCivil === "outro"
        ? filled(data.situacao_familiar)
        : false;
  const dadosOk = [
    data.id, data.nome, data.cpf, data.rg, data.rg_orgao, data.rg_expedicao,
    data.nome_mae, data.naturalidade, data.nacionalidade, data.whatsapp, data.email,
    data.logradouro, data.cep, data.tempo_residencia, data.motivacao,
  ].every(filled);
  const profissionalOk = [data.grau_instrucao, data.formacao, data.profissao, data.empresa, data.cargo_empresa].every(filled);
  const proponenteOk = filled(input?.proponenteNome);
  const filhosOk = data.possui_filhos === true ? filhos.length > 0 : data.possui_filhos === false;
  const comercialOk = Boolean(comercial && filled(comercial.razao_social));
  const docsOk = documentos.length > 0 && documentos.every((doc) => filled(doc?.tipo));
  const ausencias = [
    dadosOk, familiaOk, filhosOk, profissionalOk, proponenteOk, refsValidas.length === 3, docsOk,
  ].filter((item) => !item).length;

  return {
    dados_principais: flag(dadosOk),
    familia: flag(familiaOk, Boolean(estadoCivil)),
    filhos: flag(filhosOk, data.possui_filhos !== false),
    profissional: flag(profissionalOk),
    proponente: flag(proponenteOk),
    referencias: flag(refsValidas.length === 3),
    comercial: comercialOk ? "OK" : "NÃO APLICÁVEL",
    documentos: flag(docsOk),
    n_docs: documentos.length,
    tipos_documentos: documentos.map((doc) => String(doc?.tipo || "")).filter(Boolean).sort(),
    reconstruivel: ausencias === 0 ? "COMPLETA" : dadosOk && docsOk ? "PARCIAL" : "NÃO RECONSTRUÍVEL",
  };
}

const DOWNLOAD_EXT = ["pdf", "jpg", "jpeg", "png"];

export function documentoDownloadName(tipo, nomeOriginal = "", storagePath = "") {
  const fromOriginal = String(nomeOriginal || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  const fromPath = String(storagePath || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = (fromOriginal && DOWNLOAD_EXT.includes(fromOriginal[1]) && fromOriginal[1])
    || (fromPath && DOWNLOAD_EXT.includes(fromPath[1]) && fromPath[1])
    || "bin";
  const slug = DOCUMENT_LABELS[tipo] ? String(tipo).replaceAll("_", "-") : "documento";
  return `${slug}.${ext}`;
}

export function pickProponenteEmail(input) {
  const authEmail = String(input?.authEmail || "").trim();
  const vinculoEmail = String(input?.vinculoEmail || "").trim();
  const irmaoEmail = String(input?.irmaoEmail || "").trim();
  if (authEmail) return { email: authEmail, source: "irmaos_autorizados" };
  if (vinculoEmail) return { email: vinculoEmail, source: "irmaos_autorizados" };
  if (irmaoEmail) return { email: irmaoEmail, source: "irmaos" };
  return { email: "", source: "ausente" };
}

export function finishProponenteResolution(found, laterError) {
  if (found?.email) return { ok: true, email: found.email, source: found.source };
  if (laterError) return { ok: false, email: "", source: "erro_consulta" };
  return { ok: true, email: "", source: "ausente" };
}

export function resolveProponenteFromLookups({ auth, vinculo, irmaoEmail } = {}) {
  if (auth?.error) return finishProponenteResolution({ email: "", source: "ausente" }, true);
  const first = pickProponenteEmail({
    authEmail: auth?.email || "",
    vinculoEmail: "",
    irmaoEmail: "",
  });
  if (first.email) return finishProponenteResolution(first, false);
  if (vinculo?.error) {
    return finishProponenteResolution(pickProponenteEmail({
      authEmail: "",
      vinculoEmail: "",
      irmaoEmail,
    }), true);
  }
  return finishProponenteResolution(pickProponenteEmail({
    authEmail: auth?.email || "",
    vinculoEmail: vinculo?.email || "",
    irmaoEmail,
  }), false);
}

export function isSuccessfulEmailStatus(status) {
  return Number(status) >= 200 && Number(status) < 300;
}

export function buildProponenteAviso(input) {
  const candidatoNome = display(input?.candidatoNome);
  const proponenteNome = display(input?.proponenteNome) === "—" ? "Irmão" : display(input?.proponenteNome);
  return {
    subject: `Candidato identificou você como proponente — ${candidatoNome}`,
    title: "Identificação de proponente",
    inner: `
    <p style="margin:0 0 18px;color:#44536a;">Prezado ${escapeHtml(proponenteNome)},</p>
    <p style="margin:0 0 18px;color:#44536a;">
      <strong>${escapeHtml(candidatoNome)}</strong> identificou você como o Irmão que o convidou
      a ser iniciado e, portanto, como seu proponente neste Cadastro do candidato.
    </p>
    <p style="margin:0;color:#5f6d80;font-size:13px;">A Secretaria da Loja também foi notificada. Este aviso não representa aprovação.</p>
  `,
    text: [
      `Prezado ${proponenteNome},`,
      `${candidatoNome} identificou você como o Irmão que o convidou a ser iniciado / seu proponente.`,
      "A Secretaria da Loja também foi notificada. Este aviso não representa aprovação.",
    ].join("\n"),
  };
}
