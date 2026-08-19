-- Mutações de membros ficam na Edge Function (service_role).
-- search_path fixo nas funções que ainda estavam mutáveis.

alter function public.normalize_cim(text) set search_path = public, pg_temp;
alter function public.normalize_email(text) set search_path = public, pg_temp;
alter function private.touch_atualizado_em() set search_path = public, pg_temp;
alter function private.normalize_irmao_row() set search_path = public, pg_temp;

revoke insert, update, delete on table public.irmaos_autorizados from authenticated;
grant select on table public.irmaos_autorizados to authenticated;

drop policy if exists "Secretaria cadastra membros" on public.irmaos_autorizados;
drop policy if exists "Secretaria atualiza membros" on public.irmaos_autorizados;
