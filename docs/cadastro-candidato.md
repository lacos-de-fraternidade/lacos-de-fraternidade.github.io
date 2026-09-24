# Cadastro do candidato — Pré-Proposta / Proposta de Admissão

Feature `17tgmdxhm19`. Evolui o cadastro público existente (`interesse.html` + `registrar-interesse`). Não cria um segundo formulário.

## Ainda não executar no remoto

Esta entrega **não** aplica nada no projeto Supabase de produção. Depois da autorização:

1. `supabase db push` (ou o fluxo de migration adotado) para `20260916180000_cadastro_candidato_admissao.sql`
2. Deploy das Edge Functions:
   - `registrar-interesse` (alterada)
   - `buscar-proponente` (nova)
   - `enviar-documento-candidatura` (nova)
   - `reenviar-dossie-secretaria` (administrativa, `verify_jwt = true`; só após autorização explícita)
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
- Sem URL pública permanente. O e-mail da Secretaria recebe signed URLs temporárias (`createSignedUrl` com `download` e nome operacional do tipo + extensão, TTL de 7 dias) só dos arquivos daquela candidatura (`<interesse_id>/...`).
- O bucket `candidaturas-documentos` permanece privado. Signed URLs não são gravadas em log. O CTA do dossiê é **Baixar documento**.
- Token da cartilha **não** autoriza documento de candidatura.

## E-mail da Secretaria

O e-mail final da Secretaria é o dossiê operacional da candidatura. Coleções são lidas com `interesse_id` daquela conclusão. O dossiê inclui identificação (sem CPF/RG), filiação, contatos, endereço residencial, família aplicável (sem datas de casamento/nascimento da esposa), nomes dos filhos, escolaridade, dados profissionais operacionais, proponente (somente o nome), referências pessoais, referência comercial quando houver, motivação, protocolo/status e documentos com signed URL de download.

Não entram no e-mail — embora continuem sendo coletados e persistidos — CPF, RG, órgão expedidor, expedição do RG, data de casamento, nascimento da esposa/companheira, sexo e nascimento dos filhos, tipo sanguíneo, plano de saúde, tratamento de saúde, renda mensal, renda familiar, dados militares, processo criminal, filiação partidária e entidades.

O e-mail do proponente permanece só a notificação mínima de indicação. Não leva o dossiê. O endereço é resolvido primeiro em `irmaos_autorizados` (e-mail do acesso Myosotis) e só depois em `irmaos.email`. Se uma estratégia já encontrou um endereço válido, a consulta seguinte não é executada e não pode invalidá-lo. O envio só é sucesso quando o SMTP institucional aceita a mensagem; caso contrário a conclusão grava `notificacao_proponente = falha`. Erro de consulta não vira `sem_email`.

Uma candidatura já concluída pode gerar de novo o dossiê atual pela Edge Function administrativa `reenviar-dossie-secretaria` (`verify_jwt = true`, staff ativo). A operação só lê os dados persistidos, emite novas signed URLs e reenvia à Secretaria pelo mesmo helper SMTP. Não reabre a candidatura, não altera `used_at`/`status`, não duplica coleções e não notifica o proponente.

## Infraestrutura de e-mail

Há um único provedor: Gmail SMTP institucional (`smtp.gmail.com:587`, STARTTLS). Duas integrações conforme a finalidade:

| Finalidade | Integração | Transporte |
| --- | --- | --- |
| Convite e recuperação da Área dos Irmãos | Supabase Auth | `inviteUserByEmail` / recovery do Auth |
| Dossiê da Secretaria, aviso do proponente e reenvio administrativo | Edge Functions | helper SMTP compartilhado (`smtp-mail.js` + `email.ts`) |

Não alterar o fluxo de convites. `sendMemberInvite()` continua usando `supabase.auth.admin.inviteUserByEmail(...)`.

Secrets das Edge Functions (nunca no Git, `config.toml`, migration, fixture ou log):

| Secret | Obrigatório | Default seguro |
| --- | --- | --- |
| `SMTP_HOST` | Não | `smtp.gmail.com` |
| `SMTP_PORT` | Não | `587` |
| `SMTP_USER` | Não | Gmail institucional da Loja |
| `SMTP_PASS` | **Sim** | nenhum |
| `SMTP_SENDER_NAME` | Não | `ARLS Laços de Fraternidade` |

Sem `SMTP_PASS` o envio falha de forma explícita. Senha real não é documentada.

Configuração posterior (não executar nesta entrega):

```text
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=<gmail institucional>
supabase secrets set SMTP_PASS=<senha de aplicativo>
supabase secrets set SMTP_SENDER_NAME="ARLS Laços de Fraternidade"
```

Não usar `supabase config pull` / `config push` só para copiar SMTP do Auth.

## Limite de upload

O teto é `MAX_DOC_MB` em `supabase/functions/_shared/candidatura.ts` e `maxDocMb` em `config.js`. Hoje vale **5 MB**. Alterar esses dois pontos (e o `file_size_limit` do bucket, se for o caso) basta para uma futura mudança para 10 MB.

## Comprovante de residência

- Tipo documental `comprovante_residencia`. Obrigatório na V1, mesmos MIME e tamanho dos demais. Não há recorte institucional de 30/60/90 dias nesta entrega.
- A migration incremental `20260916213000_comprovante_residencia.sql` precisa estar **aplicada no banco local** (`npx supabase migration up --local`) antes do smoke. Sem ela, o CHECK original rejeita o INSERT após o upload no Storage.

## Profissão e ocupação

A ficha pública desta V1 tem um único campo **Profissão**. A coluna `ocupacao` permanece no banco; o backend copia `profissao` quando `ocupacao` não vem preenchida.

## Plano de saúde

Checkbox **Não possuo plano de saúde** grava `plano_saude = 'nao_possui'`. O backend aceita o checkbox ou esse valor sentinela.
