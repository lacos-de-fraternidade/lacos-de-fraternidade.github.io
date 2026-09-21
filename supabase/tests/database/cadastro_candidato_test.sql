-- Cadastro do candidato / proponente (story 17tgmdxhm19).
-- Roda só no Postgres local via `npx supabase test db --local`.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into public.irmaos (id, nome, cim, situacao, ativo, origem)
values
  ('17190001-0000-4000-8000-000000000001', 'PATRICK DE FARIAS SILVA', '17190001', 'ativo', true, 'teste'),
  ('17190001-0000-4000-8000-000000000002', 'PATRICIO ALVES TESTE', '17190002', 'ativo', true, 'teste'),
  ('17190001-0000-4000-8000-000000000003', 'IRMAO TRANSFERENCIA TESTE', '17190003', 'transferencia', true, 'teste'),
  ('17190001-0000-4000-8000-000000000004', 'IRMAO QUIET PLACET TESTE', '17190004', 'quiet_placet', true, 'teste'),
  ('17190001-0000-4000-8000-000000000005', 'IRMAO INATIVO TESTE', '17190005', 'inativo', false, 'teste')
on conflict (id) do update set
  nome = excluded.nome,
  cim = excluded.cim,
  situacao = excluded.situacao,
  ativo = excluded.ativo,
  origem = excluded.origem;

select ok(
  exists (
    select 1
    from public.buscar_proponentes_publicos('Patr')
    where nome = 'PATRICK DE FARIAS SILVA'
  ),
  'busca parcial Patr encontra Patrick'
);

select ok(
  exists (
    select 1
    from public.buscar_proponentes_publicos('Patri')
    where nome = 'PATRICK DE FARIAS SILVA'
  ),
  'busca parcial Patri encontra Patrick'
);

select ok(
  exists (
    select 1
    from public.buscar_proponentes_publicos('Patrique')
    where nome = 'PATRICK DE FARIAS SILVA'
  ),
  'tolerância de grafia Patrique sugere Patrick'
);

select is(
  (
    select count(*)::int
    from public.buscar_proponentes_publicos('Patr')
    where nome in ('IRMAO TRANSFERENCIA TESTE', 'IRMAO QUIET PLACET TESTE', 'IRMAO INATIVO TESTE')
  ),
  0,
  'transferência, quiet placet e inativo não aparecem'
);

select is_empty(
  $$select * from public.buscar_proponentes_publicos('Pat')$$,
  'menos de 4 caracteres não retorna resultados'
);

select ok(
  public.proponente_elegivel('17190001-0000-4000-8000-000000000001'),
  'irmão ativo/situação ativo é elegível'
);

select ok(
  not public.proponente_elegivel('17190001-0000-4000-8000-000000000003'),
  'UUID de irmão em transferência é rejeitado'
);

select ok(
  not public.proponente_elegivel('17190001-0000-4000-8000-000000000004'),
  'UUID de irmão em quiet placet é rejeitado'
);

select ok(
  not public.proponente_elegivel('17190001-0000-4000-8000-000000000099'),
  'UUID inexistente é rejeitado'
);

select ok(
  not has_function_privilege('anon', 'public.buscar_proponentes_publicos(text)', 'execute'),
  'anon não executa buscar_proponentes_publicos'
);

select ok(
  not has_function_privilege('authenticated', 'public.buscar_proponentes_publicos(text)', 'execute'),
  'authenticated não executa buscar_proponentes_publicos'
);

select ok(
  not has_table_privilege('anon', 'public.irmaos', 'select'),
  'anon não possui SELECT direto em irmaos'
);

select ok(
  not has_table_privilege('anon', 'public.interesse_documentos', 'select'),
  'anon não lê documentos da candidatura'
);

select is(
  (select public from storage.buckets where id = 'candidaturas-documentos'),
  false,
  'bucket candidaturas-documentos é privado'
);

select is(
  (select public from storage.buckets where id = 'cartilha'),
  false,
  'bucket cartilha permanece privado e separado'
);

select ok(
  (
    select count(*)::int = 0
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'interesse'
      and column_name = 'proponente_id'
      and is_nullable = 'NO'
  ),
  'proponente_id permanece anulável para registros legados'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'interesse_documentos_tipo_check'
  ) like '%comprovante_residencia%',
  'tipo documental inclui comprovante_residencia'
);

select * from finish();
rollback;
