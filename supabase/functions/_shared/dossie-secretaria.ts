import { requiredDocumentTypes } from "./candidatura.ts";
import { DOC_SIGNED_URL_TTL_SECONDS, documentoDownloadName, inspectDossieCompleteness, pickProponenteEmail } from "./email-dossie.js";

type QueryClient = {
  from: (table: string) => any;
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

export async function loadCandidaturaDossie(supabase: QueryClient, interesseId: string) {
  const { data: interesse } = await supabase
    .from("interesse")
    .select("*")
    .eq("id", interesseId)
    .maybeSingle();
  if (!interesse) return { ok: false as const, error: "Cadastro não encontrado." };

  const [{ data: filhos }, { data: referencias }, { data: comercial }, { data: irmao }, { data: docs }] = await Promise.all([
    supabase.from("interesse_filhos").select("nome, sexo, data_nascimento, ordem").eq("interesse_id", interesseId).order("ordem"),
    supabase.from("interesse_referencias").select("ordem, nome, telefone, logradouro, bairro, cidade, estado, cep").eq("interesse_id", interesseId).order("ordem"),
    supabase.from("interesse_referencia_comercial").select("razao_social, telefone, logradouro, bairro, cidade, estado, cep").eq("interesse_id", interesseId).maybeSingle(),
    supabase.from("irmaos").select("id, nome, email, auth_member_id").eq("id", interesse.proponente_id).maybeSingle(),
    supabase.from("interesse_documentos").select("tipo, storage_path, mime, tamanho, nome_original").eq("interesse_id", interesseId),
  ]);

  const prefixo = `${interesseId}/`;
  const documentosProprios = (docs || []).filter((row: { storage_path?: string }) => String(row.storage_path || "").startsWith(prefixo));
  let signedByPath = new Map<string, string>();
  if (documentosProprios.length) {
    const signedEntries = await Promise.all(
      documentosProprios.map(async (row: { tipo: string; nome_original: string; storage_path: string }) => {
        const filename = documentoDownloadName(row.tipo, row.nome_original, row.storage_path);
        const { data, error } = await supabase.storage
          .from("candidaturas-documentos")
          .createSignedUrl(row.storage_path, DOC_SIGNED_URL_TTL_SECONDS, { download: filename });
        if (error) console.error("candidaturas-documentos signed-url", error.statusCode || "erro");
        return [row.storage_path, data?.signedUrl || null] as const;
      }),
    );
    signedByPath = new Map(signedEntries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
  }

  const payload = {
    interesse,
    proponenteNome: irmao?.nome || null,
    filhos: filhos || [],
    referencias: referencias || [],
    comercial: comercial || null,
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
    irmao: irmao || null,
    missingDocumentos,
    inspecao: inspectDossieCompleteness(payload),
  };
}

export async function resolveProponenteEmail(
  supabase: QueryClient,
  irmao: { id?: string; email?: string | null; auth_member_id?: string | null } | null,
) {
  if (!irmao?.id) return { ok: true as const, email: "", source: "ausente" };

  let authEmail = "";
  if (irmao.auth_member_id) {
    const { data, error } = await supabase
      .from("irmaos_autorizados")
      .select("email")
      .eq("id", irmao.auth_member_id)
      .maybeSingle();
    if (error) {
      console.error("proponente email consulta", error.code || "erro");
      return { ok: false as const, email: "", source: "erro_consulta" };
    }
    authEmail = String(data?.email || "");
  }

  const { data: vinculo, error: vinculoError } = await supabase
    .from("irmaos_autorizados")
    .select("email")
    .eq("irmao_id", irmao.id)
    .maybeSingle();
  if (vinculoError) {
    console.error("proponente email consulta", vinculoError.code || "erro");
    return { ok: false as const, email: "", source: "erro_consulta" };
  }

  return {
    ok: true as const,
    ...pickProponenteEmail({
      irmaoEmail: irmao.email,
      authEmail,
      vinculoEmail: vinculo?.email,
    }),
  };
}
