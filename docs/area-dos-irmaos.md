# Área dos Irmãos

Acesso autenticado por **CIM + senha**, com cadastro prévio da Secretaria. O GitHub Pages só entrega a interface. A proteção real está no Supabase (Auth, RLS e Edge Functions).

## MFA e CAPTCHA (pendentes)

- MFA obrigatório para `secretario` e `administrador` **não está ativo**.
- A coluna `configuracoes_autenticacao.mfa_obrigatorio_admin` permanece `false`.
- Tarefas: TOTP no Auth, exigir AAL2 nas ações críticas, CAPTCHA após falhas repetidas.

Não tratar a área administrativa atual como se MFA já existisse.

## Secrets no Supabase

Além das chaves padrão do projeto:

| Secret | Obrigatório | Uso |
| --- | --- | --- |
| `AUTH_HASH_PEPPER` | **Sim, antes do uso em produção** | HMAC-SHA-256 de CIM e IP nos logs e no rate limit. Mínimo 16 caracteres. Sem ele o login responde de forma genérica e não autentica. |
| `BOOTSTRAP_INVITE_SECRET` | Só na ativação inicial | Convite do primeiro administrador. Mínimo 16 caracteres. **Remover ou rotacionar depois da primeira conta ativada.** |
| `PUBLIC_SITE_URL` | Recomendado | Padrão `https://lacos-de-fraternidade.github.io` |

Nunca colocar `service_role` no frontend.

O hash dos logs é:

```text
HMAC-SHA-256(AUTH_HASH_PEPPER, "cim:" + cim_normalizada)
HMAC-SHA-256(AUTH_HASH_PEPPER, "ip:" + ip_normalizado)
```

Trocar o pepper invalida hashes anteriores (esperado).

## JWT das Edge Functions

| Função | `verify_jwt` | Motivo |
| --- | --- | --- |
| `login-with-cim` | `false` | Ainda não há sessão |
| `recuperar-senha-cim` | `false` | Ainda não há sessão |
| `bootstrap-convite-admin` | `false` | Procedimento único, secret de bootstrap |
| `ativar-conta` | `true` | Exige JWT do convite |
| `gerenciar-irmao` | `true` | Exige JWT de usuário autenticado |

`gerenciar-irmao` ainda valida internamente:

1. `Authorization: Bearer <JWT>`
2. `auth.getUser(token)` com cliente **não** administrativo
3. perfil lido em `irmaos_autorizados` por `auth_user_id`
4. `ativo = true` e `conta_ativada = true`
5. ação permitida conforme `irmao` / `secretario` / `administrador`

O frontend não envia `user_id`, perfil de ator ou e-mail para autorização. Valores no body (por exemplo `perfil` ao cadastrar) nunca substituem o perfil do JWT.

## Login e sessão

- A senha é verificada com `signInWithPassword` num cliente anon/publicável (`persistSession: false`).
- O cliente administrativo **não** autentica a senha.
- A resposta leva `Cache-Control: no-store`.
- Tokens não são registrados em logs.
- O frontend só persiste a sessão via `setSession` da biblioteca oficial.

## Primeiro administrador (temporário)

1. No SQL Editor, **uma única vez**:

```sql
select public.bootstrap_primeiro_administrador(
  '00000001',
  'Nome do Secretário',
  'email-institucional@dominio.com'
);
```

Se já existir qualquer registro com perfil `administrador`, a função SQL recusa a execução.

2. Envie o convite (a resposta é sempre a mesma, exista ou não administrador):

```http
POST /functions/v1/bootstrap-convite-admin
apikey: <publishable>
x-bootstrap-secret: <BOOTSTRAP_INVITE_SECRET>
```

3. Ative a conta em `/area-restrita/ativar/`.

4. **Imediatamente depois da primeira ativação:**

- remova ou rotacione `BOOTSTRAP_INVITE_SECRET` no Dashboard;
- não volte a chamar `bootstrap-convite-admin`;
- novos administradores nascem só pela área administrativa, por um administrador já autenticado.

O uso do endpoint é registrado em `logs_autenticacao` (`bootstrap_utilizado`), sem revelar se um administrador já existe.

## Cadastrar um Irmão

1. Acesse `/area-restrita/administracao/` como secretário ou administrador.
2. Informe nome, CIM e e-mail.
3. Cadastre.
4. Envie o convite.

## Desativação e revogação

`ativo = false` corta o acesso de três formas:

- RLS (`current_role()` e a política do próprio perfil exigem `ativo` e `conta_ativada`);
- Edge Functions (`requireActiveMember`);
- o guard do frontend consulta o perfil atual e redireciona.

Além disso, **Desativar** e **Revogar** invalidam refresh tokens (`signOut` global) e aplicam `ban_duration` no Auth. O access token restante só vale até expirar; por isso mantenha o JWT curto no Dashboard (sugestão: 15 minutos).

**Revogar** também desvincula `auth_user_id` e marca a conta como não ativada.

## Convites: duas expirações

Há duas janelas, e **as duas precisam ser válidas** na ativação:

1. expiração do link/OTP no Supabase Auth (Dashboard → Authentication → Email OTP Expiration);
2. `convite_expira_em` na tabela, gravado como o **mínimo** entre `convite_validade_horas` e `auth_otp_expira_segundos`.

Alinhe os dois valores. Recomendação inicial: **3600 segundos (1 hora)** nos dois lados, que é o padrão conservador do Auth. Se quiser convites de 24 h, aumente **os dois**.

A sessão do convite (Auth) é a fonte que permite abrir `/area-restrita/ativar/`. A tabela é a fonte que a Edge Function `ativar-conta` consulta.

## Recuperação de senha

- A resposta é idêntica para CIM existente, inexistente, inativa ou limitada.
- Há limite por IP e por CIM (`max_recuperacoes_ip`, `max_recuperacoes_cim`).
- O e-mail nunca volta na resposta.
- A nova senha é definida com `auth.updateUser` na página de redefinição, nunca enviada à Edge Function.
- Cadastre `https://lacos-de-fraternidade.github.io/area-restrita/redefinir-senha/` nas Redirect URLs.

## Login de teste

Use apenas CIM e senha fictícias. O frontend chama `login-with-cim` e grava a sessão oficial do Supabase Auth. Não há cadastro público.

## Configuração manual no Dashboard (bloqueia merge produtivo)

1. **Definir `AUTH_HASH_PEPPER`** (mínimo 16 caracteres, aleatório).
2. Authentication → URL Configuration: `https://lacos-de-fraternidade.github.io/area-restrita/ativar/` e `https://lacos-de-fraternidade.github.io/area-restrita/redefinir-senha/`
3. Authentication → JWT expiry: preferir 900 segundos.
4. Authentication → Email OTP Expiration: igual a `auth_otp_expira_segundos` (padrão 3600).
5. Desativar sign-ups públicos.
6. Configurar SMTP.
7. Depois do primeiro administrador ativado: remover `BOOTSTRAP_INVITE_SECRET`.
8. Tabelas `auth_rate_ip` e `configuracoes_autenticacao` têm RLS sem política para `anon`/`authenticated` de propósito: só `service_role` acessa.
9. GitHub Pages não envia cabeçalhos HTTP customizados; CSP e Referrer-Policy entram via `<meta>`.

## Testes de integração (projeto de teste)

Os testes unitários não criam usuários reais. Para a bateria ao vivo, use um projeto Supabase de teste e dados fictícios:

```bash
AUTH_INTEGRATION=1 SUPABASE_URL=... SUPABASE_ANON_KEY=... node --test tests/auth-integration.test.mjs
```

Checklist manual no projeto de teste:

1. criar membro autorizado;
2. enviar convite;
3. aceitar convite e definir senha;
4. login com CIM;
5. consultar tabela protegida;
6. CIM errada / senha errada (mesma mensagem);
7. desativar usuário e confirmar que a sessão perde os dados (RLS);
8. recuperação e redefinição;
9. `gerenciar-irmao` sem `Authorization`, com JWT de Irmão, JWT expirado, `perfil` no body e usuário desativado.
