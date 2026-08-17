alter table public.interesse add column if not exists data_nascimento date;
alter table public.interesse add column if not exists estado_civil text;
alter table public.interesse add column if not exists familiar_nome text;
alter table public.interesse add column if not exists familiar_whatsapp text;
alter table public.interesse add column if not exists familiar_papel text;
alter table public.interesse add column if not exists consentimento_familiar boolean;
alter table public.interesse add column if not exists situacao_familiar text;
alter table public.interesse add column if not exists whatsapp text;
alter table public.interesse add column if not exists cep text;
alter table public.interesse add column if not exists logradouro text;
alter table public.interesse add column if not exists numero text;
alter table public.interesse add column if not exists complemento text;
alter table public.interesse add column if not exists bairro text;
alter table public.interesse add column if not exists cidade text;
alter table public.interesse add column if not exists estado text;
alter table public.interesse add column if not exists motivacao text;
alter table public.interesse add column if not exists lgpd_aceite boolean;
alter table public.interesse add column if not exists lgpd_versao text;
alter table public.interesse add column if not exists lgpd_aceite_em timestamptz;
alter table public.interesse add column if not exists status text default 'Recebida';

update public.interesse
set cpf = regexp_replace(cpf, '\D', '', 'g')
where cpf ~ '\D';

update public.interesse
set email = lower(btrim(email))
where email <> lower(btrim(email));

update public.interesse
set status = 'Recebida'
where status is null;
