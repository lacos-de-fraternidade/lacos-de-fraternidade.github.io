-- Amplia o cadastro público de candidato (Pré-Proposta / Proposta de Admissão).
-- Preserva public.interesse e registros históricos. proponente_id permanece
-- nulo no legado; novas submissões exigem o valor no backend.
-- NÃO aplicar esta migration no projeto remoto nesta entrega: versionar e
-- executar depois, junto com o deploy das Edge Functions e a criação do
-- bucket privado candidaturas-documentos (incluído abaixo, 5 MB, PDF/JPEG/PNG).
-- O bucket cartilha permanece exclusivo da cartilha do candidato.

create extension if not exists pg_trgm with schema extensions;

-- Interesse e cartilha já existem em produção via setup.sql. Recriar de forma
-- idempotente para ambientes que só aplicam migrations numeradas (CI/local).
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

alter table public.interesse
  add column if not exists data_nascimento date,
  add column if not exists estado_civil text,
  add column if not exists familiar_nome text,
  add column if not exists familiar_whatsapp text,
  add column if not exists familiar_papel text,
  add column if not exists consentimento_familiar boolean,
  add column if not exists situacao_familiar text,
  add column if not exists whatsapp text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists motivacao text,
  add column if not exists lgpd_aceite boolean,
  add column if not exists lgpd_versao text,
  add column if not exists lgpd_aceite_em timestamptz,
  add column if not exists status text default 'Recebida';

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

alter table public.interesse
  add column if not exists proponente_id uuid references public.irmaos (id) on delete set null,
  add column if not exists rg text,
  add column if not exists rg_orgao text,
  add column if not exists rg_expedicao date,
  add column if not exists nome_mae text,
  add column if not exists nome_pai text,
  add column if not exists naturalidade text,
  add column if not exists nacionalidade text,
  add column if not exists uf_nascimento text,
  add column if not exists data_casamento date,
  add column if not exists esposa_nascimento date,
  add column if not exists telefone_emergencia text,
  add column if not exists plano_saude text,
  add column if not exists tipo_sanguineo text,
  add column if not exists tratamento_saude text,
  add column if not exists pais text,
  add column if not exists tempo_residencia text,
  add column if not exists grau_instrucao text,
  add column if not exists formacao text,
  add column if not exists especializacao text,
  add column if not exists profissao text,
  add column if not exists ocupacao text,
  add column if not exists especialidade_profissional text,
  add column if not exists renda_mensal text,
  add column if not exists renda_familiar text,
  add column if not exists empresa text,
  add column if not exists cargo_empresa text,
  add column if not exists data_admissao_empresa date,
  add column if not exists empresa_logradouro text,
  add column if not exists empresa_numero text,
  add column if not exists empresa_bairro text,
  add column if not exists empresa_cep text,
  add column if not exists empresa_cidade text,
  add column if not exists empresa_estado text,
  add column if not exists empresa_pais text,
  add column if not exists empresa_telefone text,
  add column if not exists empresa_ramal text,
  add column if not exists foi_militar boolean,
  add column if not exists patente_militar text,
  add column if not exists local_militar text,
  add column if not exists possui_filhos boolean,
  add column if not exists entidades text,
  add column if not exists processo_criminal boolean,
  add column if not exists processo_criminal_detalhe text,
  add column if not exists filiacao_partidaria boolean,
  add column if not exists partido text,
  add column if not exists outras_informacoes text,
  add column if not exists documentacao_completa boolean not null default false,
  add column if not exists notificacao_proponente text;

comment on column public.interesse.proponente_id is
  'Irmão institucional que convidou o candidato. Nulo no legado; obrigatório em novas submissões.';

create index if not exists interesse_proponente_id_idx
  on public.interesse (proponente_id);

create table if not exists public.interesse_filhos (
  id uuid primary key default gen_random_uuid(),
  interesse_id uuid not null references public.interesse (id) on delete cascade,
  nome text not null,
  sexo text not null check (sexo in ('masculino', 'feminino')),
  data_nascimento date not null,
  ordem integer not null check (ordem >= 1),
  criado_em timestamptz not null default now()
);

create index if not exists interesse_filhos_interesse_idx
  on public.interesse_filhos (interesse_id, ordem);

create table if not exists public.interesse_referencias (
  id uuid primary key default gen_random_uuid(),
  interesse_id uuid not null references public.interesse (id) on delete cascade,
  ordem integer not null check (ordem between 1 and 3),
  nome text not null,
  telefone text not null,
  logradouro text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  criado_em timestamptz not null default now(),
  unique (interesse_id, ordem)
);

create table if not exists public.interesse_referencia_comercial (
  interesse_id uuid primary key references public.interesse (id) on delete cascade,
  razao_social text not null,
  telefone text,
  logradouro text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  criado_em timestamptz not null default now()
);

create table if not exists public.interesse_documentos (
  id uuid primary key default gen_random_uuid(),
  interesse_id uuid not null references public.interesse (id) on delete cascade,
  tipo text not null check (tipo in (
    'certidao_nascimento',
    'certidao_casamento',
    'identidade',
    'cpf',
    'titulo_eleitoral',
    'comprovante_rendimentos'
  )),
  storage_path text not null,
  mime text not null,
  tamanho integer not null check (tamanho > 0),
  nome_original text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (interesse_id, tipo)
);

create table if not exists public.interesse_upload_token (
  id uuid primary key default gen_random_uuid(),
  interesse_id uuid not null references public.interesse (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists public.candidatura_busca_rate (
  chave text primary key,
  falhas integer not null default 0,
  janela_inicio timestamptz not null default now()
);

alter table public.interesse_filhos enable row level security;
alter table public.interesse_referencias enable row level security;
alter table public.interesse_referencia_comercial enable row level security;
alter table public.interesse_documentos enable row level security;
alter table public.interesse_upload_token enable row level security;
alter table public.candidatura_busca_rate enable row level security;

revoke all on table public.interesse_filhos from public, anon, authenticated;
revoke all on table public.interesse_referencias from public, anon, authenticated;
revoke all on table public.interesse_referencia_comercial from public, anon, authenticated;
revoke all on table public.interesse_documentos from public, anon, authenticated;
revoke all on table public.interesse_upload_token from public, anon, authenticated;
revoke all on table public.candidatura_busca_rate from public, anon, authenticated;

grant all on table public.interesse_filhos to service_role;
grant all on table public.interesse_referencias to service_role;
grant all on table public.interesse_referencia_comercial to service_role;
grant all on table public.interesse_documentos to service_role;
grant all on table public.interesse_upload_token to service_role;
grant all on table public.candidatura_busca_rate to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidaturas-documentos',
  'candidaturas-documentos',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists irmaos_nome_normalizado_trgm_idx
  on public.irmaos using gin (nome_normalizado extensions.gin_trgm_ops);

create or replace function public.buscar_proponentes_publicos(p_q text)
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with q as (
    select upper(regexp_replace(btrim(coalesce(p_q, '')), '\s+', ' ', 'g')) as termo
  )
  select i.id, i.nome
  from public.irmaos i
  cross join q
  where i.ativo is true
    and i.situacao = 'ativo'
    and length(q.termo) >= 4
    and (
      i.nome_normalizado like '%' || q.termo || '%'
      or split_part(i.nome_normalizado, ' ', 1) like left(q.termo, 4) || '%'
      or extensions.word_similarity(q.termo, i.nome_normalizado) >= 0.35
      or extensions.similarity(split_part(i.nome_normalizado, ' ', 1), q.termo) >= 0.35
    )
  order by
    (i.nome_normalizado like q.termo || '%') desc,
    extensions.word_similarity(q.termo, i.nome_normalizado) desc,
    i.nome
  limit 8;
$$;

create or replace function public.proponente_elegivel(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.irmaos i
    where i.id = p_id
      and i.ativo is true
      and i.situacao = 'ativo'
  );
$$;

revoke all on function public.buscar_proponentes_publicos(text) from public, anon, authenticated;
revoke all on function public.proponente_elegivel(uuid) from public, anon, authenticated;
grant execute on function public.buscar_proponentes_publicos(text) to service_role;
grant execute on function public.proponente_elegivel(uuid) to service_role;
