-- Datas institucionais recorrentes (Dia do Maçom e futuras datas da Loja).
-- Recorrência anual por dia/mês, sem evento isolado por ano.

create table if not exists public.datas_institucionais (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  titulo text not null,
  descricao text,
  dia smallint not null check (dia between 1 and 31),
  mes smallint not null check (mes between 1 and 12),
  tipo text not null default 'data_maconica'
    check (tipo in ('data_maconica', 'fundacao', 'instalacao', 'jubileu', 'historica', 'institucional')),
  recorrencia text not null default 'anual' check (recorrencia in ('anual')),
  dia_inteiro boolean not null default true,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.datas_institucionais (chave, titulo, descricao, dia, mes, tipo, recorrencia, dia_inteiro, ativo)
values (
  'dia_do_macom',
  'Dia do Maçom',
  'Data comemorativa dedicada aos maçons brasileiros.',
  20,
  8,
  'data_maconica',
  'anual',
  true,
  true
)
on conflict (chave) do update
set
  titulo = excluded.titulo,
  descricao = excluded.descricao,
  dia = excluded.dia,
  mes = excluded.mes,
  tipo = excluded.tipo,
  ativo = true;

alter table public.datas_institucionais enable row level security;

revoke all on table public.datas_institucionais from public, anon, authenticated;
grant select on table public.datas_institucionais to authenticated;
grant insert, update, delete on table public.datas_institucionais to authenticated;
grant all on table public.datas_institucionais to service_role;

drop policy if exists "Membros leem datas institucionais" on public.datas_institucionais;
create policy "Membros leem datas institucionais"
on public.datas_institucionais for select to authenticated
using (
  ativo is true
  and private.current_role() in ('irmao', 'secretario', 'administrador')
);

drop policy if exists "Secretaria gerencia datas institucionais" on public.datas_institucionais;
create policy "Secretaria gerencia datas institucionais"
on public.datas_institucionais for all to authenticated
using (private.current_role() in ('secretario', 'administrador'))
with check (private.current_role() in ('secretario', 'administrador'));
