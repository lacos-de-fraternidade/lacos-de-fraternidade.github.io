-- Alinha convite Auth/app, endurece SELECT do próprio perfil e amplia eventos de log.

alter table public.configuracoes_autenticacao
  add column if not exists auth_otp_expira_segundos integer not null default 3600,
  add column if not exists max_recuperacoes_cim integer not null default 3,
  add column if not exists max_recuperacoes_ip integer not null default 5;

comment on column public.configuracoes_autenticacao.auth_otp_expira_segundos is
  'Deve coincidir com Authentication → Email OTP Expiration no Dashboard. O convite na tabela usa o mínimo entre este valor e convite_validade_horas.';

drop policy if exists "Usuário consulta o próprio perfil" on public.irmaos_autorizados;
create policy "Usuário consulta o próprio perfil"
on public.irmaos_autorizados
for select
to authenticated
using (
  auth_user_id = auth.uid()
  and ativo is true
  and conta_ativada is true
);

alter table public.logs_autenticacao drop constraint if exists logs_autenticacao_evento_check;
create index if not exists logs_autenticacao_ip_rate_idx
  on public.logs_autenticacao (evento, ip_hash, criado_em desc);
create index if not exists logs_autenticacao_cim_rate_idx
  on public.logs_autenticacao (evento, cim_hash, criado_em desc);

alter table public.logs_autenticacao
  add constraint logs_autenticacao_evento_check
  check (evento in (
    'login_sucesso',
    'login_falha',
    'conta_bloqueada',
    'convite_enviado',
    'conta_ativada',
    'recuperacao_solicitada',
    'senha_alterada',
    'logout',
    'acesso_revogado',
    'bootstrap_utilizado',
    'conta_desativada'
  ));
