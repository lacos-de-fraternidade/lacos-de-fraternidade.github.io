-- Integridade de casamentos ativos: um Irmão e uma cunhada por vínculo vigente.

create unique index if not exists casamentos_irmao_ativo_key
  on public.casamentos (irmao_id)
  where ativo is true;

create unique index if not exists casamentos_conjuge_ativo_key
  on public.casamentos (conjuge_id)
  where ativo is true and conjuge_id is not null;

create or replace function private.validate_casamento_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  irmao_ativo boolean;
  familiar_row public.familiares%rowtype;
begin
  if new.ativo is not true then
    return new;
  end if;

  select ativo into irmao_ativo from public.irmaos where id = new.irmao_id;
  if irmao_ativo is distinct from true then
    raise exception 'casamento_irmao_inativo';
  end if;

  if new.conjuge_id is null then
    raise exception 'casamento_conjuge_obrigatorio';
  end if;

  select * into familiar_row from public.familiares where id = new.conjuge_id;
  if familiar_row.id is null
     or familiar_row.ativo is distinct from true
     or familiar_row.irmao_id is distinct from new.irmao_id
     or familiar_row.parentesco not in ('esposa', 'companheira') then
    raise exception 'casamento_conjuge_incompativel';
  end if;

  return new;
end;
$$;

drop trigger if exists casamentos_validate on public.casamentos;
create trigger casamentos_validate
before insert or update on public.casamentos
for each row execute function private.validate_casamento_row();
