-- Cadastro institucional da Área dos Irmãos (celebrações extraídas da GLMERJ).
-- Esta migration cria somente estrutura, índices, RLS e idempotência.
-- Não versiona nomes, datas pessoais nem credenciais.
-- A carga inicial deve ser feita pelo script local scripts/import-glmerj-initial-data.mjs.

create or replace function private.membro_interno_ativo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.current_role() in ('irmao', 'secretario', 'administrador');
$$;

revoke all on function private.membro_interno_ativo() from public, anon, authenticated;
grant execute on function private.membro_interno_ativo() to authenticated, service_role;

create table public.irmaos (
  id uuid primary key default gen_random_uuid(),
  auth_member_id uuid unique
    references public.irmaos_autorizados (id)
    on delete set null,
  nome text not null,
  nome_original text,
  cim text unique,
  dia_nascimento smallint check (dia_nascimento between 1 and 31),
  mes_nascimento smallint check (mes_nascimento between 1 and 12),
  ano_nascimento smallint check (ano_nascimento between 1900 and 2100),
  idade_informada_na_importacao smallint,
  data_iniciacao date,
  loja_iniciacao text,
  ativo boolean not null default true,
  exibir_aniversario boolean not null default true,
  exibir_idade boolean not null default false,
  exibir_iniciacao boolean not null default true,
  origem text not null default 'glmerj',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  nome_normalizado text generated always as (
    upper(regexp_replace(btrim(nome), '\s+', ' ', 'g'))
  ) stored,
  constraint irmaos_cim_formato check (cim is null or cim ~ '^[0-9]{4,12}$')
);

comment on column public.irmaos.idade_informada_na_importacao is
  'Valor histórico da extração GLMERJ. Não é idade atual e não deve ser usado para inventar ano de nascimento.';
comment on column public.irmaos.ano_nascimento is
  'Preencher somente quando a data completa for conhecida. A extração GLMERJ não forneceu o ano.';

create unique index irmaos_nome_normalizado_key on public.irmaos (nome_normalizado);
create index irmaos_mes_dia_idx on public.irmaos (mes_nascimento, dia_nascimento);
create index irmaos_data_iniciacao_idx on public.irmaos (data_iniciacao);

create table public.familiares (
  id uuid primary key default gen_random_uuid(),
  irmao_id uuid not null
    references public.irmaos (id)
    on delete cascade,
  nome text not null,
  nome_original text,
  parentesco text not null
    check (parentesco in ('esposa', 'companheira', 'filho', 'filha', 'pai', 'mae', 'outro')),
  parentesco_original text,
  dia_nascimento smallint check (dia_nascimento between 1 and 31),
  mes_nascimento smallint check (mes_nascimento between 1 and 12),
  ano_nascimento smallint check (ano_nascimento between 1900 and 2100),
  idade_informada_na_importacao smallint,
  ativo boolean not null default true,
  autorizado_exibicao boolean not null default false,
  origem text not null default 'glmerj',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  nome_normalizado text generated always as (
    upper(regexp_replace(btrim(nome), '\s+', ' ', 'g'))
  ) stored
);

create unique index familiares_irmao_nome_parentesco_key
  on public.familiares (irmao_id, nome_normalizado, parentesco);
create index familiares_mes_dia_idx on public.familiares (mes_nascimento, dia_nascimento);

create table public.casamentos (
  id uuid primary key default gen_random_uuid(),
  irmao_id uuid not null
    references public.irmaos (id)
    on delete cascade,
  conjuge_id uuid
    references public.familiares (id)
    on delete set null,
  data_casamento date not null,
  ativo boolean not null default true,
  autorizado_exibicao boolean not null default false,
  origem text not null default 'glmerj',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index casamentos_irmao_data_key
  on public.casamentos (irmao_id, data_casamento);

alter table public.eventos_internos
  add column if not exists tipo_evento text not null default 'geral';
alter table public.eventos_internos
  add column if not exists data_evento date;
alter table public.eventos_internos
  add column if not exists chave_idempotencia text unique;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'eventos_internos_tipo_evento_check'
  ) then
    alter table public.eventos_internos
      add constraint eventos_internos_tipo_evento_check
      check (tipo_evento in ('geral', 'fundacao'));
  end if;
end
$$;

create trigger irmaos_touch
before update on public.irmaos
for each row execute function private.touch_atualizado_em();

create trigger familiares_touch
before update on public.familiares
for each row execute function private.touch_atualizado_em();

create trigger casamentos_touch
before update on public.casamentos
for each row execute function private.touch_atualizado_em();

alter table public.irmaos enable row level security;
alter table public.familiares enable row level security;
alter table public.casamentos enable row level security;

revoke all on table public.irmaos from public, anon, authenticated;
revoke all on table public.familiares from public, anon, authenticated;
revoke all on table public.casamentos from public, anon, authenticated;

grant select on table public.irmaos to authenticated;
grant select on table public.familiares to authenticated;
grant select on table public.casamentos to authenticated;
grant all on table public.irmaos to service_role;
grant all on table public.familiares to service_role;
grant all on table public.casamentos to service_role;

create policy "Membros ativos consultam irmaos institucionais"
on public.irmaos for select to authenticated
using (
  ativo is true
  and private.membro_interno_ativo()
);

create policy "Secretaria consulta irmaos institucionais"
on public.irmaos for select to authenticated
using (private.current_role() in ('secretario', 'administrador'));

create policy "Membros ativos consultam familiares autorizados"
on public.familiares for select to authenticated
using (
  ativo is true
  and autorizado_exibicao is true
  and private.membro_interno_ativo()
);

create policy "Secretaria consulta familiares"
on public.familiares for select to authenticated
using (private.current_role() in ('secretario', 'administrador'));

create policy "Membros ativos consultam casamentos autorizados"
on public.casamentos for select to authenticated
using (
  ativo is true
  and autorizado_exibicao is true
  and private.membro_interno_ativo()
);

create policy "Secretaria consulta casamentos"
on public.casamentos for select to authenticated
using (private.current_role() in ('secretario', 'administrador'));
