-- Vínculo explícito entre a conta de acesso e o cadastro institucional.
-- auth.users.auth_user_id → irmaos_autorizados.id → irmaos.id
-- Não compara nomes. Não altera o fluxo de autenticação.

alter table public.irmaos_autorizados
  add column if not exists irmao_id uuid unique
    references public.irmaos (id)
    on delete set null;

create index if not exists irmaos_autorizados_irmao_id_idx
  on public.irmaos_autorizados (irmao_id);

comment on column public.irmaos_autorizados.irmao_id is
  'Cadastro institucional do Irmão autenticado. Preenchido pela Secretaria ou pela carga idempotente; o cliente só lê o UUID.';

create or replace function private.sync_vinculo_autorizado_para_irmao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.irmao_id is not distinct from old.irmao_id then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.irmao_id is not null
     and old.irmao_id is distinct from new.irmao_id then
    update public.irmaos
    set auth_member_id = null
    where id = old.irmao_id
      and auth_member_id = new.id;
  end if;

  if new.irmao_id is not null then
    update public.irmaos_autorizados
    set irmao_id = null
    where irmao_id = new.irmao_id
      and id is distinct from new.id;

    update public.irmaos
    set auth_member_id = new.id
    where id = new.irmao_id
      and auth_member_id is distinct from new.id;
  end if;

  return new;
end;
$$;

create or replace function private.sync_vinculo_irmao_para_autorizado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.auth_member_id is not distinct from old.auth_member_id then
    return new;
  end if;

  if old.auth_member_id is not null
     and (tg_op = 'DELETE' or old.auth_member_id is distinct from new.auth_member_id) then
    update public.irmaos_autorizados
    set irmao_id = null
    where id = old.auth_member_id
      and irmao_id = coalesce(old.id, new.id);
  end if;

  if tg_op <> 'DELETE' and new.auth_member_id is not null then
    update public.irmaos_autorizados
    set irmao_id = new.id
    where id = new.auth_member_id
      and irmao_id is distinct from new.id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists irmaos_autorizados_sync_vinculo on public.irmaos_autorizados;
create trigger irmaos_autorizados_sync_vinculo
after insert or update of irmao_id on public.irmaos_autorizados
for each row execute function private.sync_vinculo_autorizado_para_irmao();

drop trigger if exists irmaos_sync_vinculo on public.irmaos;
create trigger irmaos_sync_vinculo
after insert or update of auth_member_id on public.irmaos
for each row execute function private.sync_vinculo_irmao_para_autorizado();

-- Espelha o vínculo já gravado em irmaos.auth_member_id.
update public.irmaos_autorizados a
set irmao_id = i.id
from public.irmaos i
where a.irmao_id is null
  and i.auth_member_id = a.id;

-- Completa o sentido inverso quando só a CIM institucional já coincide.
update public.irmaos i
set auth_member_id = a.id
from public.irmaos_autorizados a
where i.auth_member_id is null
  and a.irmao_id is null
  and i.cim is not null
  and i.cim = a.cim;

update public.irmaos_autorizados a
set irmao_id = i.id
from public.irmaos i
where a.irmao_id is null
  and i.auth_member_id = a.id;
