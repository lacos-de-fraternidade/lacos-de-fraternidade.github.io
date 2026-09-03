-- Regression runtime: RLS/GRANT de cargos institucionais (story 86akaedej).
-- Simula sessões authenticated reais. Roda só no Postgres local.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

create temp table suite_ids (
  papel text primary key,
  auth_id uuid,
  irmao_id uuid not null,
  acesso_id uuid
);

insert into suite_ids (papel, auth_id, irmao_id, acesso_id) values
  ('administrador',    '86923002-0000-4000-8000-000000000001', '86923002-0000-4000-8000-000000000011', '86923002-0000-4000-8000-000000000021'),
  ('secretario',       '86923002-0000-4000-8000-000000000002', '86923002-0000-4000-8000-000000000012', '86923002-0000-4000-8000-000000000022'),
  ('veneravel_mestre', '86923002-0000-4000-8000-000000000003', '86923002-0000-4000-8000-000000000013', '86923002-0000-4000-8000-000000000023'),
  ('irmao',            '86923002-0000-4000-8000-000000000004', '86923002-0000-4000-8000-000000000014', '86923002-0000-4000-8000-000000000024'),
  ('ativo_b',          null,                                  '86923002-0000-4000-8000-000000000015', null),
  ('inativo',          null,                                  '86923002-0000-4000-8000-000000000016', null);

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  s.auth_id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '86akaedej-rls-' || s.papel || '@test.local',
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
  '86akaedej rls ' || s.papel,
  lpad((86923020 + row_number() over (order by s.papel))::text, 8, '0'),
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
  '86akaedej-rls-' || s.papel || '@test.local',
  case when s.papel = 'irmao' then 'irmao' else s.papel end,
  true,
  true,
  s.auth_id,
  s.irmao_id
from suite_ids s
join public.irmaos i on i.id = s.irmao_id
where s.acesso_id is not null;

insert into public.irmaos_cargos (irmao_id, cargo, encerrado_em)
values
  ('86923002-0000-4000-8000-000000000014', 'tesoureiro', null),
  ('86923002-0000-4000-8000-000000000015', 'orador', now());

select ok(
  not has_function_privilege(
    'authenticated',
    'public.atribuir_cargo_institucional(uuid,text,uuid,text)',
    'execute'
  ),
  'RLS09 authenticated não possui EXECUTE em atribuir_cargo_institucional'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.encerrar_cargo_institucional(uuid,uuid,text)',
    'execute'
  ),
  'RLS10 authenticated não possui EXECUTE em encerrar_cargo_institucional'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.atualizar_situacao_irmao(uuid,text,uuid,boolean)',
    'execute'
  ),
  'RLS11 authenticated não possui EXECUTE em atualizar_situacao_irmao'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.veneravel_mestre_vigente()',
    'execute'
  ),
  'RLS12 authenticated possui EXECUTE em veneravel_mestre_vigente()'
);

reset role;
select set_config('request.jwt.claim.sub', '86923002-0000-4000-8000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86923002-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select id from public.irmaos_autorizados),
  '86923002-0000-4000-8000-000000000024'::uuid,
  'RLS01 irmão autenticado consulta exatamente o próprio perfil'
);

select is(
  (select count(*)::int from public.irmaos_autorizados),
  1,
  'RLS02 irmão comum não lista todos os registros de irmaos_autorizados'
);

select ok(
  (select count(*)::int from public.irmaos_cargos
    where irmao_id in (
      '86923002-0000-4000-8000-000000000014',
      '86923002-0000-4000-8000-000000000015'
    )) = 1
  and (select bool_and(encerrado_em is null) from public.irmaos_cargos
    where irmao_id in (
      '86923002-0000-4000-8000-000000000014',
      '86923002-0000-4000-8000-000000000015'
    )),
  'RLS03 irmão ativo consulta cargos vigentes e não vê histórico encerrado'
);

reset role;
select set_config('request.jwt.claim.sub', '86923002-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86923002-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*)::int
   from public.irmaos_autorizados
   where id in (
     '86923002-0000-4000-8000-000000000021',
     '86923002-0000-4000-8000-000000000022',
     '86923002-0000-4000-8000-000000000023',
     '86923002-0000-4000-8000-000000000024'
   )),
  4,
  'RLS04 secretario lista todos os membros autorizados da massa do teste'
);

select is(
  (select count(*)::int
   from public.irmaos_cargos
   where irmao_id in (
     '86923002-0000-4000-8000-000000000014',
     '86923002-0000-4000-8000-000000000015'
   )),
  2,
  'RLS05 secretario consulta histórico de cargos, inclusive encerrado'
);

reset role;
select set_config('request.jwt.claim.sub', '86923002-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86923002-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*)::int
   from public.irmaos_autorizados
   where id in (
     '86923002-0000-4000-8000-000000000021',
     '86923002-0000-4000-8000-000000000022',
     '86923002-0000-4000-8000-000000000023',
     '86923002-0000-4000-8000-000000000024'
   )),
  4,
  'RLS06 perfil veneravel_mestre herda RLS de staff e lista membros de gestão'
);

select is(
  (select count(*)::int
   from public.irmaos_cargos
   where irmao_id in (
     '86923002-0000-4000-8000-000000000014',
     '86923002-0000-4000-8000-000000000015'
   )),
  2,
  'RLS07 perfil veneravel_mestre consulta histórico de cargos'
);

reset role;
select set_config('request.jwt.claim.sub', '86923002-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86923002-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  (select count(*)::int
   from public.irmaos_autorizados
   where id in (
     '86923002-0000-4000-8000-000000000021',
     '86923002-0000-4000-8000-000000000022',
     '86923002-0000-4000-8000-000000000023',
     '86923002-0000-4000-8000-000000000024'
   )) = 4
  and (select count(*)::int
   from public.irmaos_cargos
   where irmao_id in (
     '86923002-0000-4000-8000-000000000014',
     '86923002-0000-4000-8000-000000000015'
   )) = 2,
  'RLS08 administrador também opera como staff em membros e histórico de cargos'
);

reset role;
select * from finish();
rollback;
