create table if not exists public.interesse (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  email text not null,
  endereco text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cartilha_token (
  id uuid primary key default gen_random_uuid(),
  interesse_id uuid not null references public.interesse (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists interesse_email_created_at_idx
  on public.interesse (email, created_at desc);

create index if not exists cartilha_token_expires_at_idx
  on public.cartilha_token (expires_at);

alter table public.interesse enable row level security;
alter table public.cartilha_token enable row level security;

revoke all on table public.interesse from anon, authenticated, public;
revoke all on table public.cartilha_token from anon, authenticated, public;

grant all on table public.interesse to service_role;
grant all on table public.cartilha_token to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cartilha',
  'cartilha',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
