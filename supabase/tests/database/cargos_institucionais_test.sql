-- Regression runtime: cargos institucionais (story 86akaedej).
-- Roda só no Postgres local via `npx supabase test db --local`.
-- Transação + rollback: não persiste massa.

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

create temp table suite_ids (
  papel text primary key,
  auth_id uuid,
  irmao_id uuid not null,
  acesso_id uuid
);

insert into suite_ids (papel, auth_id, irmao_id, acesso_id) values
  ('administrador',    '86923001-0000-4000-8000-000000000001', '86923001-0000-4000-8000-000000000011', '86923001-0000-4000-8000-000000000021'),
  ('secretario',       '86923001-0000-4000-8000-000000000002', '86923001-0000-4000-8000-000000000012', '86923001-0000-4000-8000-000000000022'),
  ('veneravel_mestre', '86923001-0000-4000-8000-000000000003', '86923001-0000-4000-8000-000000000013', '86923001-0000-4000-8000-000000000023'),
  ('ativo_a',          '86923001-0000-4000-8000-000000000004', '86923001-0000-4000-8000-000000000014', '86923001-0000-4000-8000-000000000024'),
  ('ativo_b',          null,                                  '86923001-0000-4000-8000-000000000015', null),
  ('inativo',          null,                                  '86923001-0000-4000-8000-000000000016', null),
  ('catalogo',         null,                                  '86923001-0000-4000-8000-000000000017', null),
  ('gemeo_a',          null,                                  '86923001-0000-4000-8000-000000000018', null),
  ('gemeo_b',          null,                                  '86923001-0000-4000-8000-000000000019', null);

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  s.auth_id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '86akaedej-' || s.papel || '@test.local',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from suite_ids s
where s.auth_id is not null;

insert into public.irmaos (id, nome, cim, situacao, origem)
select
  s.irmao_id,
  '86akaedej ' || s.papel,
  lpad((86923010 + row_number() over (order by s.papel))::text, 8, '0'),
  case when s.papel = 'inativo' then 'inativo' else 'ativo' end,
  'teste'
from suite_ids s;

insert into public.irmaos_autorizados (
  id, cim, nome, email, perfil, ativo, conta_ativada, auth_user_id, irmao_id
)
select
  s.acesso_id,
  i.cim,
  i.nome,
  '86akaedej-' || s.papel || '@test.local',
  case when s.papel = 'ativo_a' then 'irmao' else s.papel end,
  true,
  true,
  s.auth_id,
  s.irmao_id
from suite_ids s
join public.irmaos i on i.id = s.irmao_id
where s.acesso_id is not null
  and s.papel in ('administrador', 'secretario', 'veneravel_mestre', 'ativo_a');

-- DB17 primeiro: ausência de VM institucional é estado válido.
select is(
  (select count(*)::int from public.veneravel_mestre_vigente()),
  0,
  'DB17 zero Venerável Mestre institucional vigente é estado válido'
);

select lives_ok(
  $sql$
  do $seed$
  declare
    cargos text[] := array[
      'veneravel_mestre',
      'primeiro_vigilante',
      'segundo_vigilante',
      'orador',
      'secretario',
      'tesoureiro',
      'chanceler',
      'hospitaleiro',
      'mestre_cerimonias',
      'primeiro_diacono',
      'segundo_diacono',
      'primeiro_experto',
      'segundo_experto',
      'cobridor_interno',
      'cobridor_externo',
      'mestre_harmonia',
      'mestre_banquetes'
    ];
    c text;
    alvo uuid := '86923001-0000-4000-8000-000000000017';
  begin
    foreach c in array cargos loop
      insert into public.irmaos_cargos (irmao_id, cargo, encerrado_em)
      values (alvo, c, now());
    end loop;
  end
  $seed$;
  $sql$,
  'DB14 catálogo oficial aceita exatamente os 17 cargos institucionais'
);

select throws_ok(
  $sql$
  insert into public.irmaos_cargos (irmao_id, cargo, encerrado_em)
  values ('86923001-0000-4000-8000-000000000017', 'porta_bandeira', now())
  $sql$,
  '23514',
  'new row for relation "irmaos_cargos" violates check constraint "irmaos_cargos_cargo_check"',
  'DB14 rejeita cargo institucional arbitrário (porta_bandeira)'
);

insert into public.irmaos_cargos (irmao_id, cargo)
values ('86923001-0000-4000-8000-000000000018', 'orador');

select throws_ok(
  $sql$
  insert into public.irmaos_cargos (irmao_id, cargo)
  values ('86923001-0000-4000-8000-000000000018', 'hospitaleiro')
  $sql$,
  '23505',
  'duplicate key value violates unique constraint "irmaos_cargos_irmao_vigente_key"',
  'DB15 storage impede dois cargos vigentes no mesmo irmao_id'
);

insert into public.irmaos_cargos (irmao_id, cargo)
values ('86923001-0000-4000-8000-000000000019', 'hospitaleiro');

select throws_ok(
  $sql$
  insert into public.irmaos_cargos (irmao_id, cargo)
  values ('86923001-0000-4000-8000-000000000017', 'hospitaleiro')
  $sql$,
  '23505',
  'duplicate key value violates unique constraint "irmaos_cargos_cargo_vigente_key"',
  'DB16 storage impede dois ocupantes vigentes no mesmo cargo'
);

select is(
  public.atribuir_cargo_institucional(
    (select irmao_id from suite_ids where papel = 'ativo_a'),
    'tesoureiro',
    (select auth_id from suite_ids where papel = 'secretario'),
    'DB01'
  ),
  '{"ok":true,"cargo":"tesoureiro","irmao_id":"86923001-0000-4000-8000-000000000014"}'::jsonb,
  'DB01 secretario atribui tesoureiro a irmão ativo'
);

select is(
  public.atribuir_cargo_institucional(
    (select irmao_id from suite_ids where papel = 'ativo_a'),
    'tesoureiro',
    (select auth_id from suite_ids where papel = 'secretario'),
    'DB02'
  ),
  jsonb_build_object('ok', false, 'status', 400, 'error', 'Este Irmão já exerce este cargo.'),
  'DB02 repetir o mesmo cargo no mesmo irmão retorna 400'
);

select is(
  (public.atribuir_cargo_institucional(
    (select irmao_id from suite_ids where papel = 'ativo_b'),
    'veneravel_mestre',
    (select auth_id from suite_ids where papel = 'secretario'),
    'DB03'
  )->>'status')::int,
  403,
  'DB03 secretario não atribui o cargo institucional veneravel_mestre'
);

select is(
  (public.atribuir_cargo_institucional(
    (select irmao_id from suite_ids where papel = 'ativo_b'),
    'chanceler',
    (select auth_id from suite_ids where papel = 'veneravel_mestre'),
    'DB04'
  )->>'ok')::boolean,
  true,
  'DB04 perfil veneravel_mestre atribui cargo comum (chanceler)'
);

select is(
  (public.atribuir_cargo_institucional(
    (select irmao_id from suite_ids where papel = 'ativo_b'),
    'veneravel_mestre',
    (select auth_id from suite_ids where papel = 'veneravel_mestre'),
    'DB05'
  )->>'status')::int,
  403,
  'DB05 perfil veneravel_mestre não administra o cargo institucional veneravel_mestre'
);

select is(
  public.atribuir_cargo_institucional(
    (select irmao_id from suite_ids where papel = 'ativo_a'),
    'veneravel_mestre',
    (select auth_id from suite_ids where papel = 'administrador'),
    'DB06'
  ),
  '{"ok":true,"cargo":"veneravel_mestre","irmao_id":"86923001-0000-4000-8000-000000000014"}'::jsonb,
  'DB06 administrador atribui veneravel_mestre institucional mesmo com outro cargo vigente'
);

select ok(
  exists (
    select 1
    from public.irmaos_cargos
    where irmao_id = '86923001-0000-4000-8000-000000000014'
      and cargo = 'tesoureiro'
      and encerrado_em is not null
  )
  and exists (
    select 1
    from public.irmaos_cargos
    where irmao_id = '86923001-0000-4000-8000-000000000014'
      and cargo = 'veneravel_mestre'
      and encerrado_em is null
  ),
  'DB06 RPC encerra o cargo anterior e deixa só veneravel_mestre vigente'
);

select is(
  (public.atribuir_cargo_institucional(
    (select irmao_id from suite_ids where papel = 'inativo'),
    'orador',
    (select auth_id from suite_ids where papel = 'administrador'),
    'DB07'
  )->>'status')::int,
  400,
  'DB07 não atribui cargo institucional a irmão que não está ativo'
);

select is(
  (public.encerrar_cargo_institucional(
    (select irmao_id from suite_ids where papel = 'ativo_a'),
    (select auth_id from suite_ids where papel = 'secretario'),
    'DB08'
  )->>'status')::int,
  403,
  'DB08 secretario não encerra o cargo institucional veneravel_mestre'
);

select results_eq(
  $$
  select irmao_id, cargo, situacao
  from public.veneravel_mestre_vigente()
  $$,
  $$
  values (
    '86923001-0000-4000-8000-000000000014'::uuid,
    'veneravel_mestre',
    'ativo'
  )
  $$,
  'DB09 veneravel_mestre_vigente() devolve o irmão ativo correto'
);

select is(
  (public.atualizar_situacao_irmao(
    (select irmao_id from suite_ids where papel = 'ativo_a'),
    'quiet_placet',
    (select auth_id from suite_ids where papel = 'administrador'),
    null
  )->>'ok')::boolean,
  true,
  'DB10 administrador altera o VM institucional para quiet_placet'
);

select is(
  (select count(*)::int from public.veneravel_mestre_vigente()),
  0,
  'DB11 depois de quiet_placet não existe VM institucional vigente'
);

select ok(
  exists (
    select 1
    from public.irmaos_cargos
    where irmao_id = '86923001-0000-4000-8000-000000000014'
      and cargo = 'veneravel_mestre'
      and encerrado_em is not null
  )
  and not exists (
    select 1
    from public.irmaos_cargos
    where irmao_id = '86923001-0000-4000-8000-000000000014'
      and encerrado_em is null
  ),
  'DB12 cargo do ex-VM fica encerrado e sem mandato vigente'
);

select is(
  (
    select criado_por
    from public.irmaos_historico
    where irmao_id = '86923001-0000-4000-8000-000000000014'
      and evento = 'cargo_atribuido'
      and detalhe = 'DB01'
    order by criado_em
    limit 1
  ),
  '86923001-0000-4000-8000-000000000002'::uuid,
  'DB13 cargo_atribuido pelo secretario preserva criado_por'
);

select is(
  (
    select criado_por
    from public.irmaos_historico
    where irmao_id = '86923001-0000-4000-8000-000000000015'
      and evento = 'cargo_atribuido'
      and detalhe = 'DB04'
    order by criado_em
    limit 1
  ),
  '86923001-0000-4000-8000-000000000003'::uuid,
  'DB13 cargo_atribuido pelo perfil veneravel_mestre preserva criado_por'
);

select ok(
  exists (
    select 1
    from public.irmaos_historico
    where irmao_id = '86923001-0000-4000-8000-000000000014'
      and evento = 'cargo_encerrado'
      and detalhe = 'DB06'
      and criado_por = '86923001-0000-4000-8000-000000000001'
  )
  and exists (
    select 1
    from public.irmaos_historico
    where irmao_id = '86923001-0000-4000-8000-000000000014'
      and evento = 'cargo_atribuido'
      and detalhe = 'DB06'
      and criado_por = '86923001-0000-4000-8000-000000000001'
  ),
  'DB13 substituição pelo administrador registra cargo_encerrado e cargo_atribuido com o ator correto'
);

select ok(
  exists (
    select 1
    from public.irmaos_historico
    where irmao_id = '86923001-0000-4000-8000-000000000014'
      and evento = 'cargo_encerrado'
      and detalhe = 'Encerramento automático (situacao=quiet_placet)'
      and criado_por = '86923001-0000-4000-8000-000000000001'
  ),
  'DB13 encerramento automático por quiet_placet preserva o ator administrador'
);

select * from finish();
rollback;
