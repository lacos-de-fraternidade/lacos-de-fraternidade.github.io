# Inventário da branch `feat/members-authentication`

A branch começou como autenticação da Área dos Irmãos e passou a incluir conteúdo institucional, administração e interface. Este arquivo registra o escopo real em relação à `main`. Não descreve trabalho futuro.

## Autenticação

- Login por CIM e senha (`login-with-cim`, `/area-restrita/login/`)
- Convite, confirmação de CIM e criação de senha (`ativar-conta`, `/area-restrita/ativar/`)
- Recuperação e redefinição (`recuperar-senha-cim`, `/area-restrita/recuperar/`, `/area-restrita/redefinir-senha/`)
- Sessão via `setSession` oficial; logout redireciona para o site institucional
- Bloqueio, revogação, rate limiting e logs em `logs_autenticacao`
- HMAC-SHA-256 de CIM e IP com `AUTH_HASH_PEPPER`
- Bootstrap temporário do primeiro administrador

## Área dos Irmãos

- Dashboard (`/area-restrita/`)
- Aniversários
- Datas Maçônicas / iniciações
- Calendário
- Perfil
- Header e footer compartilhados (`shell.js`)

## Administração

- Gestão de Irmãos (`/area-restrita/gestao/`)
- Cadastro institucional
- Configurar acesso (estados de conta, liberar acesso, reenvio)
- Quiet placet e transferência
- Familiares e casamentos
- Eventos e sessões ordinárias
- Comunicados
- Convites
- Logs
- Configurações
- Redirecionamento de `/administracao/` e `/celebracoes/` para a Gestão

## Banco de dados

Tabelas principais: `irmaos_autorizados`, `configuracoes_autenticacao`, `logs_autenticacao`, `auth_rate_ip`, `irmaos`, `familiares`, `casamentos`, `comunicados_internos`, `eventos_internos`, `celebracoes`, `irmaos_quiet_placet`, `irmaos_transferencias`, `irmaos_historico`, `datas_institucionais`.

RLS habilitada nas tabelas expostas. Mutações administrativas passam pela Edge Function com `service_role`. Autorização lida de `irmaos_autorizados` por `auth_user_id`, não de `user_metadata`.

## Edge Functions criadas ou alteradas nesta branch

- `login-with-cim`
- `ativar-conta`
- `recuperar-senha-cim`
- `gerenciar-irmao`
- `bootstrap-convite-admin`
- compartilhados: `members.ts`, `staff-actions.ts`, `gestao.ts`, `cadastro.ts`, `site-url.ts`, `cim.ts`, `password.ts`, `crypto.ts`, `cors.ts`

## Interface (principais arquivos)

**Novos:** `area-restrita/gestao/`, módulos em `area-restrita/js/` (gestão, datas, sessões, comunicados, senha, modal, toasts, ativação), páginas de conteúdo interno com scripts próprios, testes em `tests/`.

**Alterados:** login, ativar, recuperar, redefinir, home, shell, CSS da área, documentação operacional.

## Dados que não entram no Git

- CSVs da extração GLMERJ (`data/glmerj/`)
- Lista oficial de CIM e o SQL pontual de vínculo
- `.env` e `supabase/.temp/`
