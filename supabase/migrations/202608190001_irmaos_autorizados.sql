-- Membros autorizados da Área dos Irmãos.
-- Senhas permanecem exclusivamente em auth.users (Supabase Auth).

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

create or replace function public.normalize_cim(raw text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.normalize_email(raw text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(btrim(coalesce(raw, '')));
$$;

revoke all on function public.normalize_cim(text) from public, anon, authenticated;
revoke all on function public.normalize_email(text) from public, anon, authenticated;
grant execute on function public.normalize_cim(text) to postgres, service_role;
grant execute on function public.normalize_email(text) to postgres, service_role;

create table public.irmaos_autorizados (
  id uuid primary key default gen_random_uuid(),
  cim text not null unique,
  nome text not null,
  email text not null unique,
  perfil text not null default 'irmao'
    check (perfil in ('irmao', 'secretario', 'administrador')),
  ativo boolean not null default true,
  conta_ativada boolean not null default false,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  convite_enviado_em timestamptz,
  convite_expira_em timestamptz,
  conta_ativada_em timestamptz,
  ultimo_acesso_em timestamptz,
  tentativas_falhas integer not null default 0,
  bloqueado_ate timestamptz,
  data_nascimento date,
  data_iniciacao date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint irmaos_cim_formato check (cim ~ '^[0-9]{4,12}$'),
  constraint irmaos_email_formato check (position('@' in email) > 1)
);

create index irmaos_autorizados_cim_idx on public.irmaos_autorizados (cim);
create index irmaos_autorizados_auth_user_id_idx on public.irmaos_autorizados (auth_user_id);
create index irmaos_autorizados_perfil_idx on public.irmaos_autorizados (perfil);

create table public.configuracoes_autenticacao (
  id smallint primary key default 1 check (id = 1),
  max_falhas_cim integer not null default 5,
  janela_falhas_minutos integer not null default 15,
  max_falhas_ip integer not null default 20,
  bloqueio_inicial_minutos integer not null default 15,
  retencao_logs_dias integer not null default 180,
  convite_validade_horas integer not null default 72,
  mfa_obrigatorio_admin boolean not null default false,
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes_autenticacao (id) values (1)
on conflict (id) do nothing;

create or replace function private.touch_atualizado_em()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function private.normalize_irmao_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.cim := public.normalize_cim(new.cim);
  new.email := public.normalize_email(new.email);
  new.nome := btrim(new.nome);
  if new.cim is null or new.cim !~ '^[0-9]{4,12}$' then
    raise exception 'cim_invalida';
  end if;
  if new.email is null or position('@' in new.email) < 2 then
    raise exception 'email_invalido';
  end if;
  if tg_op = 'INSERT' then
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger irmaos_autorizados_normalize
before insert or update on public.irmaos_autorizados
for each row execute function private.normalize_irmao_row();

create trigger irmaos_autorizados_touch
before update on public.irmaos_autorizados
for each row execute function private.touch_atualizado_em();

create or replace function private.current_member()
returns public.irmaos_autorizados
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.irmaos_autorizados
  where auth_user_id = auth.uid()
    and ativo is true
    and conta_ativada is true
  limit 1;
$$;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select perfil
  from public.irmaos_autorizados
  where auth_user_id = auth.uid()
    and ativo is true
    and conta_ativada is true
  limit 1;
$$;

create or replace function private.prevent_unauthorized_perfil_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.perfil is distinct from old.perfil
     and coalesce(private.current_role(), '') is distinct from 'administrador'
     and current_setting('role', true) is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;
  return new;
end;
$$;

create trigger irmaos_autorizados_perfil_guard
before update on public.irmaos_autorizados
for each row execute function private.prevent_unauthorized_perfil_change();

alter table public.irmaos_autorizados enable row level security;
alter table public.configuracoes_autenticacao enable row level security;

revoke all on table public.irmaos_autorizados from public, anon, authenticated;
revoke all on table public.configuracoes_autenticacao from public, anon, authenticated;

grant select on table public.irmaos_autorizados to authenticated;
grant all on table public.irmaos_autorizados to service_role;
grant all on table public.configuracoes_autenticacao to service_role;

create policy "Usuário consulta o próprio perfil"
on public.irmaos_autorizados
for select
to authenticated
using (auth_user_id = auth.uid());

create policy "Secretaria consulta membros"
on public.irmaos_autorizados
for select
to authenticated
using (private.current_role() in ('secretario', 'administrador'));

create policy "Secretaria cadastra membros"
on public.irmaos_autorizados
for insert
to authenticated
with check (private.current_role() in ('secretario', 'administrador'));

create policy "Secretaria atualiza membros"
on public.irmaos_autorizados
for update
to authenticated
using (private.current_role() in ('secretario', 'administrador'))
with check (private.current_role() in ('secretario', 'administrador'));

-- Primeiro administrador: executar no SQL Editor do Supabase, uma única vez.
create or replace function public.bootstrap_primeiro_administrador(
  p_cim text,
  p_nome text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if exists (select 1 from public.irmaos_autorizados where perfil = 'administrador') then
    raise exception 'bootstrap_indisponivel';
  end if;

  insert into public.irmaos_autorizados (cim, nome, email, perfil, ativo)
  values (p_cim, p_nome, p_email, 'administrador', true)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.bootstrap_primeiro_administrador(text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_primeiro_administrador(text, text, text) to postgres, service_role;
