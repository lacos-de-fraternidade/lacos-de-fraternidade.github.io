import { requiredDocumentTypes } from "./candidatura.ts";
import { evaluateDossieQueries, evaluateSignedUrl } from "./conclusao-candidatura.js";
import { DOC_SIGNED_URL_TTL_SECONDS, documentoDownloadName, inspectDossieCompleteness, resolveProponenteFromLookups } from "./email-dossie.js";

type QueryClient = {
  from: (table: string) => any;
  rpc?: (fn: string, args?: Record<string, unknown>) => Promise<any>;
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
        options?: { download?: boolean | string },
      ) => Promise<any>;
    };
  };
};

function consultaFalhou(dependencia: string, code?: string) {
  console.error("dossie consulta", { dependencia, code: code || "erro" });
  return { ok: false as const, error: "Não foi possível montar o dossiê.", status: 500 };
}

export async function loadCandidaturaDossie(supabase: QueryClient, interesseId: string) {
  const interesseRes = await supabase.from("interesse").select("*").eq("id", interesseId).maybeSingle();
  const [filhosRes, referenciasRes, comercialRes, irmaoRes, docsRes] = await Promise.all([
    supabase.from("interesse_filhos").select("nome, sexo, data_nascimento, ordem").eq("interesse_id", interesseId).order("ordem"),
    supabase.from("interesse_referencias").select("ordem, nome, telefone, logradouro, bairro, cidade, estado, cep").eq("interesse_id", interesseId).order("ordem"),
    supabase.from("interesse_referencia_comercial").select("razao_social, telefone, logradouro, bairro, cidade, estado, cep").eq("interesse_id", interesseId).maybeSingle(),
    supabase.from("irmaos").select("id, nome, email, auth_member_id").eq("id", interesseRes.data?.proponente_id).maybeSingle(),
    supabase.from("interesse_documentos").select("tipo, storage_path, mime, tamanho, nome_original").eq("interesse_id", interesseId),
  ]);

  const assembled = evaluateDossieQueries({
    interesse: interesseRes,
    filhos: filhosRes,
    referencias: referenciasRes,
    comercial: comercialRes,
    proponente: irmaoRes,
    documentos: docsRes,
  });
  if (!assembled.ok && assembled.notFound) return { ok: false as const, error: "Cadastro não encontrado.", status: 404 };
  if (!assembled.ok) return consultaFalhou(assembled.dependencia || "dossie", interesseRes.error?.code);

  const interesse = assembled.interesse;
  const prefixo = `${interesseId}/`;
  const documentosProprios = assembled.documentos.filter((row: { storage_path?: string }) => String(row.storage_path || "").startsWith(prefixo));
  const signedByPath = new Map<string, string>();
  for (const row of documentosProprios as { tipo: string; nome_original: string; storage_path: string }[]) {
    const filename = documentoDownloadName(row.tipo, row.nome_original, row.storage_path);
    const signed = await supabase.storage
      .from("candidaturas-documentos")
      .createSignedUrl(row.storage_path, DOC_SIGNED_URL_TTL_SECONDS, { download: filename });
    const evaluated = evaluateSignedUrl(signed);
    if (!evaluated.ok) return consultaFalhou("signed_url", signed.error?.statusCode);
    signedByPath.set(row.storage_path, evaluated.url);
  }

  const payload = {
    interesse,
    proponenteNome: assembled.proponente?.nome || null,
    filhos: assembled.filhos,
    referencias: assembled.referencias,
    comercial: assembled.comercial || null,
    documentos: documentosProprios.map((row: { tipo: string; nome_original: string; mime: string; tamanho: number; storage_path: string }) => ({
      tipo: row.tipo,
      nome_original: row.nome_original,
      mime: row.mime,
      tamanho: row.tamanho,
      url: signedByPath.get(row.storage_path) || null,
    })),
  };

  const present = new Set(documentosProprios.map((row: { tipo: string }) => row.tipo));
  const missingDocumentos = requiredDocumentTypes(String(interesse.estado_civil || "")).filter((tipo) => !present.has(tipo));

  return {
    ok: true as const,
    payload,
    irmao: assembled.proponente || null,
    missingDocumentos,
    inspecao: inspectDossieCompleteness(payload),
  };
}

export async function resolveProponenteEmail(
  supabase: QueryClient,
  irmao: { id?: string; email?: string | null; auth_member_id?: string | null } | null,
) {
  if (!irmao?.id) return resolveProponenteFromLookups({});

  let auth: { email?: string; error?: boolean } | undefined;
  if (irmao.auth_member_id) {
    const { data, error } = await supabase
      .from("irmaos_autorizados")
      .select("email")
      .eq("id", irmao.auth_member_id)
      .maybeSingle();
    if (error) {
      console.error("proponente email consulta", error.code || "erro");
      return resolveProponenteFromLookups({ auth: { error: true }, irmaoEmail: irmao.email });
    }
    auth = { email: String(data?.email || "") };
    const first = resolveProponenteFromLookups({ auth, irmaoEmail: "" });
    if (first.email) return first;
  }

  const { data: vinculo, error: vinculoError } = await supabase
    .from("irmaos_autorizados")
    .select("email")
    .eq("irmao_id", irmao.id)
    .maybeSingle();
  if (vinculoError) {
    console.error("proponente email consulta", vinculoError.code || "erro");
    return resolveProponenteFromLookups({ auth, vinculo: { error: true }, irmaoEmail: irmao.email });
  }

  return resolveProponenteFromLookups({
    auth,
    vinculo: { email: vinculo?.email },
    irmaoEmail: irmao.email,
  });
}
