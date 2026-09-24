import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const DOCUMENT_TYPES = [
  "certidao_nascimento",
  "certidao_casamento",
  "identidade",
  "cpf",
  "titulo_eleitoral",
  "comprovante_rendimentos",
  "comprovante_residencia",
];
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_DOC_MB = 5;
const MAX_DOC_BYTES = MAX_DOC_MB * 1024 * 1024;

function requiredCertidaoTipo(estadoCivil) {
  return estadoCivil === "casado" || estadoCivil === "uniao_estavel"
    ? "certidao_casamento"
    : "certidao_nascimento";
}

function requiredDocumentTypes(estadoCivil) {
  return [requiredCertidaoTipo(estadoCivil), "identidade", "cpf", "titulo_eleitoral", "comprovante_rendimentos", "comprovante_residencia"];
}

function validateDocumentFile(input) {
  if (!DOCUMENT_TYPES.includes(String(input.tipo || ""))) return "Tipo de documento inválido.";
  if (!ALLOWED_MIME.includes(input.mime)) return "Envie o documento em PDF, JPG ou PNG.";
  if (input.size <= 0 || input.size > MAX_DOC_BYTES) return `Cada documento deve ter no máximo ${MAX_DOC_MB} MB.`;
  return "";
}

test("o cadastro público evolui em sete etapas sem segundo formulário", () => {
  const html = read("interesse.html");
  assert.match(html, /id="interest-form"/);
  assert.match(html, /data-step="1"/);
  assert.match(html, /data-step="7"/);
  assert.match(html, /Quem o convidou a ser iniciado/);
  assert.match(html, /id="proponenteBusca"/);
  assert.match(html, /id="proponenteId"/);
  assert.doesNotMatch(html, /irmao_convite/);
  assert.doesNotMatch(html, /service_role/);
  assert.doesNotMatch(html, /sindicância|sindicancia|votação|votacao/i);
});

test("frontend não expõe service_role e usa só a chave publicável", () => {
  const frontend = [
    read("config.js"),
    read("script.js"),
    read("interesse.html"),
    read("confirmacao.html"),
  ].join("\n");
  assert.doesNotMatch(frontend, /service_role/);
  assert.match(read("config.js"), /supabaseAnonKey/);
  assert.match(read("script.js"), /apikey: config\.supabaseAnonKey/);
  assert.doesNotMatch(read("script.js"), /functions\/v1\/irmaos/);
});

test("proponente exige clique na sugestão e busca mínima de 4 caracteres", () => {
  const js = read("script.js");
  assert.match(js, /q\.length < 4/);
  assert.match(js, /buscar-proponente/);
  assert.match(js, /proponenteId"\)\.value = item\.id/);
  assert.match(js, /clearProponente/);
  assert.match(js, /Selecione o irmão que o convidou/);
  const fn = read("supabase/functions/buscar-proponente/index.ts");
  assert.match(fn, /PROPONENTE_MIN_CHARS/);
  assert.match(fn, /buscar_proponentes_publicos/);
  assert.doesNotMatch(fn, /from\("irmaos"\)\.select/);
});

test("condicionais de estado civil, filhos, militar e declarações", () => {
  const html = read("interesse.html");
  const js = read("script.js");
  const backend = read("supabase/functions/_shared/candidatura.ts");
  assert.match(html, /id="bloco-conjuge"/);
  assert.match(html, /id="bloco-filhos"/);
  assert.match(html, /id="bloco-militar"/);
  assert.match(html, /id="bloco-processo"/);
  assert.match(html, /id="bloco-partido"/);
  assert.match(js, /certidao_casamento/);
  assert.equal(requiredCertidaoTipo("casado"), "certidao_casamento");
  assert.equal(requiredCertidaoTipo("uniao_estavel"), "certidao_casamento");
  assert.equal(requiredCertidaoTipo("solteiro"), "certidao_nascimento");
  assert.equal(requiredCertidaoTipo("divorciado"), "certidao_nascimento");
  assert.match(backend, /conjuge \? dataCasamento : null/);
  assert.match(backend, /foiMilitar \? patenteMilitar : null/);
  assert.match(backend, /processoCriminal \? processoDetalhe : null/);
  assert.match(backend, /filiacaoPartidaria \? partido : null/);
  assert.deepEqual(requiredDocumentTypes("casado"), [
    "certidao_casamento",
    "identidade",
    "cpf",
    "titulo_eleitoral",
    "comprovante_rendimentos",
    "comprovante_residencia",
  ]);
});

test("documentos: tipo, MIME, tamanho e isolamento do bucket da cartilha", () => {
  const migration = read("supabase/migrations/20260916180000_cadastro_candidato_admissao.sql");
  const upload = read("supabase/functions/enviar-documento-candidatura/index.ts");
  const shared = read("supabase/functions/_shared/candidatura.ts");
  assert.match(migration, /candidaturas-documentos/);
  assert.match(migration, /5242880/);
  assert.match(migration, /'cartilha'/);
  assert.match(upload, /from\("candidaturas-documentos"\)/);
  assert.doesNotMatch(upload, /from\("cartilha"\)/);
  assert.match(upload, /interesse_upload_token/);
  assert.match(upload, /\$\{row\.interesse_id\}\/\$\{documentoId\}\.\$\{ext\}/);
  assert.match(upload, /interesse_documentos persist/);
  assert.match(upload, /safeErrorLog/);
  assert.match(upload, /remove\(\[storagePath\]\)/);
  const logHelper = upload.slice(upload.indexOf("function safeErrorLog"), upload.indexOf("Deno.serve"));
  assert.doesNotMatch(logHelper, /nome_original|tokenHash|service_role|file\.name/);
  assert.match(shared, /MAX_DOC_MB = 5/);
  assert.match(shared, /MAX_DOC_BYTES = MAX_DOC_MB \* 1024 \* 1024/);
  assert.equal(validateDocumentFile({ tipo: "identidade", mime: "application/pdf", size: 1000, name: "rg.pdf" }), "");
  assert.match(validateDocumentFile({ tipo: "identidade", mime: "application/zip", size: 1000, name: "rg.zip" }), /PDF/);
  assert.match(validateDocumentFile({ tipo: "identidade", mime: "application/pdf", size: MAX_DOC_BYTES + 1, name: "rg.pdf" }), /5 MB/);
  assert.match(validateDocumentFile({ tipo: "outro", mime: "application/pdf", size: 1000, name: "x.pdf" }), /inválido/);
  assert.doesNotMatch(read("script.js"), /abrir-cartilha.*documento|candidaturas-documentos.*cartilha/s);
});

test("backend revalida proponente e não cria cadastro paralelo", () => {
  const registrar = read("supabase/functions/registrar-interesse/index.ts");
  const shared = read("supabase/functions/_shared/candidatura.ts");
  const dossie = read("supabase/functions/_shared/email-dossie.js");
  const avisoProponente = dossie.slice(dossie.indexOf("export function buildProponenteAviso"));
  assert.match(registrar, /normalizeCandidatura/);
  assert.match(registrar, /proponente_elegivel/);
  assert.match(registrar, /sendSecretarioEmail/);
  assert.match(registrar, /sendProponenteEmail/);
  assert.match(registrar, /acao.*concluir/);
  assert.match(shared, /proponente_id: proponenteId/);
  assert.doesNotMatch(shared, /irmao_convite_id/);
  assert.doesNotMatch(avisoProponente, /formatCpf|renda_mensal|Referência pessoal|Abrir documento|Baixar documento/);
  assert.match(avisoProponente, /identificou você como o Irmão que o convidou/);
});

test("RLS da busca e do storage permanece server-side", () => {
  const migration = read("supabase/migrations/20260916180000_cadastro_candidato_admissao.sql");
  assert.match(migration, /grant execute on function public.buscar_proponentes_publicos\(text\) to service_role/);
  assert.match(migration, /revoke all on function public.buscar_proponentes_publicos\(text\) from public, anon, authenticated/);
  assert.match(migration, /references public.irmaos \(id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public = excluded.public/);
  assert.match(read("supabase/config.toml"), /\[functions.buscar-proponente\]/);
  assert.match(read("supabase/config.toml"), /\[functions.enviar-documento-candidatura\]/);
});

test("confirmação e cartilha atuais foram preservadas", () => {
  const confirmacao = read("confirmacao.html");
  const js = read("script.js");
  assert.match(confirmacao, /id="cartilha"/);
  assert.match(js, /abrir-cartilha/);
  assert.match(js, /lacosManifestacao/);
  assert.match(confirmacao, /não representa aprovação/);
});

test("plano de saúde aceita ausência explícita no backend e na UI", () => {
  const html = read("interesse.html");
  const js = read("script.js");
  const shared = read("supabase/functions/_shared/candidatura.ts");
  assert.match(html, /id="naoPossuiPlanoSaude"/);
  assert.match(html, /Não possuo plano de saúde/);
  assert.match(js, /naoPossuiPlanoSaude/);
  assert.match(js, /PLANO_SAUDE_AUSENTE/);
  assert.match(js, /el\("planoSaude"\)\.disabled = sem/);
  assert.match(shared, /PLANO_SAUDE_AUSENTE = "nao_possui"/);
  assert.match(shared, /naoPossuiPlanoSaude/);
});

test("UI pública usa só Profissão e o backend copia para ocupacao", () => {
  const html = read("interesse.html");
  const js = read("script.js");
  const shared = read("supabase/functions/_shared/candidatura.ts");
  assert.match(html, /for="profissao"/);
  assert.doesNotMatch(html, /id="ocupacao"|for="ocupacao"/);
  assert.match(js, /ocupacao: collapseSpaces\(el\("profissao"\)/);
  assert.match(shared, /ocupacao = str\(input, "ocupacao"\) \|\| profissao/);
});

test("comprovante de residência é obrigatório de ponta a ponta", () => {
  const html = read("interesse.html");
  const js = read("script.js");
  const shared = read("supabase/functions/_shared/candidatura.ts");
  const migration = read("supabase/migrations/20260916213000_comprovante_residencia.sql");
  assert.match(js, /comprovante_residencia: "Comprovante de residência"/);
  assert.doesNotMatch(js, /Comprovante de residência recente/);
  assert.match(js, /"comprovante_residencia"/);
  assert.match(shared, /"comprovante_residencia"/);
  assert.match(migration, /comprovante_residencia/);
  assert.equal(requiredDocumentTypes("solteiro").includes("comprovante_residencia"), true);
  assert.match(js, /renderReview/);
  assert.match(js, /DOC_LABELS\[tipo\]/);
  assert.doesNotMatch(html, /30 dias|60 dias|90 dias/);
});

test("upload próprio, 5 MB centralizado e documento contextual não duplicado", () => {
  const js = read("script.js");
  const html = read("interesse.html");
  const css = read("styles.css");
  const config = read("config.js");
  assert.match(config, /maxDocMb: 5/);
  assert.match(js, /config\.maxDocMb/);
  assert.match(js, /renderUploadCard/);
  assert.match(js, /Anexar documento/);
  assert.match(js, /hint: false/);
  assert.match(js, /✓ Enviado/);
  assert.match(js, /Alterar documento/);
  assert.doesNotMatch(js, /data-replace-doc='[^']+'>Alterar</);
  assert.match(js, /data-replace-doc/);
  assert.match(html, /id="upload-certidao-civil"/);
  assert.match(html, /máximo 5 MB por arquivo/);
  assert.match(css, /\.upload-card/);
  assert.match(css, /\.upload-trigger/);
  assert.doesNotMatch(js, /Escolher ficheiro|Nenhum selecionado/);
  assert.doesNotMatch(js, /doc-status is-warn'>Obrigatório/);
});

test("progresso compacto, revisão Editar e LGPD em seção própria", () => {
  const html = read("interesse.html");
  const js = read("script.js");
  assert.match(html, /id="form-progress-label"/);
  assert.match(html, /Etapa 1 de 7/);
  assert.match(html, /form-progress-dots/);
  assert.match(html, /Preencha seus dados para iniciar o processo de cadastro/);
  assert.match(html, /Privacidade e tratamento de dados/);
  assert.match(html, /Política de Privacidade/);
  assert.match(js, />Editar</);
  assert.doesNotMatch(js, /Editar Dados pessoais/);
  assert.match(js, /Revise " \+ n \+ " campos obrigatórios/);
  assert.match(js, /focusFirstInvalid/);
  assert.match(js, /＋ Adicionar outro filho/);
});

test("proponente: busca vazia discreta e seleção explícita com visto", () => {
  const js = read("script.js");
  assert.match(js, /Nenhum irmão encontrado/);
  assert.match(js, /Tente outro nome/);
  assert.match(js, /"✓ " \+ item\.nome/);
  assert.match(js, /clearProponente/);
  assert.match(js, /q\.length < 4/);
  assert.doesNotMatch(js, /Refine o nome/);
});

test("falha de metadata após Storage remove o objeto novo e não vaza PII no log", () => {
  const upload = read("supabase/functions/enviar-documento-candidatura/index.ts");
  assert.match(upload, /if \(!existing \|\| existing\.storage_path !== storagePath\)/);
  assert.match(upload, /from\("candidaturas-documentos"\)[\s\S]*remove\(\[storagePath\]\)/);
  assert.match(upload, /existing\?\.storage_path && existing\.storage_path !== storagePath/);
  assert.match(upload, /Failing row contains/);
  assert.doesNotMatch(upload, /saved\.error\.details/);
  assert.doesNotMatch(upload, /console\.error\([^)]*token/);
});

test("layout mobile verticaliza documentos e evita overflow", () => {
  const css = read("styles.css");
  assert.match(css, /\.upload-card \{/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /\.review-head/);
  assert.match(css, /flex-wrap: wrap/);
});

test("certidão civil contextual: nascimento ou casamento, nunca os dois na UI", () => {
  const html = read("interesse.html");
  const js = read("script.js");
  assert.match(html, /id="upload-certidao-civil"/);
  assert.ok(html.indexOf('id="upload-certidao-civil"') > html.indexOf('id="bloco-mae"'));
  assert.doesNotMatch(html, /id="upload-certidao_casamento"/);
  assert.match(js, /requiredCertidaoTipo\(\)/);
  assert.match(js, /slot\.innerHTML = renderUploadCard\(requiredCertidaoTipo\(\)\)/);
  assert.match(js, /requiredDocumentTypes\(\)\.map/);
  assert.doesNotMatch(js, /Não aplicável/);
  assert.equal(requiredCertidaoTipo("solteiro"), "certidao_nascimento");
  assert.equal(requiredCertidaoTipo("divorciado"), "certidao_nascimento");
  assert.equal(requiredCertidaoTipo("casado"), "certidao_casamento");
  assert.ok(!requiredDocumentTypes("solteiro").includes("certidao_casamento"));
  assert.ok(!requiredDocumentTypes("casado").includes("certidao_nascimento"));
  assert.match(js, /Envie " \+ DOC_LABELS\[certTipo\]/);
});

test("editar a partir da revisão volta à etapa 7 sem passar por 4-6", () => {
  const js = read("script.js");
  const html = read("interesse.html");
  const css = read("styles.css");
  assert.match(js, /editingFromReview = true/);
  assert.match(js, /Salvar alterações/);
  assert.match(js, /Cancelar e voltar à revisão/);
  assert.match(js, /captureEditSnapshot/);
  assert.match(js, /restoreEditSnapshot/);
  assert.match(js, /if \(editingFromReview\) \{/);
  assert.match(js, /showStep\(7\)/);
  assert.match(html, /button-secondary/);
  assert.match(js, /Math\.min\(7, currentStep \+ 1\)/);
  assert.doesNotMatch(js, /Salvar e voltar à revisão/);
  assert.match(css, /is-edit-mode/);
  assert.match(css, /flex-direction: column/);
  assert.match(css, /\.form-wizard-nav\.is-edit-mode \.button-secondary \{[^}]*border: 1px solid rgba\(18, 58, 116/);
});

test("Sim/Não padronizado e confirmação não encoberta pelo header", () => {
  const html = read("interesse.html");
  const css = read("styles.css");
  const confirmacao = read("confirmacao.html");
  assert.match(html, /class="choice-chip"/);
  assert.match(html, /role="radiogroup"/);
  assert.equal((html.match(/class="choice-chip"/g) || []).length, 8);
  assert.match(html, /class="visually-hidden"[^>]*type="radio"|type="radio"[^>]*class="visually-hidden"/);
  assert.match(css, /\.choice-chip:has\(input:checked\)/);
  assert.doesNotMatch(css, /choice-chip:has\(input:checked\) span::before/);
  assert.doesNotMatch(css, /\.choice-chip input \{[\s\S]*width: 16px/);
  assert.doesNotMatch(css, /flex:\s*1\s+1\s+50%/);
  assert.match(css, /\.choice-row \{[\s\S]*?gap:\s*10px/);
  assert.match(css, /\.choice-chip:has\(input:focus-visible\)/);
  assert.doesNotMatch(css, /\.choice-chip:focus-within/);
  assert.match(html, /Consentimento familiar/);
  assert.match(css, /align-items: center/);
  assert.match(css, /--header-height/);
  assert.match(css, /scroll-margin-top: calc\(var\(--header-height\)/);
  assert.match(css, /\.page-confirm h1/);
  assert.match(css, /\.confirm-hero \{[\s\S]*overflow: visible/);
  assert.match(css, /\.choice-chip span/);
  assert.match(confirmacao, /id="cartilha-acesso"/);
});

test("cartilha tem estados ativo, expirado e consumido sem mensagens conflitantes", () => {
  const js = read("script.js");
  const html = read("confirmacao.html");
  assert.match(html, /id="cartilha-acesso"/);
  assert.match(html, /Enquanto aguarda nosso contato/);
  assert.match(html, /10 minutos de acesso/);
  assert.match(html, /Documento em PDF/);
  assert.doesNotMatch(html, /PDF · acesso disponível/);
  assert.doesNotMatch(html, /Este acesso expirou/);
  assert.match(js, /setCartilhaState\("active"\)/);
  assert.match(js, /setCartilhaState\("expired"\)/);
  assert.match(js, /setCartilhaState\("consumed"\)/);
  assert.match(js, /O acesso à cartilha expirou/);
  assert.match(js, /Cartilha acessada/);
  assert.match(js, /inactive = state === "expired" \|\| state === "consumed"/);
  assert.match(js, /data-state", state/);
});
