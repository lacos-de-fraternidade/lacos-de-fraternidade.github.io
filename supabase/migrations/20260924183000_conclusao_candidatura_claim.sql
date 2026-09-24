-- Claim atômico da conclusão pública da candidatura.
-- Candidaturas já concluídas (used_at preenchido) permanecem compatíveis.

alter table public.interesse_upload_token
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_expires_at timestamptz;

comment on column public.interesse_upload_token.claimed_at is
  'Início do processamento exclusivo da conclusão. Null se disponível ou já liberado.';
comment on column public.interesse_upload_token.claim_expires_at is
  'Fim do lease de processamento. Após o vencimento, um retry pode readquirir o claim se used_at continuar null.';

create or replace function public.claim_conclusao_candidatura(p_token_hash text)
returns table (
  resultado text,
  token_id uuid,
  interesse_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  claimed public.interesse_upload_token%rowtype;
  current public.interesse_upload_token%rowtype;
begin
  if p_token_hash is null or length(trim(p_token_hash)) = 0 then
    return;
  end if;

  update public.interesse_upload_token t
  set
    claimed_at = now_ts,
    claim_expires_at = now_ts + interval '2 minutes'
  where t.token_hash = p_token_hash
    and t.used_at is null
    and t.expires_at > now_ts
    and (
      t.claimed_at is null
      or t.claim_expires_at is null
      or t.claim_expires_at <= now_ts
    )
  returning t.* into claimed;

  if claimed.id is not null then
    resultado := 'adquirido';
    token_id := claimed.id;
    interesse_id := claimed.interesse_id;
    return next;
    return;
  end if;

  select t.*
  into current
  from public.interesse_upload_token t
  where t.token_hash = p_token_hash;

  if current.id is null then
    return;
  end if;

  token_id := current.id;
  interesse_id := current.interesse_id;
  if current.used_at is not null then
    resultado := 'concluido';
  elsif current.claimed_at is not null
    and current.claim_expires_at is not null
    and current.claim_expires_at > now_ts then
    resultado := 'em_processamento';
  else
    resultado := 'indisponivel';
  end if;
  return next;
end;
$$;

create or replace function public.release_conclusao_claim(p_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.interesse_upload_token
  set claimed_at = null,
      claim_expires_at = null
  where id = p_token_id
    and used_at is null;
  return found;
end;
$$;

create or replace function public.finalize_conclusao_candidatura(
  p_token_id uuid,
  p_interesse_id uuid,
  p_notificacao text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.interesse
  set
    status = 'Recebida',
    documentacao_completa = true,
    notificacao_proponente = p_notificacao
  where id = p_interesse_id;
  if not found then
    return false;
  end if;

  update public.interesse_upload_token
  set used_at = clock_timestamp()
  where id = p_token_id
    and used_at is null;
  return found;
end;
$$;

revoke all on function public.claim_conclusao_candidatura(text) from public, anon, authenticated;
revoke all on function public.release_conclusao_claim(uuid) from public, anon, authenticated;
revoke all on function public.finalize_conclusao_candidatura(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.claim_conclusao_candidatura(text) to service_role;
grant execute on function public.release_conclusao_claim(uuid) to service_role;
grant execute on function public.finalize_conclusao_candidatura(uuid, uuid, text) to service_role;
