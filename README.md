# Laços de Fraternidade

Landing page estática no GitHub Pages, com registro de interesse e liberação da cartilha pelo Supabase.

A cartilha não fica pública no site. O PDF só é entregue depois que o backend confirma o registro e gera um acesso temporário, exclusivo, com validade de 10 minutos e uso único.

## Executar localmente

Não há etapa de build. Na pasta do projeto:

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080`. Abrir o `index.html` direto pelo arquivo pode bloquear o envio ao Supabase.

## Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor, execute o arquivo `supabase/setup.sql`.
3. Em Storage, abra o bucket privado `cartilha` e envie o arquivo `assets/cartilha-do-candidato.pdf` com exatamente este nome: `cartilha-do-candidato.pdf`.
4. Em Project Settings > API, copie a URL e a chave anônima (`anon` / `public`) para `config.js`.
5. Publique as Edge Functions `registrar-interesse` e `abrir-cartilha` com verificação de JWT desligada, como em `supabase/config.toml`.

Com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db query --file supabase/setup.sql
supabase functions deploy registrar-interesse --no-verify-jwt
supabase functions deploy abrir-cartilha --no-verify-jwt
```

A chave `service_role` nunca deve ir para o site. As functions usam essa chave apenas no servidor do Supabase.

## Publicar no GitHub Pages

Publique os arquivos da raiz, incluindo `config.js` já preenchido. Não publique o PDF: ele deve permanecer só no Storage privado do Supabase. Se o arquivo ainda existir no repositório, remova-o para o endereço antigo deixar de funcionar.

## Privacidade

O formulário envia nome, CPF, e-mail e endereço para o Supabase. Essas tabelas estão com Row Level Security ativo e sem política de leitura para o público. O PDF fica em bucket privado. A página não guarda os dados no navegador após o envio.
