import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateDossieQueries,
  evaluateSignedUrl,
  interpretClaimRow,
  responseForClaim,
  runConclusaoCandidatura,
} from "../supabase/functions/_shared/conclusao-candidatura.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const dossieOk = {
  ok: true,
  status: 200,
  payload: { interesse: { id: "int-1", nome: "Candidato", documentacao_completa: false } },
  irmao: { id: "irmao-1", nome: "Proponente" },
  missingDocumentos: [],
};

function deps(overrides = {}) {
  const calls = { claim: 0, load: 0, release: 0, emails: 0, finalize: 0, cartilha: 0 };
  return {
    calls,
    claim: async () => {
      calls.claim += 1;
      return { resultado: "adquirido", token_id: "tok-1", interesse_id: "int-1" };
    },
    loadDossie: async () => {
      calls.load += 1;
      return dossieOk;
    },
    release: async () => {
      calls.release += 1;
    },
    criarCartilha: async () => {
      calls.cartilha += 1;
      return { token: "cartilha-1", expiresInMinutes: 10 };
    },
    enviarEmails: async () => {
      calls.emails += 1;
      return { secretaryEmailSent: true, proponenteNotificacao: "enviada" };
    },
    finalize: async () => {
      calls.finalize += 1;
      return true;
    },
    ...overrides,
  };
}

test("primeira conclusão válida processa uma vez", async () => {
  const harness = deps();
  const result = await runConclusaoCandidatura({ tokenHash: "hash" }, harness);
  assert.equal(result.status, 200);
  assert.equal(result.body.registrationSuccess, true);
  assert.equal(result.body.secretaryEmailSent, true);
  assert.equal(harness.calls.emails, 1);
  assert.equal(harness.calls.finalize, 1);
  assert.equal(harness.calls.release, 0);
});

test("segunda chamada após conclusão não reenvia", async () => {
  const harness = deps({
    claim: async () => ({ resultado: "concluido", token_id: "tok-1", interesse_id: "int-1" }),
  });
  const result = await runConclusaoCandidatura({ tokenHash: "hash" }, harness);
  assert.equal(result.status, 410);
  assert.equal(harness.calls.emails, 0);
  assert.equal(harness.calls.load, 0);
});

test("duas chamadas concorrentes: só o claim adquirido envia e-mails", async () => {
  const first = deps();
  const second = deps({
    claim: async () => ({ resultado: "em_processamento", token_id: "tok-1", interesse_id: "int-1" }),
  });
  const [a, b] = await Promise.all([
    runConclusaoCandidatura({ tokenHash: "hash" }, first),
    runConclusaoCandidatura({ tokenHash: "hash" }, second),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 409);
  assert.equal(first.calls.emails, 1);
  assert.equal(second.calls.emails, 0);
  assert.equal(first.calls.emails + second.calls.emails, 1);
});

test("falha antes do claim permite retry", async () => {
  const harness = deps({
    claim: async () => null,
  });
  const result = await runConclusaoCandidatura({ tokenHash: "hash" }, harness);
  assert.equal(result.status, 410);
  assert.equal(harness.calls.emails, 0);
  assert.equal(harness.calls.finalize, 0);
});

test("erro operacional no claim devolve 500 e não consome o token", async () => {
  const harness = deps({
    claim: async () => {
      throw new Error("claim");
    },
  });
  const result = await runConclusaoCandidatura({ tokenHash: "hash" }, harness);
  assert.equal(result.status, 500);
  assert.equal(harness.calls.emails, 0);
  assert.equal(harness.calls.finalize, 0);
  assert.equal(harness.calls.release, 0);
});

test("falha depois do claim e antes do efeito externo libera o lease", async () => {
  const harness = deps({
    loadDossie: async () => ({ ok: false, status: 500, error: "Não foi possível montar o dossiê." }),
  });
  const result = await runConclusaoCandidatura({ tokenHash: "hash" }, harness);
  assert.equal(result.status, 500);
  assert.equal(harness.calls.release, 1);
  assert.equal(harness.calls.emails, 0);
  assert.equal(harness.calls.finalize, 0);
});

test("erro de persistência final não é ignorado", async () => {
  const harness = deps({
    finalize: async () => {
      harness.calls.finalize += 1;
      return false;
    },
  });
  const result = await runConclusaoCandidatura({ tokenHash: "hash" }, harness);
  assert.equal(result.status, 500);
  assert.equal(result.body.ok, false);
  assert.equal(harness.calls.emails, 1);
  assert.equal(harness.calls.finalize, 1);
});

test("exceção no envio ainda tenta persistir o estado final", async () => {
  const harness = deps({
    enviarEmails: async () => {
      harness.calls.emails += 1;
      throw new Error("smtp");
    },
  });
  const result = await runConclusaoCandidatura({ tokenHash: "hash" }, harness);
  assert.equal(result.status, 200);
  assert.equal(harness.calls.finalize, 1);
  assert.equal(result.body.secretaryEmailSent, false);
});

test("falha de loader em cada dependência não envia dossiê", async () => {
  for (const dependencia of ["filhos", "referencias", "comercial", "proponente", "documentos"]) {
    const results = {
      interesse: { data: { id: "int-1" } },
      filhos: { data: [] },
      referencias: { data: [] },
      comercial: { data: null },
      proponente: { data: { nome: "Irmão" } },
      documentos: { data: [] },
    };
    results[dependencia] = { error: { code: "XX000" } };
    const harness = deps({
      loadDossie: async () => {
        harness.calls.load += 1;
        const evaluated = evaluateDossieQueries(results);
        return { ok: false, status: 500, error: "Não foi possível montar o dossiê.", dependencia: evaluated.dependencia };
      },
    });
    const result = await runConclusaoCandidatura({ tokenHash: "hash" }, harness);
    assert.equal(result.status, 500, dependencia);
    assert.equal(harness.calls.emails, 0, dependencia);
    assert.equal(harness.calls.release, 1, dependencia);
    assert.equal(harness.calls.finalize, 0, dependencia);
  }
});

test("claim interpreta estados sem depender de posição no source", () => {
  assert.deepEqual(interpretClaimRow({ resultado: "adquirido", token_id: "t", interesse_id: "i" }), {
    kind: "adquirido",
    tokenId: "t",
    interesseId: "i",
  });
  assert.equal(responseForClaim("concluido").status, 410);
  assert.equal(responseForClaim("em_processamento").status, 409);
  assert.equal(responseForClaim("indisponivel").status, 410);
});

test("fail-closed: erro de consulta não vira coleção vazia", () => {
  const dependencias = ["filhos", "referencias", "comercial", "proponente", "documentos"];
  for (const dependencia of dependencias) {
    const results = {
      interesse: { data: { id: "int-1", proponente_id: "p1" } },
      filhos: { data: [] },
      referencias: { data: [] },
      comercial: { data: null },
      proponente: { data: { id: "p1", nome: "Irmão" } },
      documentos: { data: [] },
    };
    results[dependencia] = { error: { code: "XX000" } };
    const evaluated = evaluateDossieQueries(results);
    assert.equal(evaluated.ok, false, dependencia);
    assert.equal(evaluated.dependencia, dependencia);
    assert.equal(Array.isArray(evaluated.filhos), false);
  }
});

test("consulta bem-sucedida com zero filhos é ausência legítima", () => {
  const evaluated = evaluateDossieQueries({
    interesse: { data: { id: "int-1" } },
    filhos: { data: [] },
    referencias: { data: [{ ordem: 1, nome: "Ref" }] },
    comercial: { data: null },
    proponente: { data: { nome: "Irmão" } },
    documentos: { data: [] },
  });
  assert.equal(evaluated.ok, true);
  assert.deepEqual(evaluated.filhos, []);
});

test("erro de signed URL não é tratado como documento sem link", () => {
  assert.deepEqual(evaluateSignedUrl({ error: { statusCode: "404" } }), { ok: false, dependencia: "signed_url" });
  assert.deepEqual(evaluateSignedUrl({ data: {} }), { ok: false, dependencia: "signed_url" });
  assert.deepEqual(evaluateSignedUrl({ data: { signedUrl: "https://signed.example/x" } }), {
    ok: true,
    url: "https://signed.example/x",
  });
});

test("loader e conclusão usam claim/finalize e o reenvio administrativo não consome used_at", () => {
  const registrar = read("supabase/functions/registrar-interesse/index.ts");
  const loader = read("supabase/functions/_shared/dossie-secretaria.ts");
  const reenvio = read("supabase/functions/reenviar-dossie-secretaria/index.ts");
  assert.match(registrar, /claim_conclusao_candidatura/);
  assert.match(registrar, /finalize_conclusao_candidatura/);
  assert.match(registrar, /release_conclusao_claim/);
  assert.match(loader, /evaluateDossieQueries/);
  assert.match(reenvio, /sendSecretarioEmail/);
  assert.doesNotMatch(reenvio, /sendProponenteEmail/);
  assert.doesNotMatch(reenvio, /claim_conclusao_candidatura/);
  assert.doesNotMatch(reenvio, /used_at/);
});
