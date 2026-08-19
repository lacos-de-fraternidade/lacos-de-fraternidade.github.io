# Área dos Irmãos

Acesso autenticado por **CIM + senha**, com cadastro prévio da Secretaria. O GitHub Pages só entrega a interface. A proteção real está no Supabase (Auth, RLS e Edge Functions).

## MFA e CAPTCHA (pendentes)

- MFA obrigatório para `secretario` e `administrador` **não está ativo**.
- A coluna `configuracoes_autenticacao.mfa_obrigatorio_admin` permanece `false`.
- Tarefas: TOTP no Auth, exigir AAL2 nas ações críticas, CAPTCHA após falhas repetidas.

Não tratar a área administrativa atual como se MFA já existisse.

## Secrets no Supabase

Além das chaves padrão do projeto:

- `AUTH_HASH_PEPPER` — hash de CIM/IP nos logs (recomendado)
- `BOOTSTRAP_INVITE_SECRET` — convite do primeiro administrador, só enquanto não houver admin ativado
- `PUBLIC_SITE_URL` — padrão `https://lacos-de-fraternidade.github.io`

Nunca colocar `service_role` no frontend.

## Primeiro administrador

No SQL Editor:

```sql
select public.bootstrap_primeiro_administrador(
  '00000001',
  'Nome do Secretário',
  'email-institucional@dominio.com'
);
```

Depois, com o secret de bootstrap:

```http
POST /functions/v1/gerenciar-irmao
apikey: <publishable>
x-bootstrap-secret: <BOOTSTRAP_INVITE_SECRET>
{ "acao": "enviar_convite", "id": "<uuid do administrador>" }
```

O Irmão abre o e-mail, informa a CIM, cria a senha e ativa a conta em `/area-restrita/ativar/`.

## Cadastrar um Irmão

1. Acesse `/area-restrita/administracao/` como secretário ou administrador.
2. Informe nome, CIM e e-mail.
3. Cadastre.
4. Envie o convite.

## Login de teste

Use apenas CIM e senha fictícias. O frontend chama `login-with-cim` e grava a sessão oficial do Supabase Auth. Não há cadastro público.

## Configuração manual no Dashboard

1. Authentication → URL Configuration: `https://lacos-de-fraternidade.github.io/area-restrita/ativar/` e `https://lacos-de-fraternidade.github.io/area-restrita/redefinir-senha/`
2. Desativar sign-ups públicos (Authentication → Providers → Email → Disable sign ups)
3. Configurar SMTP para convite e recuperação
4. Secrets: `AUTH_HASH_PEPPER`, `BOOTSTRAP_INVITE_SECRET`, `PUBLIC_SITE_URL`
5. As Edge Functions `login-with-cim`, `ativar-conta`, `recuperar-senha-cim` e `gerenciar-irmao` usam `verify_jwt = false`; a autorização é feita no código (chave publicável + sessão + perfil)
6. Tabelas `auth_rate_ip` e `configuracoes_autenticacao` têm RLS sem política para `anon`/`authenticated` de propósito: só `service_role` acessa
7. GitHub Pages não envia cabeçalhos HTTP customizados; CSP e Referrer-Policy entram via `<meta>` nas páginas da área restrita
