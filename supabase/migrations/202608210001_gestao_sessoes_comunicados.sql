-- Gestão unificada, sessões da Loja, comunicados e auditoria.

alter table public.eventos_internos
  add column if not exists fim_em timestamptz,
  add column if not exists presenca_obrigatoria boolean not null default false,
  add column if not exists destaque boolean not null default false,
  add column if not exists ativo boolean not null default true,
  add column if not exists gerado_automaticamente boolean not null default false,
  add column if not exists excepcional boolean not null default false,
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists criado_por uuid references auth.users (id) on delete set null;

alter table public.eventos_internos drop constraint if exists eventos_internos_tipo_evento_check;
alter table public.eventos_internos
  add constraint eventos_internos_tipo_evento_check
  check (tipo_evento in (
    'geral',
    'fundacao',
    'sessao_ordinaria',
    'sessao_administrativa',
    'sessao_magna',
    'reuniao',
    'comunicado',
    'outro'
  ));

alter table public.comunicados_internos
  add column if not exists tipo text not null default 'informativo',
  add column if not exists prioridade integer not null default 0,
  add column if not exists destaque boolean not null default false,
  add column if not exists presenca_obrigatoria boolean not null default false,
  add column if not exists inicio_exibicao timestamptz,
  add column if not exists fim_exibicao timestamptz;

alter table public.comunicados_internos drop constraint if exists comunicados_internos_tipo_check;
alter table public.comunicados_internos
  add constraint comunicados_internos_tipo_check
  check (tipo in ('informativo', 'financeiro', 'urgente', 'sessao', 'administrativo'));

alter table public.irmaos
  add column if not exists situacao text not null default 'ativo',
  add column if not exists email text;

alter table public.irmaos drop constraint if exists irmaos_situacao_check;
alter table public.irmaos
  add constraint irmaos_situacao_check
  check (situacao in (
    'ativo',
    'quiet_placet',
    'transferencia',
    'afastado',
    'inativo',
    'desligado',
    'falecido'
  ));

create table if not exists public.irmaos_quiet_placet (
  id uuid primary key default gen_random_uuid(),
  irmao_id uuid not null references public.irmaos (id) on delete cascade,
  inicio_em date not null,
  previsao_termino date,
  motivo text,
  observacao text,
  suspender_acesso boolean not null default false,
  encerrado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.irmaos_transferencias (
  id uuid primary key default gen_random_uuid(),
  irmao_id uuid not null references public.irmaos (id) on delete cascade,
  data_solicitacao date not null,
  loja_destino text,
  oriente_destino text,
  observacao text,
  status text not null default 'solicitada'
    check (status in ('solicitada', 'em_analise', 'aprovada', 'concluida', 'cancelada')),
  concluida_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.irmaos_historico (
  id uuid primary key default gen_random_uuid(),
  irmao_id uuid references public.irmaos (id) on delete cascade,
  acesso_id uuid references public.irmaos_autorizados (id) on delete set null,
  evento text not null,
  detalhe text,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists irmaos_quiet_placet_irmao_idx on public.irmaos_quiet_placet (irmao_id, encerrado_em);
create index if not exists irmaos_transferencias_irmao_idx on public.irmaos_transferencias (irmao_id, status);
create index if not exists irmaos_historico_irmao_idx on public.irmaos_historico (irmao_id, criado_em desc);
create index if not exists irmaos_situacao_idx on public.irmaos (situacao);

alter table public.logs_autenticacao
  add column if not exists origem text;

alter table public.logs_autenticacao drop constraint if exists logs_autenticacao_evento_check;
alter table public.logs_autenticacao
  add constraint logs_autenticacao_evento_check
  check (evento in (
    'login_sucesso',
    'login_falha',
    'conta_bloqueada',
    'convite_enviado',
    'convite_aceito',
    'conta_ativada',
    'recuperacao_solicitada',
    'senha_alterada',
    'senha_redefinida',
    'logout',
    'acesso_revogado',
    'acesso_suspenso',
    'bootstrap_utilizado',
    'conta_desativada',
    'membro_criado',
    'membro_editado',
    'membro_desativado',
    'quiet_placet_iniciado',
    'quiet_placet_encerrado',
    'transferencia_iniciada',
    'transferencia_concluida',
    'familiar_criado',
    'familiar_editado',
    'casamento_criado',
    'evento_criado',
    'evento_editado',
    'comunicado_publicado'
  ));

drop policy if exists "Membros leem comunicados" on public.comunicados_internos;
create policy "Membros leem comunicados"
on public.comunicados_internos for select to authenticated
using (
  publicado is true
  and private.current_role() in ('irmao', 'secretario', 'administrador')
  and (inicio_exibicao is null or inicio_exibicao <= now())
  and (fim_exibicao is null or fim_exibicao >= now())
);

drop policy if exists "Membros leem eventos" on public.eventos_internos;
create policy "Membros leem eventos"
on public.eventos_internos for select to authenticated
using (
  publicado is true
  and ativo is true
  and private.current_role() in ('irmao', 'secretario', 'administrador')
);

alter table public.irmaos_quiet_placet enable row level security;
alter table public.irmaos_transferencias enable row level security;
alter table public.irmaos_historico enable row level security;

revoke all on table public.irmaos_quiet_placet from public, anon, authenticated;
revoke all on table public.irmaos_transferencias from public, anon, authenticated;
revoke all on table public.irmaos_historico from public, anon, authenticated;

grant select, insert, update on table public.irmaos_quiet_placet to authenticated;
grant select, insert, update on table public.irmaos_transferencias to authenticated;
grant select, insert on table public.irmaos_historico to authenticated;
grant all on table public.irmaos_quiet_placet to service_role;
grant all on table public.irmaos_transferencias to service_role;
grant all on table public.irmaos_historico to service_role;

create policy "Secretaria consulta quiet placet"
on public.irmaos_quiet_placet for select to authenticated
using (private.current_role() in ('secretario', 'administrador'));

create policy "Secretaria gerencia quiet placet"
on public.irmaos_quiet_placet for all to authenticated
using (private.current_role() in ('secretario', 'administrador'))
with check (private.current_role() in ('secretario', 'administrador'));

create policy "Secretaria consulta transferencias"
on public.irmaos_transferencias for select to authenticated
using (private.current_role() in ('secretario', 'administrador'));

create policy "Secretaria gerencia transferencias"
on public.irmaos_transferencias for all to authenticated
using (private.current_role() in ('secretario', 'administrador'))
with check (private.current_role() in ('secretario', 'administrador'));

create policy "Secretaria consulta historico"
on public.irmaos_historico for select to authenticated
using (private.current_role() in ('secretario', 'administrador'));

create policy "Secretaria registra historico"
on public.irmaos_historico for insert to authenticated
with check (private.current_role() in ('secretario', 'administrador'));

create or replace function private.nth_weekday_of_month(p_year integer, p_month integer, p_dow integer, p_n integer)
returns date
language sql
immutable
as $$
  select d
  from (
    select (
      make_date(p_year, p_month, 1)
      + ((p_dow - extract(dow from make_date(p_year, p_month, 1))::integer + 7) % 7)
      + ((p_n - 1) * 7)
    )::date as d
  ) s
  where extract(month from d) = p_month
    and extract(year from d) = p_year;
$$;

create or replace function private.gerar_sessoes_ordinarias(p_meses integer default 12)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  start_month date := date_trunc('month', timezone('America/Sao_Paulo', now()))::date;
  i integer;
  y integer;
  m integer;
  n integer;
  d date;
  ts timestamptz;
  inserted integer := 0;
begin
  if p_meses is null or p_meses < 1 or p_meses > 36 then
    p_meses := 12;
  end if;
  for i in 0 .. (p_meses - 1) loop
    y := extract(year from (start_month + make_interval(months => i)))::integer;
    m := extract(month from (start_month + make_interval(months => i)))::integer;
    foreach n in array array[2, 4] loop
      d := private.nth_weekday_of_month(y, m, 3, n);
      if d is null then
        continue;
      end if;
      ts := (d::timestamp + time '19:30') at time zone 'America/Sao_Paulo';
      insert into public.eventos_internos (
        titulo,
        descricao,
        inicia_em,
        publicado,
        tipo_evento,
        chave_idempotencia,
        gerado_automaticamente,
        excepcional,
        ativo,
        destaque,
        presenca_obrigatoria
      ) values (
        'Sessão Ordinária',
        'ARLS Laços de Fraternidade 357 nº 251',
        ts,
        true,
        'sessao_ordinaria',
        'sessao_ordinaria:' || d::text,
        true,
        false,
        true,
        true,
        false
      )
      on conflict (chave_idempotencia) do update
        set inicia_em = excluded.inicia_em,
            titulo = excluded.titulo,
            descricao = excluded.descricao,
            atualizado_em = now()
      where public.eventos_internos.excepcional is not true
        and public.eventos_internos.gerado_automaticamente is true;
      inserted := inserted + 1;
    end loop;
  end loop;
  return inserted;
end;
$$;

create or replace function public.gerar_sessoes_ordinarias(p_meses integer default 12)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role'
     and private.current_role() is distinct from 'secretario'
     and private.current_role() is distinct from 'administrador' then
    raise exception 'not allowed';
  end if;
  return private.gerar_sessoes_ordinarias(p_meses);
end;
$$;

revoke all on function public.gerar_sessoes_ordinarias(integer) from public, anon;
grant execute on function public.gerar_sessoes_ordinarias(integer) to authenticated, service_role;

select private.gerar_sessoes_ordinarias(12);
