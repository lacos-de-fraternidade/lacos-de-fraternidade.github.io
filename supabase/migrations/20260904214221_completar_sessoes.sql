-- Completa o domínio administrativo das sessões: horário real já está em
-- inicia_em. Acrescenta grau, café fraternal coerente e pauta ordenada.

alter table public.eventos_internos
  add column if not exists grau smallint,
  add column if not exists cafe_fraternal boolean not null default false,
  add column if not exists cafe_horario time;

alter table public.eventos_internos drop constraint if exists eventos_internos_grau_check;
alter table public.eventos_internos
  add constraint eventos_internos_grau_check
  check (grau is null or grau in (1, 2, 3));

alter table public.eventos_internos drop constraint if exists eventos_internos_cafe_check;
alter table public.eventos_internos
  add constraint eventos_internos_cafe_check
  check (cafe_fraternal is true or cafe_horario is null);

comment on column public.eventos_internos.grau is
  'Grau de trabalho da sessão (1, 2 ou 3). Independente do grau do Irmão.';
comment on column public.eventos_internos.cafe_horario is
  'Horário do café fraternal. Só é válido quando cafe_fraternal é verdadeiro.';

create table if not exists public.sessoes_pauta_itens (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos_internos (id) on delete cascade,
  titulo text not null,
  ordem integer not null check (ordem >= 1),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists sessoes_pauta_itens_evento_ordem_key
  on public.sessoes_pauta_itens (evento_id, ordem);

create index if not exists sessoes_pauta_itens_evento_idx
  on public.sessoes_pauta_itens (evento_id, ordem);

comment on table public.sessoes_pauta_itens is
  'Itens administrativos da Ordem do Dia. A ordem persistida é a exibida.';

alter table public.sessoes_pauta_itens enable row level security;

revoke all on table public.sessoes_pauta_itens from public, anon, authenticated;
grant select on table public.sessoes_pauta_itens to authenticated;
grant insert, update, delete on table public.sessoes_pauta_itens to authenticated;
grant all on table public.sessoes_pauta_itens to service_role;

drop policy if exists "Membros leem pauta de sessoes" on public.sessoes_pauta_itens;
create policy "Membros leem pauta de sessoes"
on public.sessoes_pauta_itens for select to authenticated
using (
  exists (
    select 1
    from public.eventos_internos e
    where e.id = evento_id
      and e.publicado is true
      and e.ativo is true
      and private.is_member_role()
  )
  or private.is_staff_role()
);

drop policy if exists "Secretaria gerencia pauta de sessoes" on public.sessoes_pauta_itens;
create policy "Secretaria gerencia pauta de sessoes"
on public.sessoes_pauta_itens for all to authenticated
using (private.is_staff_role())
with check (private.is_staff_role());

-- Compatibilidade: sessões ordinárias já geradas passam a ter a mesma
-- informação que a interface hoje hardcodava.
update public.eventos_internos
set
  grau = coalesce(grau, 1),
  cafe_fraternal = true,
  cafe_horario = coalesce(cafe_horario, time '18:45')
where tipo_evento = 'sessao_ordinaria'
  and gerado_automaticamente is true
  and excepcional is not true;

insert into public.sessoes_pauta_itens (evento_id, titulo, ordem)
select e.id, 'Leitura da pauta administrativa', 1
from public.eventos_internos e
where e.tipo_evento = 'sessao_ordinaria'
  and e.gerado_automaticamente is true
  and e.excepcional is not true
  and not exists (
    select 1 from public.sessoes_pauta_itens p where p.evento_id = e.id
  );

create or replace function private.gerar_sessoes_ordinarias(p_meses integer default 12)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
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
  v_evento_id uuid;
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
        presenca_obrigatoria,
        grau,
        cafe_fraternal,
        cafe_horario
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
        false,
        1,
        true,
        time '18:45'
      )
      on conflict (chave_idempotencia) do update
        set inicia_em = excluded.inicia_em,
            titulo = excluded.titulo,
            descricao = excluded.descricao,
            atualizado_em = now()
      where public.eventos_internos.excepcional is not true
        and public.eventos_internos.gerado_automaticamente is true;
      inserted := inserted + 1;

      select e.id
        into v_evento_id
      from public.eventos_internos e
      where e.chave_idempotencia = 'sessao_ordinaria:' || d::text
        and e.gerado_automaticamente is true
        and e.excepcional is not true;

      if v_evento_id is not null
         and not exists (
           select 1 from public.sessoes_pauta_itens p where p.evento_id = v_evento_id
         ) then
        insert into public.sessoes_pauta_itens (evento_id, titulo, ordem)
        values (v_evento_id, 'Leitura da pauta administrativa', 1);
      end if;
    end loop;
  end loop;
  return inserted;
end;
$$;
