/** Orquestração testável da conclusão pública. Sem I/O até receber dependências. */

export const CLAIM_LEASE_SECONDS = 120;

export function interpretClaimRow(row) {
  if (!row?.resultado || !row.token_id) return { kind: "indisponivel" };
  return {
    kind: row.resultado,
    tokenId: row.token_id,
    interesseId: row.interesse_id,
  };
}

export function responseForClaim(kind) {
  if (kind === "concluido" || kind === "indisponivel") {
    return {
      status: 410,
      body: { ok: false, error: "O envio expirou. Fale com a Secretaria se já enviou os dados." },
    };
  }
  if (kind === "em_processamento") {
    return {
      status: 409,
      body: { ok: false, error: "O cadastro já está sendo concluído." },
    };
  }
  return null;
}

export function interpretQuery(result, dependencia) {
  if (result?.error) return { ok: false, dependencia };
  return { ok: true, data: result?.data ?? null };
}

export function interpretCollection(result, dependencia) {
  const parsed = interpretQuery(result, dependencia);
  if (!parsed.ok) return parsed;
  return { ok: true, data: Array.isArray(parsed.data) ? parsed.data : [] };
}

export function evaluateDossieQueries(results) {
  const interesseQ = interpretQuery(results.interesse, "interesse");
  if (!interesseQ.ok) return { ok: false, dependencia: "interesse" };
  if (!interesseQ.data) return { ok: false, notFound: true };
  const parts = {
    filhos: interpretCollection(results.filhos, "filhos"),
    referencias: interpretCollection(results.referencias, "referencias"),
    comercial: interpretQuery(results.comercial, "comercial"),
    proponente: interpretQuery(results.proponente, "proponente"),
    documentos: interpretCollection(results.documentos, "documentos"),
  };
  const failed = Object.values(parts).find((item) => !item.ok);
  if (failed) return { ok: false, dependencia: failed.dependencia };
  return {
    ok: true,
    interesse: interesseQ.data,
    filhos: parts.filhos.data,
    referencias: parts.referencias.data,
    comercial: parts.comercial.data,
    proponente: parts.proponente.data,
    documentos: parts.documentos.data,
  };
}

export function evaluateSignedUrl(result) {
  if (result?.error || !result?.data?.signedUrl) return { ok: false, dependencia: "signed_url" };
  return { ok: true, url: result.data.signedUrl };
}

const OPERATIONAL_ERROR = {
  status: 500,
  body: { ok: false, error: "Não foi possível concluir o cadastro." },
};

export async function runConclusaoCandidatura(input, deps) {
  let claimed;
  try {
    claimed = interpretClaimRow(await deps.claim(input.tokenHash));
  } catch {
    return OPERATIONAL_ERROR;
  }
  const blocked = responseForClaim(claimed.kind);
  if (blocked) return blocked;
  if (claimed.kind !== "adquirido") {
    return { status: 410, body: { ok: false, error: "O envio expirou. Fale com a Secretaria se já enviou os dados." } };
  }

  let loaded;
  try {
    loaded = await deps.loadDossie(claimed.interesseId);
  } catch {
    await deps.release(claimed.tokenId);
    return OPERATIONAL_ERROR;
  }
  if (!loaded.ok) {
    await deps.release(claimed.tokenId);
    return { status: loaded.status || 500, body: { ok: false, error: loaded.error } };
  }
  if ((loaded.missingDocumentos || []).length) {
    await deps.release(claimed.tokenId);
    return {
      status: 422,
      body: {
        ok: false,
        error: "Há documentos obrigatórios pendentes.",
        documentosPendentes: loaded.missingDocumentos,
      },
    };
  }

  let cartilha = { token: null, expiresInMinutes: 10 };
  try {
    cartilha = await deps.criarCartilha(loaded.payload.interesse.id);
  } catch {
    await deps.release(claimed.tokenId);
    return OPERATIONAL_ERROR;
  }

  let emails = { secretaryEmailSent: false, proponenteNotificacao: "falha" };
  try {
    emails = await deps.enviarEmails(loaded);
  } catch {
    emails = { secretaryEmailSent: false, proponenteNotificacao: "falha" };
  }

  let finalized = false;
  try {
    finalized = await deps.finalize({
      tokenId: claimed.tokenId,
      interesseId: claimed.interesseId,
      notificacao: emails.proponenteNotificacao,
    });
  } catch {
    finalized = false;
  }
  if (!finalized) {
    return OPERATIONAL_ERROR;
  }

  return {
    status: 200,
    body: {
      ok: true,
      registrationSuccess: true,
      secretaryEmailSent: Boolean(emails.secretaryEmailSent),
      token: cartilha.token || null,
      expiresInMinutes: cartilha.expiresInMinutes || 10,
    },
  };
}
