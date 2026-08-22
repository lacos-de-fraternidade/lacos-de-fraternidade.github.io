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

## Supabase

1. Execute `supabase/setup.sql` e `supabase/migrate_interesse.sql`.
2. Publique as functions `registrar-interesse` e `abrir-cartilha` com JWT desligado.
3. Mantenha a chave `service_role` apenas no servidor.

A idade mínima e os limites da motivação ficam em `config.js` e em `supabase/functions/_shared/validation.ts`.
