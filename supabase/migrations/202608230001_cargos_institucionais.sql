-- Cargos institucionais da Loja, separados do perfil de acesso.
-- Perfis: irmao, secretario, veneravel_mestre, administrador.
-- Cargo vigente: encerrado_em IS NULL. Troca preserva histórico.
-- Autorização do portal usa irmaos_autorizados.perfil, não o cargo.

alter table public.irmaos_autorizados drop constraint if exists irmaos_autorizados_perfil_check;
alter table public.irmaos_autorizados
  add constraint irmaos_autorizados_perfil_check
  check (perfil in ('irmao', 'secretario', 'veneravel_mestre', 'administrador'));

create or replace function private.is_member_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.current_role() in ('irmao', 'secretario', 'veneravel_mestre', 'administrador');
$$;

create or replace function private.is_staff_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.current_role() in ('secretario', 'veneravel_mestre', 'administrador');
$$;

create or replace function private.is_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.current_role() = 'administrador';
$$;

create or replace function private.membro_interno_ativo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_member_role();
$$;

revoke all on function private.is_member_role() from public, anon, authenticated;
revoke all on function private.is_staff_role() from public, anon, authenticated;
revoke all on function private.is_admin_role() from public, anon, authenticated;
grant execute on function private.is_member_role() to authenticated, service_role;
grant execute on function private.is_staff_role() to authenticated, service_role;
grant execute on function private.is_admin_role() to authenticated, service_role;

drop policy if exists "Secretaria consulta membros" on public.irmaos_autorizados;
create policy "Secretaria consulta membros"
on public.irmaos_autorizados for select to authenticated
using (private.is_staff_role());

drop policy if exists "Secretaria cadastra membros" on public.irmaos_autorizados;
create policy "Secretaria cadastra membros"
on public.irmaos_autorizados for insert to authenticated
with check (private.is_staff_role());

drop policy if exists "Secretaria atualiza membros" on public.irmaos_autorizados;
create policy "Secretaria atualiza membros"
on public.irmaos_autorizados for update to authenticated
using (private.is_staff_role())
with check (private.is_staff_role());

drop policy if exists "Secretaria consulta irmaos institucionais" on public.irmaos;
create policy "Secretaria consulta irmaos institucionais"
on public.irmaos for select to authenticated
using (private.is_staff_role());

drop policy if exists "Secretaria consulta familiares" on public.familiares;
create policy "Secretaria consulta familiares"
on public.familiares for select to authenticated
using (private.is_staff_role());

drop policy if exists "Secretaria consulta casamentos" on public.casamentos;
create policy "Secretaria consulta casamentos"
on public.casamentos for select to authenticated
using (private.is_staff_role());

drop policy if exists "Membros leem comunicados" on public.comunicados_internos;
create policy "Membros leem comunicados"
on public.comunicados_internos for select to authenticated
using (
  publicado is true
  and private.is_member_role()
  and (inicio_exibicao is null or inicio_exibicao <= now())
  and (fim_exibicao is null or fim_exibicao >= now())
);

drop policy if exists "Secretaria gerencia comunicados" on public.comunicados_internos;
create policy "Secretaria gerencia comunicados"
on public.comunicados_internos for all to authenticated
using (private.is_staff_role())
with check (private.is_staff_role());

drop policy if exists "Membros leem eventos" on public.eventos_internos;
create policy "Membros leem eventos"
on public.eventos_internos for select to authenticated
using (
  publicado is true
  and ativo is true
  and private.is_member_role()
);

drop policy if exists "Secretaria gerencia eventos" on public.eventos_internos;
create policy "Secretaria gerencia eventos"
on public.eventos_internos for all to authenticated
using (private.is_staff_role())
with check (private.is_staff_role());

drop policy if exists "Membros leem celebracoes autorizadas" on public.celebracoes;
create policy "Membros leem celebracoes autorizadas"
on public.celebracoes for select to authenticated
using (
  autorizado is true
  and private.is_member_role()
);

drop policy if exists "Secretaria gerencia celebracoes" on public.celebracoes;
create policy "Secretaria gerencia celebracoes"
on public.celebracoes for all to authenticated
using (private.is_staff_role())
with check (private.is_staff_role());

drop policy if exists "Secretaria consulta quiet placet" on public.irmaos_quiet_placet;
create policy "Secretaria consulta quiet placet"
on public.irmaos_quiet_placet for select to authenticated
using (private.is_staff_role());

drop policy if exists "Secretaria gerencia quiet placet" on public.irmaos_quiet_placet;
create policy "Secretaria gerencia quiet placet"
on public.irmaos_quiet_placet for all to authenticated
using (private.is_staff_role())
with check (private.is_staff_role());

drop policy if exists "Secretaria consulta transferencias" on public.irmaos_transferencias;
create policy "Secretaria consulta transferencias"
on public.irmaos_transferencias for select to authenticated
using (private.is_staff_role());

drop policy if exists "Secretaria gerencia transferencias" on public.irmaos_transferencias;
create policy "Secretaria gerencia transferencias"
on public.irmaos_transferencias for all to authenticated
using (private.is_staff_role())
with check (private.is_staff_role());

drop policy if exists "Secretaria consulta historico" on public.irmaos_historico;
create policy "Secretaria consulta historico"
on public.irmaos_historico for select to authenticated
using (private.is_staff_role());

drop policy if exists "Secretaria registra historico" on public.irmaos_historico;
create policy "Secretaria registra historico"
on public.irmaos_historico for insert to authenticated
with check (private.is_staff_role());

drop policy if exists "Membros leem datas institucionais" on public.datas_institucionais;
create policy "Membros leem datas institucionais"
on public.datas_institucionais for select to authenticated
using (
  ativo is true
  and private.is_member_role()
);

drop policy if exists "Secretaria gerencia datas institucionais" on public.datas_institucionais;
create policy "Secretaria gerencia datas institucionais"
on public.datas_institucionais for all to authenticated
using (private.is_staff_role())
with check (private.is_staff_role());

create or replace function public.gerar_sessoes_ordinarias(p_meses integer default 12)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role'
     and not private.is_staff_role() then
    raise exception 'not allowed';
  end if;
  return private.gerar_sessoes_ordinarias(p_meses);
end;
$$;

create table public.irmaos_cargos (
  id uuid primary key default gen_random_uuid(),
  irmao_id uuid not null references public.irmaos (id) on delete cascade,
  cargo text not null
    check (cargo in (
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
    )),
  inicio_em date not null default (timezone('America/Sao_Paulo', now()))::date,
  encerrado_em timestamptz,
  atribuido_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.irmaos_cargos is
  'Mandatos institucionais da Loja. Independente de irmaos_autorizados.perfil.';
comment on column public.irmaos_cargos.encerrado_em is
  'NULL = mandato vigente. A troca encerra o registro anterior e insere outro.';

create unique index irmaos_cargos_irmao_vigente_key
  on public.irmaos_cargos (irmao_id)
  where encerrado_em is null;

create unique index irmaos_cargos_cargo_vigente_key
  on public.irmaos_cargos (cargo)
  where encerrado_em is null;

create index irmaos_cargos_irmao_idx on public.irmaos_cargos (irmao_id, encerrado_em);
create index irmaos_cargos_cargo_idx on public.irmaos_cargos (cargo, encerrado_em);

create trigger irmaos_cargos_touch
before update on public.irmaos_cargos
for each row execute function private.touch_atualizado_em();

alter table public.irmaos_cargos enable row level security;

revoke all on table public.irmaos_cargos from public, anon, authenticated;
grant select on table public.irmaos_cargos to authenticated;
grant all on table public.irmaos_cargos to service_role;

create policy "Membros consultam cargos vigentes"
on public.irmaos_cargos for select to authenticated
using (
  encerrado_em is null
  and private.membro_interno_ativo()
);

create policy "Secretaria consulta historico de cargos"
on public.irmaos_cargos for select to authenticated
using (private.is_staff_role());

-- Lock transacional único para mutações de cargo (baixa frequência).
-- 86923001 = namespace desta feature; evita deadlock por ordem cruzada de linhas.
create or replace function private.lock_cargos_institucionais()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(86923001);
end;
$$;

create or replace function private.request_actor_id()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  raw text;
begin
  raw := nullif(current_setting('app.actor_id', true), '');
  if raw is null or raw !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return auth.uid();
  end if;
  return raw::uuid;
exception
  when others then
    return auth.uid();
end;
$$;

create or replace function private.registrar_historico_cargo(
  p_irmao_id uuid,
  p_evento text,
  p_cargo text,
  p_detalhe text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.irmaos_historico (irmao_id, evento, detalhe, criado_por)
  values (
    p_irmao_id,
    p_evento,
    coalesce(p_detalhe, p_cargo),
    p_actor
  );
end;
$$;

create or replace function private.encerrar_cargos_vigentes(
  p_irmao_id uuid,
  p_actor uuid,
  p_motivo text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  closed integer := 0;
  rec record;
  actor uuid := coalesce(p_actor, private.request_actor_id());
begin
  for rec in
    select id, cargo
    from public.irmaos_cargos
    where irmao_id = p_irmao_id
      and encerrado_em is null
    order by cargo
    for update
  loop
    update public.irmaos_cargos
    set encerrado_em = now()
    where id = rec.id
      and encerrado_em is null;
    if found then
      closed := closed + 1;
      perform private.registrar_historico_cargo(
        p_irmao_id,
        'cargo_encerrado',
        rec.cargo,
        coalesce(p_motivo, rec.cargo),
        actor
      );
    end if;
  end loop;
  return closed;
end;
$$;

create or replace function private.sync_cargo_com_situacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.situacao is distinct from 'ativo' then
    perform private.encerrar_cargos_vigentes(
      new.id,
      private.request_actor_id(),
      'Encerramento automático (situacao=' || new.situacao || ')'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists irmaos_encerrar_cargo_inativo on public.irmaos;
create trigger irmaos_encerrar_cargo_inativo
after insert or update of situacao on public.irmaos
for each row
when (new.situacao is distinct from 'ativo')
execute function private.sync_cargo_com_situacao();

create or replace function private.veneravel_mestre_vigente()
returns table (
  irmao_id uuid,
  cargo text,
  inicio_em date,
  acesso_id uuid,
  auth_user_id uuid,
  situacao text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.irmao_id,
    c.cargo,
    c.inicio_em,
    a.id as acesso_id,
    a.auth_user_id,
    i.situacao
  from public.irmaos_cargos c
  join public.irmaos i on i.id = c.irmao_id
  left join public.irmaos_autorizados a on a.irmao_id = i.id
  where c.cargo = 'veneravel_mestre'
    and c.encerrado_em is null
    and i.situacao = 'ativo'
  limit 1;
$$;

create or replace function private.is_veneravel_mestre_user(p_auth_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.irmaos_autorizados a
    join public.irmaos i on i.id = a.irmao_id
    join public.irmaos_cargos c on c.irmao_id = i.id
    where a.auth_user_id = p_auth_user_id
      and a.ativo is true
      and a.conta_ativada is true
      and i.situacao = 'ativo'
      and c.cargo = 'veneravel_mestre'
      and c.encerrado_em is null
  );
$$;

create or replace function private.is_veneravel_mestre_atual()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_veneravel_mestre_user(auth.uid());
$$;

create or replace function private.can_manage_institutional_offices_user(p_auth_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.irmaos_autorizados a
    where a.auth_user_id = p_auth_user_id
      and a.ativo is true
      and a.conta_ativada is true
      and a.perfil in ('secretario', 'veneravel_mestre', 'administrador')
  );
$$;

create or replace function private.can_manage_veneravel_mestre_user(p_auth_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.irmaos_autorizados a
    where a.auth_user_id = p_auth_user_id
      and a.ativo is true
      and a.conta_ativada is true
      and a.perfil = 'administrador'
  );
$$;

create or replace function public.is_veneravel_mestre_atual()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_veneravel_mestre_atual();
$$;

create or replace function public.veneravel_mestre_vigente()
returns table (
  irmao_id uuid,
  cargo text,
  inicio_em date,
  situacao text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.irmao_id,
    v.cargo,
    v.inicio_em,
    v.situacao
  from private.veneravel_mestre_vigente() v;
$$;

revoke all on function public.is_veneravel_mestre_atual() from public, anon;
revoke all on function public.veneravel_mestre_vigente() from public, anon;
grant execute on function public.is_veneravel_mestre_atual() to authenticated, service_role;
grant execute on function public.veneravel_mestre_vigente() to authenticated, service_role;

create or replace function public.atualizar_situacao_irmao(
  p_irmao_id uuid,
  p_situacao text,
  p_actor_auth_user_id uuid,
  p_ativo boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.irmaos%rowtype;
  actor uuid := p_actor_auth_user_id;
begin
  perform private.lock_cargos_institucionais();
  perform set_config('app.actor_id', coalesce(actor::text, ''), true);

  if not private.can_manage_institutional_offices_user(actor) then
    return jsonb_build_object('ok', false, 'status', 403, 'error', 'forbidden');
  end if;
  if p_situacao is null or p_situacao not in (
    'ativo', 'quiet_placet', 'transferencia', 'afastado', 'inativo', 'desligado', 'falecido'
  ) then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Situação inválida.');
  end if;

  select * into target from public.irmaos where id = p_irmao_id for update;
  if target.id is null then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Irmão não encontrado.');
  end if;

  update public.irmaos
  set
    situacao = p_situacao,
    ativo = coalesce(p_ativo, ativo)
  where id = p_irmao_id;

  return jsonb_build_object('ok', true, 'irmao_id', p_irmao_id, 'situacao', p_situacao);
end;
$$;

create or replace function public.atribuir_cargo_institucional(
  p_irmao_id uuid,
  p_cargo text,
  p_actor_auth_user_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.irmaos%rowtype;
  current_same public.irmaos_cargos%rowtype;
  occupant public.irmaos_cargos%rowtype;
  own_office public.irmaos_cargos%rowtype;
  actor uuid := p_actor_auth_user_id;
begin
  perform private.lock_cargos_institucionais();
  perform set_config('app.actor_id', coalesce(actor::text, ''), true);

  if not private.can_manage_institutional_offices_user(actor) then
    return jsonb_build_object('ok', false, 'status', 403, 'error', 'forbidden');
  end if;
  if p_cargo = 'veneravel_mestre' and not private.can_manage_veneravel_mestre_user(actor) then
    return jsonb_build_object('ok', false, 'status', 403, 'error', 'forbidden');
  end if;

  select * into target from public.irmaos where id = p_irmao_id for update;
  if target.id is null then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Irmão não encontrado.');
  end if;
  if target.situacao is distinct from 'ativo' then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Somente Irmão ativo pode exercer cargo institucional.');
  end if;

  select * into current_same
  from public.irmaos_cargos
  where irmao_id = p_irmao_id
    and cargo = p_cargo
    and encerrado_em is null
  for update;
  if current_same.id is not null then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Este Irmão já exerce este cargo.');
  end if;

  select * into occupant
  from public.irmaos_cargos
  where cargo = p_cargo
    and encerrado_em is null
  order by id
  for update;

  select * into own_office
  from public.irmaos_cargos
  where irmao_id = p_irmao_id
    and encerrado_em is null
  order by id
  for update;

  if own_office.id is not null and own_office.cargo = 'veneravel_mestre' and p_cargo is distinct from 'veneravel_mestre'
     and not private.can_manage_veneravel_mestre_user(actor) then
    return jsonb_build_object('ok', false, 'status', 403, 'error', 'forbidden');
  end if;

  if occupant.id is not null then
    update public.irmaos_cargos
    set encerrado_em = now()
    where id = occupant.id
      and encerrado_em is null;
    perform private.registrar_historico_cargo(
      occupant.irmao_id,
      'cargo_encerrado',
      occupant.cargo,
      coalesce(p_motivo, occupant.cargo),
      actor
    );
  end if;

  if own_office.id is not null then
    update public.irmaos_cargos
    set encerrado_em = now()
    where id = own_office.id
      and encerrado_em is null;
    perform private.registrar_historico_cargo(
      own_office.irmao_id,
      'cargo_encerrado',
      own_office.cargo,
      coalesce(p_motivo, own_office.cargo),
      actor
    );
  end if;

  insert into public.irmaos_cargos (irmao_id, cargo, atribuido_por)
  values (p_irmao_id, p_cargo, actor);

  perform private.registrar_historico_cargo(
    p_irmao_id,
    'cargo_atribuido',
    p_cargo,
    coalesce(p_motivo, p_cargo),
    actor
  );

  return jsonb_build_object('ok', true, 'cargo', p_cargo, 'irmao_id', p_irmao_id);
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'status', 409,
      'error', 'Este cargo já está ocupado. Atualize e tente novamente.'
    );
end;
$$;

create or replace function public.encerrar_cargo_institucional(
  p_irmao_id uuid,
  p_actor_auth_user_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_office public.irmaos_cargos%rowtype;
  actor uuid := p_actor_auth_user_id;
  closed integer;
begin
  perform private.lock_cargos_institucionais();
  perform set_config('app.actor_id', coalesce(actor::text, ''), true);

  if not private.can_manage_institutional_offices_user(actor) then
    return jsonb_build_object('ok', false, 'status', 403, 'error', 'forbidden');
  end if;

  select * into current_office
  from public.irmaos_cargos
  where irmao_id = p_irmao_id
    and encerrado_em is null
  order by id
  for update;

  if current_office.id is null then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Este Irmão não possui cargo vigente.');
  end if;
  if current_office.cargo = 'veneravel_mestre' and not private.can_manage_veneravel_mestre_user(actor) then
    return jsonb_build_object('ok', false, 'status', 403, 'error', 'forbidden');
  end if;

  closed := private.encerrar_cargos_vigentes(
    p_irmao_id,
    actor,
    coalesce(p_motivo, current_office.cargo)
  );
  if closed < 1 then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Este Irmão não possui cargo vigente.');
  end if;
  return jsonb_build_object('ok', true, 'cargo', current_office.cargo, 'irmao_id', p_irmao_id);
end;
$$;

revoke all on function public.atualizar_situacao_irmao(uuid, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.atribuir_cargo_institucional(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.encerrar_cargo_institucional(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.atualizar_situacao_irmao(uuid, text, uuid, boolean) to service_role;
grant execute on function public.atribuir_cargo_institucional(uuid, text, uuid, text) to service_role;
grant execute on function public.encerrar_cargo_institucional(uuid, uuid, text) to service_role;
