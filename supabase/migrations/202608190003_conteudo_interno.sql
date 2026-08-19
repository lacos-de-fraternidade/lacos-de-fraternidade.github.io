-- Conteúdo interno da Área dos Irmãos (comunicados, agenda e celebrações).

create table public.comunicados_internos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  corpo text not null,
  publicado boolean not null default true,
  criado_por uuid references public.irmaos_autorizados (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.eventos_internos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  inicia_em timestamptz not null,
  publicado boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.celebracoes (
  id uuid primary key default gen_random_uuid(),
  irmao_id uuid references public.irmaos_autorizados (id) on delete cascade,
  tipo text not null check (tipo in ('aniversario', 'iniciacao', 'familiar')),
  nome_exibicao text not null,
  mes smallint not null check (mes between 1 and 12),
  dia smallint not null check (dia between 1 and 31),
  autorizado boolean not null default true,
  criado_em timestamptz not null default now()
);

create index celebracoes_mes_dia_idx on public.celebracoes (mes, dia);
create index eventos_internos_inicia_em_idx on public.eventos_internos (inicia_em);

alter table public.comunicados_internos enable row level security;
alter table public.eventos_internos enable row level security;
alter table public.celebracoes enable row level security;

revoke all on table public.comunicados_internos from public, anon, authenticated;
revoke all on table public.eventos_internos from public, anon, authenticated;
revoke all on table public.celebracoes from public, anon, authenticated;

grant select on table public.comunicados_internos to authenticated;
grant select on table public.eventos_internos to authenticated;
grant select on table public.celebracoes to authenticated;
grant insert, update, delete on table public.comunicados_internos to authenticated;
grant insert, update, delete on table public.eventos_internos to authenticated;
grant insert, update, delete on table public.celebracoes to authenticated;
grant all on table public.comunicados_internos to service_role;
grant all on table public.eventos_internos to service_role;
grant all on table public.celebracoes to service_role;

create policy "Membros leem comunicados"
on public.comunicados_internos for select to authenticated
using (
  publicado is true
  and private.current_role() in ('irmao', 'secretario', 'administrador')
);

create policy "Secretaria gerencia comunicados"
on public.comunicados_internos for all to authenticated
using (private.current_role() in ('secretario', 'administrador'))
with check (private.current_role() in ('secretario', 'administrador'));

create policy "Membros leem eventos"
on public.eventos_internos for select to authenticated
using (
  publicado is true
  and private.current_role() in ('irmao', 'secretario', 'administrador')
);

create policy "Secretaria gerencia eventos"
on public.eventos_internos for all to authenticated
using (private.current_role() in ('secretario', 'administrador'))
with check (private.current_role() in ('secretario', 'administrador'));

create policy "Membros leem celebracoes autorizadas"
on public.celebracoes for select to authenticated
using (
  autorizado is true
  and private.current_role() in ('irmao', 'secretario', 'administrador')
);

create policy "Secretaria gerencia celebracoes"
on public.celebracoes for all to authenticated
using (private.current_role() in ('secretario', 'administrador'))
with check (private.current_role() in ('secretario', 'administrador'));
