import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOC_SIGNED_URL_TTL_SECONDS,
  buildProponenteAviso,
  buildSecretarioDossie,
  documentoDownloadName,
  inspectDossieCompleteness,
  isSuccessfulEmailStatus,
  pickProponenteEmail,
  resolveProponenteFromLookups,
} from "../supabase/functions/_shared/email-dossie.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

function candidato(overrides = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    nome: "Candidato Alfa Silva",
    cpf: "39053344705",
    email: "alfa@invalid.test",
    endereco: "Rua Alfa, 1",
    data_nascimento: "1990-01-02",
    estado_civil: "casado",
    familiar_nome: "Ana Alfa Souza",
    familiar_whatsapp: "21988880001",
    familiar_papel: "esposa",
    consentimento_familiar: true,
    situacao_familiar: null,
    whatsapp: "21988880000",
    cep: "25070000",
    logradouro: "Rua Alfa",
    numero: "10",
    complemento: "Casa",
    bairro: "Centro",
    cidade: "Duque de Caxias",
    estado: "RJ",
    pais: "Brasil",
    tempo_residencia: "5 anos",
    rg: "1234567",
    rg_orgao: "IFP-RJ",
    rg_expedicao: "2010-10-10",
    nome_mae: "Maria Alfa Silva",
    nome_pai: "Jose Alfa Silva",
    naturalidade: "Duque de Caxias",
    nacionalidade: "Brasileira",
    uf_nascimento: "RJ",
    data_casamento: "2015-06-01",
    esposa_nascimento: "1991-03-04",
    telefone_emergencia: "21988880002",
    plano_saude: "Amil",
    tipo_sanguineo: "O+",
    tratamento_saude: null,
    grau_instrucao: "superior",
    formacao: "Administracao",
    especializacao: null,
    profissao: "Analista",
    especialidade_profissional: null,
    renda_mensal: "5000",
    renda_familiar: "8000",
    empresa: "Empresa Alfa",
    cargo_empresa: "Analista",
    data_admissao_empresa: "2018-01-01",
    empresa_logradouro: "Av Empresa",
    empresa_numero: "20",
    empresa_bairro: "Centro",
    empresa_cep: "25070100",
    empresa_cidade: "Duque de Caxias",
    empresa_estado: "RJ",
    empresa_pais: "Brasil",
    empresa_telefone: "2133334444",
    empresa_ramal: "10",
    foi_militar: false,
    patente_militar: null,
    local_militar: null,
    possui_filhos: true,
    entidades: null,
    processo_criminal: false,
    processo_criminal_detalhe: null,
    filiacao_partidaria: false,
    partido: null,
    outras_informacoes: null,
    motivacao: "Desejo ingressar para desenvolver valores eticos e fraternidade na comunidade local.",
    lgpd_versao: "2026-08-17",
    status: "Recebida",
    documentacao_completa: true,
    ...overrides,
  };
}

function dossieAlfa(extra = {}) {
  return {
    interesse: candidato(extra.interesse),
    proponenteNome: "Irmão Proponente Alfa",
    filhos: extra.filhos ?? [{ nome: "Pedro Alfa Silva", sexo: "masculino", data_nascimento: "2016-01-01", ordem: 1 }],
    referencias: extra.referencias ?? [
      { ordem: 1, nome: "Referencia Alfa Um", telefone: "21988881111", logradouro: "Rua Um", bairro: "Centro", cidade: "Duque de Caxias", estado: "RJ", cep: "25070001" },
      { ordem: 2, nome: "Referencia Alfa Dois", telefone: "21988882222", logradouro: "Rua Dois", bairro: "Centro", cidade: "Duque de Caxias", estado: "RJ", cep: "25070002" },
      { ordem: 3, nome: "Referencia Alfa Tres", telefone: "21988883333", logradouro: null, bairro: null, cidade: null, estado: null, cep: null },
    ],
    comercial: extra.comercial === undefined
      ? { razao_social: "Banco Alfa SA", telefone: "2130000000", logradouro: "Av Banco", bairro: "Centro", cidade: "Duque de Caxias", estado: "RJ", cep: "25070200" }
      : extra.comercial,
    documentos: extra.documentos ?? [
      { tipo: "identidade", url: "https://signed.example/alfa-identidade", nome_original: "rg.pdf" },
      { tipo: "comprovante_residencia", url: "https://signed.example/alfa-residencia", nome_original: "resid.pdf" },
    ],
    recebidoEm: "21/09/2026, 19:00:00",
  };
}

function dossieBeta() {
  return {
    interesse: candidato({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      nome: "Candidato Beta Souza",
      cpf: "11144477735",
      email: "beta@invalid.test",
      estado_civil: "solteiro",
      familiar_nome: "Helena Beta Souza",
      familiar_whatsapp: "21977770001",
      familiar_papel: "mae",
      data_casamento: null,
      esposa_nascimento: null,
      possui_filhos: false,
    }),
    proponenteNome: "Irmão Proponente Beta",
    filhos: [],
    referencias: [
      { ordem: 1, nome: "Referencia Beta Um", telefone: "21977771111", logradouro: "Rua Beta", bairro: "Jardim", cidade: "Rio de Janeiro", estado: "RJ", cep: "20040000" },
    ],
    comercial: { razao_social: "Casa Beta Ltda", telefone: "2131111111" },
    documentos: [{ tipo: "cpf", url: "https://signed.example/beta-cpf", nome_original: "cpf.pdf" }],
    recebidoEm: "21/09/2026, 19:10:00",
  };
}

test("TTL das signed URLs da Secretaria é de 7 dias", () => {
  assert.equal(DOC_SIGNED_URL_TTL_SECONDS, 7 * 24 * 60 * 60);
  const loader = read("supabase/functions/_shared/dossie-secretaria.ts");
  assert.match(loader, /DOC_SIGNED_URL_TTL_SECONDS/);
  assert.match(loader, /createSignedUrl\(/);
  assert.match(loader, /download: filename/);
  assert.match(read("supabase/functions/registrar-interesse/index.ts"), /loadCandidaturaDossie/);
});

test("12 e 13: todas as referências pessoais e seus contatos aparecem no e-mail", () => {
  const { inner, text } = buildSecretarioDossie(dossieAlfa());
  assert.match(inner, /Referência pessoal 1/);
  assert.match(inner, /Referência pessoal 2/);
  assert.match(inner, /Referência pessoal 3/);
  assert.match(inner, /Referencia Alfa Um/);
  assert.match(inner, /\(21\) 98888-1111/);
  assert.match(inner, /Rua Um/);
  assert.match(text, /Referencia Alfa Dois/);
  assert.match(text, /\(21\) 98888-2222/);
  assert.match(inner, /Referencia Alfa Tres/);
});

test("14 e 15: referência comercial aparece quando preenchida e ausência não quebra", () => {
  const com = buildSecretarioDossie(dossieAlfa());
  assert.match(com.inner, /Banco Alfa SA/);
  assert.match(com.inner, /\(21\) 3000-0000/);
  const sem = buildSecretarioDossie(dossieAlfa({ comercial: null }));
  assert.match(sem.inner, /Não informada nesta candidatura/);
  assert.doesNotMatch(sem.inner, /Banco Alfa SA/);
  assert.equal(typeof sem.inner, "string");
  assert.ok(sem.inner.includes("Referência comercial"));
});

test("16: múltiplas referências são renderizadas na ordem", () => {
  const { inner } = buildSecretarioDossie(dossieAlfa());
  const first = inner.indexOf("Referencia Alfa Um");
  const second = inner.indexOf("Referencia Alfa Dois");
  const third = inner.indexOf("Referencia Alfa Tres");
  assert.ok(first >= 0 && second > first && third > second);
});

test("17: condicionais familiares são respeitadas", () => {
  const casado = buildSecretarioDossie(dossieAlfa());
  assert.match(casado.inner, /Esposa/);
  assert.match(casado.inner, /Ana Alfa Souza/);
  assert.match(casado.inner, /Ciência do consentimento familiar/);
  assert.doesNotMatch(casado.inner, /Data de casamento/);
  assert.doesNotMatch(casado.inner, /Nascimento da esposa/);
  assert.doesNotMatch(casado.inner, /Situação familiar/);

  const solteiro = buildSecretarioDossie(dossieAlfa({
    interesse: {
      estado_civil: "solteiro",
      familiar_papel: "mae",
      familiar_nome: "Helena Alfa Silva",
      data_casamento: null,
      esposa_nascimento: null,
    },
  }));
  assert.match(solteiro.inner, /Nome da mãe \(consentimento\)/);
  assert.match(solteiro.inner, /Helena Alfa Silva/);
  assert.doesNotMatch(solteiro.inner, /Data de casamento/);
});

test("18: filhos são apresentados quando existentes", () => {
  const com = buildSecretarioDossie(dossieAlfa({
    filhos: [
      { nome: "Pedro Alfa Silva", sexo: "masculino", data_nascimento: "2016-01-01", ordem: 1 },
      { nome: "Clara Alfa Silva", sexo: "feminino", data_nascimento: "2018-05-05", ordem: 2 },
    ],
  }));
  const first = com.inner.indexOf("Pedro Alfa Silva");
  const second = com.inner.indexOf("Clara Alfa Silva");
  assert.ok(first >= 0 && second > first);
  assert.match(com.inner, /Possui filhos/);
  assert.match(com.inner, />Nome</);
  assert.doesNotMatch(com.inner, /Masculino|Feminino|Filho 1|Filho 2|2016-01-01|05\/05\/2018/);
  const sem = buildSecretarioDossie(dossieAlfa({
    interesse: { possui_filhos: false },
    filhos: [],
  }));
  assert.match(sem.inner, /Possui filhos/);
  assert.match(sem.inner, />Não</);
  assert.doesNotMatch(sem.inner, /Pedro Alfa Silva|Clara Alfa Silva/);
});

test("19: campos opcionais ausentes não quebram o e-mail", () => {
  const { inner } = buildSecretarioDossie(dossieAlfa({
    interesse: {
      complemento: null,
      especializacao: null,
      tratamento_saude: null,
      nome_pai: null,
      empresa_ramal: null,
    },
  }));
  assert.match(inner, /Complemento/);
  assert.match(inner, /—/);
  assert.match(inner, /Candidato Alfa Silva/);
});

test("20: proponente aparece no dossiê da Secretaria", () => {
  const { inner, text } = buildSecretarioDossie(dossieAlfa());
  assert.match(inner, /Proponente/);
  assert.match(inner, /Irmão Proponente Alfa/);
  assert.match(text, /Proponente: Irmão Proponente Alfa/);
});

test("21, 22 e 23: dados, referências e documentos do candidato A não vazam no e-mail de B", () => {
  const a = buildSecretarioDossie(dossieAlfa());
  const b = buildSecretarioDossie(dossieBeta());
  assert.match(a.inner, /Candidato Alfa Silva/);
  assert.match(b.inner, /Candidato Beta Souza/);
  assert.doesNotMatch(a.inner, /Candidato Beta Souza|Referencia Beta Um|Casa Beta Ltda|beta-cpf/);
  assert.doesNotMatch(b.inner, /Candidato Alfa Silva|Referencia Alfa Um|Banco Alfa SA|alfa-identidade|Pedro Alfa Silva/);
  assert.doesNotMatch(a.text, /Referencia Beta Um/);
  assert.doesNotMatch(b.text, /Referencia Alfa Um/);
});

test("24: e-mail do proponente continua só com a notificação mínima", () => {
  const aviso = buildProponenteAviso({
    candidatoNome: "Candidato Alfa Silva",
    proponenteNome: "Irmão Proponente Alfa",
  });
  assert.match(aviso.inner, /identificou você como o Irmão que o convidou/);
  assert.doesNotMatch(aviso.inner, /39053344705|Referencia Alfa|renda|Documento|Banco Alfa|WhatsApp/);
  assert.doesNotMatch(aviso.text, /CPF|referência|documento|renda/i);
});

test("25: conclusão pública usa claim atômico e o reenvio administrativo permanece independente", () => {
  const registrar = read("supabase/functions/registrar-interesse/index.ts");
  const reenvio = read("supabase/functions/reenviar-dossie-secretaria/index.ts");
  assert.match(registrar, /claim_conclusao_candidatura/);
  assert.match(registrar, /runConclusaoCandidatura/);
  assert.match(reenvio, /sendSecretarioEmail/);
  assert.doesNotMatch(reenvio, /sendProponenteEmail/);
  assert.doesNotMatch(reenvio, /claim_conclusao_candidatura/);
});

test("dossiê carrega coleções só da candidatura e signed URL não vai para log", () => {
  const loader = read("supabase/functions/_shared/dossie-secretaria.ts");
  assert.match(loader, /from\("interesse_referencias"\)[\s\S]*eq\("interesse_id", interesseId\)/);
  assert.match(loader, /from\("interesse_referencia_comercial"\)[\s\S]*eq\("interesse_id", interesseId\)/);
  assert.match(loader, /from\("interesse_filhos"\)[\s\S]*eq\("interesse_id", interesseId\)/);
  assert.match(loader, /startsWith\(prefixo\)/);
  assert.doesNotMatch(loader, /console\.(log|error|info)\([^)]*signedUrl/);
  assert.doesNotMatch(loader, /console\.(log|error|info)\([^)]*signedByPath/);
  assert.doesNotMatch(read("supabase/functions/_shared/email.ts"), /service_role/);
});

const EXCLUIDOS_DOSSIE = [
  "Plano de saúde",
  "Tipo sanguíneo",
  "Tratamento de saúde",
  "Renda mensal",
  "Renda familiar",
  "É ou foi militar",
  "Patente ou graduação",
  "Local ou organização militar",
  "Entidades das quais participa",
  "Responde a processo criminal",
  "Detalhes do processo",
  "Possui filiação partidária",
  "Partido",
  "AmilPlanoExclusivoXYZ",
  "ABNEG",
  "TratamentoSaudeExclusivoXYZ",
  "RendaMensalExclusiva9999",
  "RendaFamiliarExclusiva8888",
  "PatenteMilitarExclusiva",
  "LocalMilitarExclusivo",
  "ProcessoCriminalDetalheExclusivo",
  "PartidoExclusivoXYZ",
  "EntidadeExclusivaXYZ",
];

test("dossiê da Secretaria omite saúde, renda, militar, criminal, partido e entidades", () => {
  const { inner, text } = buildSecretarioDossie(dossieAlfa({
    interesse: {
      plano_saude: "AmilPlanoExclusivoXYZ",
      tipo_sanguineo: "ABNEG",
      tratamento_saude: "TratamentoSaudeExclusivoXYZ",
      renda_mensal: "RendaMensalExclusiva9999",
      renda_familiar: "RendaFamiliarExclusiva8888",
      foi_militar: true,
      patente_militar: "PatenteMilitarExclusiva",
      local_militar: "LocalMilitarExclusivo",
      processo_criminal: true,
      processo_criminal_detalhe: "ProcessoCriminalDetalheExclusivo",
      filiacao_partidaria: true,
      partido: "PartidoExclusivoXYZ",
      entidades: "EntidadeExclusivaXYZ",
    },
  }));
  const rendered = `${inner}\n${text}`;
  for (const item of EXCLUIDOS_DOSSIE) {
    assert.doesNotMatch(rendered, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(inner, /Candidato Alfa Silva/);
  assert.doesNotMatch(rendered, /390\.533\.447-05|IFP-RJ|Órgão expedidor|Expedição do RG/);
  assert.match(inner, /Tempo de residência/);
  assert.match(inner, /Empresa Alfa/);
  assert.match(inner, /Data de admissão/);
  assert.match(inner, /Irmão Proponente Alfa/);
  assert.match(inner, /Referencia Alfa Um/);
  assert.match(inner, /Banco Alfa SA/);
  assert.match(inner, /Baixar documento/);
  assert.doesNotMatch(inner, /Abrir documento/);
  assert.match(read("supabase/functions/_shared/candidatura.ts"), /plano_saude/);
  assert.match(read("supabase/functions/_shared/candidatura.ts"), /renda_mensal/);
  assert.match(read("supabase/functions/_shared/candidatura.ts"), /foi_militar/);
  assert.match(read("supabase/functions/_shared/candidatura.ts"), /processo_criminal/);
  assert.match(read("supabase/functions/_shared/candidatura.ts"), /filiacao_partidaria/);
  assert.match(read("interesse.html"), /Plano de saúde/);
  assert.match(read("interesse.html"), /Renda mensal/);
});

test("inspeção de completude não expõe PII e marca dossiê reconstruível", () => {
  const inspecao = inspectDossieCompleteness(dossieAlfa());
  assert.equal(inspecao.dados_principais, "OK");
  assert.equal(inspecao.familia, "OK");
  assert.equal(inspecao.filhos, "OK");
  assert.equal(inspecao.profissional, "OK");
  assert.equal(inspecao.proponente, "OK");
  assert.equal(inspecao.referencias, "OK");
  assert.equal(inspecao.comercial, "OK");
  assert.equal(inspecao.documentos, "OK");
  assert.equal(inspecao.reconstruivel, "COMPLETA");
  assert.deepEqual(inspecao.tipos_documentos, ["comprovante_residencia", "identidade"]);
  assert.equal(JSON.stringify(inspecao).includes("Candidato Alfa Silva"), false);
  assert.equal(JSON.stringify(inspecao).includes("39053344705"), false);
});

test("reenvio administrativo só reconstrói e envia à Secretaria", () => {
  const fn = read("supabase/functions/reenviar-dossie-secretaria/index.ts");
  const config = read("supabase/config.toml");
  const emailer = read("supabase/functions/_shared/email.ts");
  assert.match(config, /\[functions\.reenviar-dossie-secretaria\][\s\S]*verify_jwt = true/);
  assert.match(fn, /requireActiveMember/);
  assert.match(fn, /isStaffProfile/);
  assert.match(fn, /loadCandidaturaDossie/);
  assert.match(fn, /sendSecretarioEmail/);
  assert.match(fn, /acao === "inspecionar"/);
  assert.match(emailer, /sendTransactionalEmail/);
  assert.doesNotMatch(fn, /sendProponenteEmail/);
  assert.doesNotMatch(fn, /interesse_upload_token/);
  assert.doesNotMatch(fn, /used_at/);
  assert.doesNotMatch(fn, /\.update\(/);
  assert.doesNotMatch(fn, /\.insert\(/);
  assert.doesNotMatch(fn, /status:\s*"Recebida"/);
});

test("dossiê omite CPF, RG, órgão, expedição, datas da esposa e dados dos filhos além do nome", () => {
  const { inner, text } = buildSecretarioDossie(dossieAlfa({
    filhos: [
      { nome: "Pedro Alfa Silva", sexo: "masculino", data_nascimento: "2016-01-01", ordem: 1 },
      { nome: "Clara Alfa Silva", sexo: "feminino", data_nascimento: "2018-05-05", ordem: 2 },
    ],
  }));
  const rendered = `${inner}\n${text}`;
  assert.doesNotMatch(rendered, /390\.533\.447-05|39053344705/);
  assert.doesNotMatch(rendered, />RG<|>Órgão expedidor<|>Expedição do RG|IFP-RJ|10\/10\/2010/);
  assert.doesNotMatch(rendered, /Data de casamento|01\/06\/2015|Nascimento da esposa|04\/03\/1991/);
  assert.doesNotMatch(rendered, /Filho 1|Filho 2|Masculino|Feminino|01\/01\/2016|05\/05\/2018/);
  assert.match(inner, /Pedro Alfa Silva/);
  assert.match(inner, /Clara Alfa Silva/);
  assert.match(inner, /Ana Alfa Souza/);
  assert.match(inner, /\(21\) 98888-0001/);
  assert.match(inner, /Ciência do consentimento familiar/);
});

test("download usa signed URL temporária, CTA de baixar e nome sem PII", () => {
  const loader = read("supabase/functions/_shared/dossie-secretaria.ts");
  assert.match(loader, /createSignedUrl\(/);
  assert.match(loader, /download: filename/);
  assert.match(loader, /startsWith\(prefixo\)/);
  assert.doesNotMatch(loader, /createSignedUrls/);
  assert.doesNotMatch(loader, /console\.(log|error|info)\([^)]*signedUrl/);
  assert.match(read("supabase/migrations/20260916180000_cadastro_candidato_admissao.sql"), /public = excluded.public/);
  const { inner } = buildSecretarioDossie(dossieAlfa());
  assert.match(inner, /Baixar documento/);
  assert.doesNotMatch(inner, /Abrir documento/);
  assert.equal(documentoDownloadName("identidade", "RG Candidato Alfa Silva 39053344705.pdf", "id/doc.pdf"), "identidade.pdf");
  assert.equal(documentoDownloadName("certidao_casamento", "casamento.PNG", "id/x.png"), "certidao-casamento.png");
  assert.doesNotMatch(documentoDownloadName("cpf", "cpf-fulano.pdf"), /Alfa|39053344705|Fulano/i);
});

test("proponente: e-mail do acesso é preferido e consulta posterior não invalida o já encontrado", () => {
  assert.deepEqual(pickProponenteEmail({
    irmaoEmail: "irmao@invalid.test",
    authEmail: "acesso@invalid.test",
    vinculoEmail: "",
  }), { email: "acesso@invalid.test", source: "irmaos_autorizados" });
  assert.deepEqual(pickProponenteEmail({
    irmaoEmail: "",
    authEmail: "",
    vinculoEmail: "vinculo@invalid.test",
  }), { email: "vinculo@invalid.test", source: "irmaos_autorizados" });
  assert.deepEqual(pickProponenteEmail({
    irmaoEmail: "irmao@invalid.test",
    authEmail: "",
    vinculoEmail: "",
  }), { email: "irmao@invalid.test", source: "irmaos" });
  assert.deepEqual(pickProponenteEmail({
    irmaoEmail: "",
    authEmail: "",
    vinculoEmail: "",
  }), { email: "", source: "ausente" });

  assert.deepEqual(resolveProponenteFromLookups({
    auth: { email: "acesso@invalid.test" },
    vinculo: { error: true },
    irmaoEmail: "irmao@invalid.test",
  }), { ok: true, email: "acesso@invalid.test", source: "irmaos_autorizados" });
  assert.deepEqual(resolveProponenteFromLookups({
    auth: { email: "" },
    vinculo: { error: true },
    irmaoEmail: "irmao@invalid.test",
  }), { ok: true, email: "irmao@invalid.test", source: "irmaos" });
  assert.deepEqual(resolveProponenteFromLookups({
    auth: { error: true },
    irmaoEmail: "irmao@invalid.test",
  }), { ok: false, email: "", source: "erro_consulta" });
  assert.deepEqual(resolveProponenteFromLookups({
    auth: { email: "" },
    vinculo: { email: "" },
    irmaoEmail: "",
  }), { ok: true, email: "", source: "ausente" });

  const registrar = read("supabase/functions/registrar-interesse/index.ts");
  const loader = read("supabase/functions/_shared/dossie-secretaria.ts");
  const emailer = read("supabase/functions/_shared/email.ts");
  assert.match(registrar, /resolveProponenteEmail/);
  assert.match(registrar, /sendProponenteEmail/);
  assert.match(loader, /resolveProponenteFromLookups/);
  assert.match(loader, /if \(first\.email\) return first/);
  assert.match(emailer, /sendTransactionalEmail/);
  assert.match(emailer, /STARTTLS/);
  assert.match(emailer, /AUTH LOGIN/);
  assert.match(emailer, /denoSmtpTransport/);
  assert.equal(isSuccessfulEmailStatus(250), true);
  assert.equal(isSuccessfulEmailStatus(550), false);
  assert.equal(isSuccessfulEmailStatus(0), false);

  const aviso = buildProponenteAviso({
    candidatoNome: "Candidato Alfa Silva",
    proponenteNome: "Irmão Proponente Alfa",
  });
  assert.match(aviso.inner, /identificou você como o Irmão que o convidou/);
  assert.doesNotMatch(aviso.inner, /39053344705|Referencia Alfa|Rua Alfa|Banco Alfa|Documento|filhos/i);
  assert.doesNotMatch(read("supabase/functions/reenviar-dossie-secretaria/index.ts"), /sendProponenteEmail/);
});
