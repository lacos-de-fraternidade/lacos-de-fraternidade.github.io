-- Runtime: criação/edição de sessões, café coerente, pauta e RLS (#86akaedgw).
-- Roda só no Postgres local.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

create temp table suite_ids (
  papel text primary key,
  auth_id uuid,
  irmao_id uuid not null,
  acesso_id uuid
);

insert into suite_ids (papel, auth_id, irmao_id, acesso_id) values
  ('administrador',    '86924100-0000-4000-8000-000000000001', '86924100-0000-4000-8000-000000000011', '86924100-0000-4000-8000-000000000021'),
  ('secretario',       '86924100-0000-4000-8000-000000000002', '86924100-0000-4000-8000-000000000012', '86924100-0000-4000-8000-000000000022'),
  ('veneravel_mestre', '86924100-0000-4000-8000-000000000003', '86924100-0000-4000-8000-000000000013', '86924100-0000-4000-8000-000000000023'),
  ('irmao',            '86924100-0000-4000-8000-000000000004', '86924100-0000-4000-8000-000000000014', '86924100-0000-4000-8000-000000000024');

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  s.auth_id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '86akaedgw-' || s.papel || '@test.local',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from suite_ids s;

insert into public.irmaos (id, nome, cim, situacao, origem)
select
  s.irmao_id,
  '86akaedgw ' || s.papel,
  lpad((86924130 + row_number() over (order by s.papel))::text, 8, '0'),
  'ativo',
  'teste'
from suite_ids s;

insert into public.irmaos_autorizados (
  id, cim, nome, email, perfil, ativo, conta_ativada, auth_user_id, irmao_id
)
select
  s.acesso_id,
  i.cim,
  i.nome,
  '86akaedgw-' || s.papel || '@test.local',
  s.papel,
  true,
  true,
  s.auth_id,
  s.irmao_id
from suite_ids s
join public.irmaos i on i.id = s.irmao_id;

insert into public.eventos_internos (
  id, titulo, inicia_em, tipo_evento, publicado, ativo, presenca_obrigatoria,
  grau, cafe_fraternal, cafe_horario, excepcional
) values (
  '86924100-0000-4000-8000-000000000101',
  'Sessão de teste',
  timestamptz '2026-09-09 20:15:00-03',
  'sessao_ordinaria',
  true,
  true,
  true,
  2,
  true,
  time '18:15',
  true
);

insert into public.sessoes_pauta_itens (evento_id, titulo, ordem) values
  ('86924100-0000-4000-8000-000000000101', 'Abertura dos trabalhos', 1),
  ('86924100-0000-4000-8000-000000000101', 'Expediente', 2);

select is(
  (select inicia_em from public.eventos_internos where id = '86924100-0000-4000-8000-000000000101'),
  timestamptz '2026-09-09 20:15:00-03',
  'TEST04 horário real diferente de 19h30 é persistido'
);

select is(
  (select grau from public.eventos_internos where id = '86924100-0000-4000-8000-000000000101'),
  2::smallint,
  'TEST02 grau persistido'
);

select is(
  (select presenca_obrigatoria from public.eventos_internos where id = '86924100-0000-4000-8000-000000000101'),
  true,
  'TEST01 presença necessária persistida'
);

select results_eq(
  $$select titulo from public.sessoes_pauta_itens where evento_id = '86924100-0000-4000-8000-000000000101' order by ordem$$,
  $$values ('Abertura dos trabalhos'), ('Expediente')$$,
  'TEST06/TEST07 pauta múltipla e ordenada'
);

update public.eventos_internos
set titulo = 'Sessão editada', cafe_fraternal = false, cafe_horario = null
where id = '86924100-0000-4000-8000-000000000101';

select is(
  (select titulo from public.eventos_internos where id = '86924100-0000-4000-8000-000000000101'),
  'Sessão editada',
  'TEST03 edição preserva o mesmo id'
);

select is(
  (select cafe_horario from public.eventos_internos where id = '86924100-0000-4000-8000-000000000101'),
  null,
  'TEST05 sem café zera o horário'
);

select throws_ok(
  $$update public.eventos_internos
    set cafe_fraternal = false, cafe_horario = time '18:30'
    where id = '86924100-0000-4000-8000-000000000101'$$,
  '23514',
  null,
  'TEST05 constraint impede café inconsistente'
);

update public.sessoes_pauta_itens
set titulo = 'Expediente revisado'
where evento_id = '86924100-0000-4000-8000-000000000101'
  and ordem = 2;

select is(
  (select titulo from public.sessoes_pauta_itens where evento_id = '86924100-0000-4000-8000-000000000101' and ordem = 2),
  'Expediente revisado',
  'TEST08 item da pauta é editado'
);

delete from public.sessoes_pauta_itens
where evento_id = '86924100-0000-4000-8000-000000000101'
  and ordem = 2;

select is(
  (select count(*)::int from public.sessoes_pauta_itens where evento_id = '86924100-0000-4000-8000-000000000101'),
  1,
  'TEST09 remover um item preserva os demais'
);

select ok(
  private.gerar_sessoes_ordinarias(1) >= 1,
  'TEST15 geração ordinária continua disponível'
);

select ok(
  exists (
    select 1
    from public.eventos_internos
    where tipo_evento = 'sessao_ordinaria'
      and gerado_automaticamente is true
      and extract(hour from inicia_em at time zone 'America/Sao_Paulo') = 19
      and extract(minute from inicia_em at time zone 'America/Sao_Paulo') = 30
  ),
  'TEST15 sessões ordinárias geradas permanecem às 19h30'
);

reset role;
select set_config('request.jwt.claim.sub', '86924100-0000-4000-8000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86924100-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  exists (
    select 1 from public.eventos_internos
    where id = '86924100-0000-4000-8000-000000000101'
  )
  and exists (
    select 1 from public.sessoes_pauta_itens
    where evento_id = '86924100-0000-4000-8000-000000000101'
      and titulo = 'Abertura dos trabalhos'
  ),
  'TEST14 irmão lê sessão publicada e a pauta persistida'
);

select throws_ok(
  $$insert into public.eventos_internos (titulo, inicia_em, tipo_evento)
    values ('Sessão indevida', now(), 'sessao_ordinaria')$$,
  '42501',
  null,
  'TEST10 irmão não escreve em eventos_internos'
);

select throws_ok(
  $$insert into public.sessoes_pauta_itens (evento_id, titulo, ordem)
    values ('86924100-0000-4000-8000-000000000101', 'Item indevido', 9)$$,
  '42501',
  null,
  'TEST10 irmão não escreve pauta'
);

reset role;
select set_config('request.jwt.claim.sub', '86924100-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86924100-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.eventos_internos (id, titulo, inicia_em, tipo_evento, excepcional, grau, cafe_fraternal)
    values ('86924100-0000-4000-8000-000000000201', 'Sessão secretaria', now(), 'sessao_ordinaria', true, 1, false)$$,
  'TEST11 secretario cria sessão'
);

reset role;
select set_config('request.jwt.claim.sub', '86924100-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86924100-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.eventos_internos set titulo = 'Sessão VM' where id = '86924100-0000-4000-8000-000000000201'$$,
  'TEST12 veneravel_mestre edita sessão'
);

reset role;
select set_config('request.jwt.claim.sub', '86924100-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"86924100-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.sessoes_pauta_itens (evento_id, titulo, ordem)
    values ('86924100-0000-4000-8000-000000000201', 'Item admin', 1)$$,
  'TEST13 administrador gerencia pauta'
);

select is(
  (
    select count(*)::int
    from public.eventos_internos
    where tipo_evento = 'sessao_ordinaria'
      and gerado_automaticamente is true
      and grau = 1
      and cafe_fraternal is true
      and cafe_horario = time '18:45'
  ) >= 1,
  true,
  'TEST15 geração ordinária persiste grau e café padrão'
);

select * from finish();
rollback;
