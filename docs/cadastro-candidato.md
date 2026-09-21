# Cadastro do candidato — Pré-Proposta / Proposta de Admissão

Feature `17tgmdxhm19`. Evolui o cadastro público existente (`interesse.html` + `registrar-interesse`). Não cria um segundo formulário.

## Ainda não executar no remoto

Esta entrega **não** aplica nada no projeto Supabase de produção. Depois da autorização:

1. `supabase db push` (ou o fluxo de migration adotado) para `20260916180000_cadastro_candidato_admissao.sql`
2. Deploy das Edge Functions:
   - `registrar-interesse` (alterada)
   - `buscar-proponente` (nova)
   - `enviar-documento-candidatura` (nova)
3. O bucket privado `candidaturas-documentos` entra pela própria migration (5 MB, PDF/JPEG/PNG). **Não** reutilizar `cartilha`.

## Modelagem

- `interesse` permanece a candidatura. `proponente_id` aponta para `public.irmaos(id)` e **aceita NULL** no legado.
- Novas submissões exigem `proponente_id` no backend (`normalizeCandidatura` + `proponente_elegivel`).
- Coleções: `interesse_filhos`, `interesse_referencias` (1–3), `interesse_referencia_comercial`, `interesse_documentos`.
- Token de upload: `interesse_upload_token` (hash, expiração, uso único na conclusão).
- Condicionais inaplicáveis são gravadas como `null`/`false`/coleção vazia. O backend ignora dados de cônjuge, militar, processo e partido quando a condição é falsa.

## Busca do proponente

- Sem SELECT público em `irmaos`.
- Edge `buscar-proponente` + RPC `buscar_proponentes_publicos` (`SECURITY DEFINER`, `EXECUTE` só `service_role`).
- Retorno: `id` + `nome`. Mínimo 4 caracteres. Até 8 resultados.
- Elegibilidade: `ativo is true` e `situacao = 'ativo'`.
- Grafia: `LIKE` no `nome_normalizado`, prefixo do primeiro nome e `pg_trgm` (`word_similarity` / `similarity` ≥ 0.35).

## Documentos

- Path: `<interesse_uuid>/<documento_uuid>.<ext>`
- Sem URL pública. Visualização interna futura deve usar signed URL de curta duração via função autenticada de staff (fora desta entrega).
- Token da cartilha **não** autoriza documento de candidatura.

## Limite de upload

O teto é `MAX_DOC_MB` em `supabase/functions/_shared/candidatura.ts` e `maxDocMb` em `config.js`. Hoje vale **5 MB**. Alterar esses dois pontos (e o `file_size_limit` do bucket, se for o caso) basta para uma futura mudança para 10 MB.

## Comprovante de residência recente

- Tipo documental `comprovante_residencia`. Obrigatório na V1, mesmos MIME e tamanho dos demais. Não há recorte institucional de 30/60/90 dias nesta entrega.
- A migration incremental `20260916213000_comprovante_residencia.sql` precisa estar **aplicada no banco local** (`npx supabase migration up --local`) antes do smoke. Sem ela, o CHECK original rejeita o INSERT após o upload no Storage.

## Profissão e ocupação

A ficha pública desta V1 tem um único campo **Profissão**. A coluna `ocupacao` permanece no banco; o backend copia `profissao` quando `ocupacao` não vem preenchida.

## Plano de saúde

Checkbox **Não possuo plano de saúde** grava `plano_saude = 'nao_possui'`. O backend aceita o checkbox ou esse valor sentinela.
