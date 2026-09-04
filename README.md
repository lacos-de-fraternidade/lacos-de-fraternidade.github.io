# Laços de Fraternidade

Site institucional estático no GitHub Pages, com o Cadastro do candidato processado pelo Supabase.

Fluxo público: `index.html` → `interesse.html` → backend → `confirmacao.html`.

A Área dos Irmãos (`/area-restrita/`) autentica por CIM e senha. Guia operacional: [docs/area-dos-irmaos.md](docs/area-dos-irmaos.md).

## Executar localmente

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080` e `http://localhost:8080/area-restrita/login/`.

## Testes

```bash
node --test
```

Não há `package.json`. Os testes usam apenas a biblioteca padrão do Node.

O GitHub Actions (`CI`) roda em pull requests e pushes para `main`, só com a stack local:

1. `supabase start`
2. `INTEGRATION_DB=1 node --test` — inclui CONC01/CONC02; falha se o Postgres local (`127.0.0.1:54322`) não estiver no ar
3. `supabase test db --local`

O runner usa Node 22 LTS. Não há versão formal no repositório; a máquina local atual está em Node 24 e os testes dependem só de APIs estáveis do Node.

`AUTH_INTEGRATION` continua fora deste pipeline inicial. Ela exige um projeto de teste dedicado, não o remoto de produção.

## Supabase

1. Execute `supabase/setup.sql` e `supabase/migrate_interesse.sql`.
2. Publique as functions `registrar-interesse` e `abrir-cartilha` com JWT desligado.
3. Mantenha a chave `service_role` apenas no servidor.

A idade mínima e os limites da motivação ficam em `config.js` e em `supabase/functions/_shared/validation.ts`.
