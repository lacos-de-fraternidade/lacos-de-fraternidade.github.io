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
