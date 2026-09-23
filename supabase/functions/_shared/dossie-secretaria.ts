import { requiredDocumentTypes } from "./candidatura.ts";
import { DOC_SIGNED_URL_TTL_SECONDS, inspectDossieCompleteness } from "./email-dossie.js";

type QueryClient = {
  from: (table: string) => any;
  storage: { from: (bucket: string) => { createSignedUrls: (paths: string[], expiresIn: number) => Promise<any> } };
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
    const { data: signed, error: signedError } = await supabase.storage
      .from("candidaturas-documentos")
      .createSignedUrls(
        documentosProprios.map((row: { storage_path: string }) => row.storage_path),
        DOC_SIGNED_URL_TTL_SECONDS,
      );
    if (signedError) console.error("candidaturas-documentos signed-url", signedError.statusCode || "erro");
    signedByPath = new Map(
      (signed || [])
        .filter((row: { path?: string; signedUrl?: string }) => row.path && row.signedUrl)
        .map((row: { path: string; signedUrl: string }) => [row.path, row.signedUrl]),
    );
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
