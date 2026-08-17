# Laços de Fraternidade

Site institucional estático no GitHub Pages, com formulário de manifestação de interesse processado pelo Supabase.

Fluxo: `index.html` → `interesse.html` → backend → `confirmacao.html`.

## Executar localmente

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080`.

## Supabase

1. Execute `supabase/setup.sql` e `supabase/migrate_interesse.sql`.
2. Publique as functions `registrar-interesse` e `abrir-cartilha` com JWT desligado.
3. Mantenha a chave `service_role` apenas no servidor.

A idade mínima e os limites da motivação ficam em `config.js` e em `supabase/functions/_shared/validation.ts`.
