-- Conclusão atômica da candidatura (story 17tgmdxj77n).
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into public.irmaos (id, nome, cim, situacao, ativo, origem)
values ('17190077-0000-4000-8000-000000000001', 'IRMAO CLAIM TESTE', '17190077', 'ativo', true, 'teste')
on conflict (id) do update set nome = excluded.nome, ativo = true, situacao = 'ativo';

insert into public.interesse (id, nome, email, cpf, endereco, status, documentacao_completa, proponente_id)
values (
  '17190077-0000-4000-8000-000000000010',
  'Candidato Claim',
  'claim@invalid.test',
  '39053344777',
  'Rua Claim, 1',
  'Em analise',
  false,
  '17190077-0000-4000-8000-000000000001'
);

insert into public.interesse_upload_token (id, interesse_id, token_hash, expires_at)
values (
  '17190077-0000-4000-8000-000000000020',
  '17190077-0000-4000-8000-000000000010',
  'hash-claim-livre',
  now() + interval '40 minutes'
);

select is(
  (select resultado from public.claim_conclusao_candidatura('hash-claim-livre')),
  'adquirido',
  'primeiro claim adquire o processamento'
);

select is(
  (select resultado from public.claim_conclusao_candidatura('hash-claim-livre')),
  'em_processamento',
  'segundo claim simultâneo não adquire de novo'
);

select ok(
  public.release_conclusao_claim('17190077-0000-4000-8000-000000000020'),
  'release devolve o lease quando used_at ainda é null'
);

select is(
  (select resultado from public.claim_conclusao_candidatura('hash-claim-livre')),
  'adquirido',
  'após release o retry readquire o claim'
);

update public.interesse_upload_token
set claimed_at = now() - interval '5 minutes',
    claim_expires_at = now() - interval '3 minutes'
where token_hash = 'hash-claim-livre';

select is(
  (select resultado from public.claim_conclusao_candidatura('hash-claim-livre')),
  'adquirido',
  'lease vencido sem used_at permite retry'
);

update public.interesse_upload_token
set expires_at = now() - interval '1 minute',
    claimed_at = null,
    claim_expires_at = null
where token_hash = 'hash-claim-livre';

select is(
  (select resultado from public.claim_conclusao_candidatura('hash-claim-livre')),
  'indisponivel',
  'token expirado não é reivindicado'
);

update public.interesse_upload_token
set expires_at = now() + interval '40 minutes',
    claimed_at = null,
    claim_expires_at = null
where token_hash = 'hash-claim-livre';

select ok(
  public.finalize_conclusao_candidatura(
    '17190077-0000-4000-8000-000000000020',
    '17190077-0000-4000-8000-000000000010',
    'enviada'
  ),
  'finalize persiste used_at e documentacao_completa'
);

select is(
  (select resultado from public.claim_conclusao_candidatura('hash-claim-livre')),
  'concluido',
  'token concluído não volta a processar'
);

select is(
  (select documentacao_completa from public.interesse where id = '17190077-0000-4000-8000-000000000010'),
  true,
  'finalize marca a candidatura como concluída'
);

select ok(
  not has_function_privilege('anon', 'public.claim_conclusao_candidatura(text)', 'execute'),
  'anon não executa o claim da conclusão'
);

select * from finish();
rollback;
