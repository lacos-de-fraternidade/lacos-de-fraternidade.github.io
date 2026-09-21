-- Inclui comprovante de residência recente nos documentos da candidatura.
-- Incremental: não recria tabelas nem altera produção remotamente nesta rodada.

alter table public.interesse_documentos
  drop constraint if exists interesse_documentos_tipo_check;

alter table public.interesse_documentos
  add constraint interesse_documentos_tipo_check
  check (tipo in (
    'certidao_nascimento',
    'certidao_casamento',
    'identidade',
    'cpf',
    'titulo_eleitoral',
    'comprovante_rendimentos',
    'comprovante_residencia'
  ));

comment on column public.interesse_documentos.tipo is
  'Tipo documental da candidatura. comprovante_residencia = comprovante de residência recente.';
