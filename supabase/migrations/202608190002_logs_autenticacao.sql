-- Logs de autenticação e limite por IP. Sem senha, token ou CIM em texto puro.

create table public.logs_autenticacao (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  cim_hash text,
  evento text not null check (evento in (
    'login_sucesso',
    'login_falha',
    'conta_bloqueada',
    'convite_enviado',
    'conta_ativada',
    'recuperacao_solicitada',
    'senha_alterada',
    'logout',
    'acesso_revogado'
  )),
  sucesso boolean not null,
  ip_hash text,
  user_agent text,
  criado_em timestamptz not null default now()
);

create index logs_autenticacao_criado_em_idx on public.logs_autenticacao (criado_em desc);
create index logs_autenticacao_evento_idx on public.logs_autenticacao (evento, criado_em desc);

create table public.auth_rate_ip (
  ip_hash text primary key,
  falhas integer not null default 0,
  janela_inicio timestamptz not null default now(),
  bloqueado_ate timestamptz
);

alter table public.logs_autenticacao enable row level security;
alter table public.auth_rate_ip enable row level security;

revoke all on table public.logs_autenticacao from public, anon, authenticated;
revoke all on table public.auth_rate_ip from public, anon, authenticated;
grant select on table public.logs_autenticacao to authenticated;
grant all on table public.logs_autenticacao to service_role;
grant all on table public.auth_rate_ip to service_role;

create policy "Administrador consulta logs"
on public.logs_autenticacao
for select
to authenticated
using (private.current_role() = 'administrador');

create or replace function private.purge_auth_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  dias integer;
  removidos integer;
begin
  select retencao_logs_dias into dias from public.configuracoes_autenticacao where id = 1;
  delete from public.logs_autenticacao
  where criado_em < now() - make_interval(days => coalesce(dias, 180));
  get diagnostics removidos = row_count;
  return removidos;
end;
$$;
