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
5. ação permitida conforme `irmao` / `secretario` / `veneravel_mestre` / `administrador`

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

## Cadastrar um Irmão e liberar o acesso

1. Acesse `/area-restrita/gestao/` como Secretaria, Venerável Mestre ou Administrador.
2. Use **+ Novo Irmão**.
3. Informe o nome. CIM e e-mail são opcionais até o momento de criar o acesso.
4. No detalhe do Irmão, abra **Configurar acesso**.
5. Confira o estado da conta. Sem acesso, o botão principal é **Liberar acesso**.
6. Confirme o envio. O modal permanece aberto e passa para **Convite enviado**.

O Irmão recebe o e-mail, confirma a CIM, cria a senha e vê a confirmação de sucesso antes de entrar em `/area-restrita/login/`.

Perfis internos: `irmao`, `secretario`, `veneravel_mestre`, `administrador`. Secretaria e Venerável podem atribuir Irmão e Secretaria. Só Administrador concede Venerável Mestre ou Administrador. A autorização não fica em `user_metadata` nem no cargo institucional.

As rotas antigas `/area-restrita/administracao/` e `/area-restrita/celebracoes/` redirecionam para a Gestão de Irmãos.

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

O e-mail **não** aponta para `/auth/v1/verify`. Ele abre o site da Loja com `token_hash`. A página só consome o token quando o irmão clica em **Continuar a ativação**, para o Gmail não gastar o link sozinho.

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
7. Aplicar os templates de convite e recuperação em português. Ver `docs/supabase-email-templates.md`.
8. Depois do primeiro administrador ativado: remover `BOOTSTRAP_INVITE_SECRET`.
9. Tabelas `auth_rate_ip` e `configuracoes_autenticacao` têm RLS sem política para `anon`/`authenticated` de propósito: só `service_role` acessa.
10. GitHub Pages não envia cabeçalhos HTTP customizados; CSP e Referrer-Policy entram via `<meta>`.

## Cadastro institucional e extração GLMERJ

A Área dos Irmãos usa o Supabase como fonte. Não há sincronização automática com a GLMERJ, parser HTML em produção nem armazenamento de sessão externa.

Há dois cadastros distintos, agora ligados por UUID:

```text
auth.users.id
    ↓ irmaos_autorizados.auth_user_id
irmaos_autorizados.id
    ↓ irmaos_autorizados.irmao_id
irmaos.id
```

O sentido inverso (`irmaos.auth_member_id`) permanece e é sincronizado por trigger. O frontend **não** compara nomes e **não** busca CIM publicamente: o guard lê `irmao_id` do próprio perfil (`auth_user_id = auth.uid()`).

| Tabela | Função |
| --- | --- |
| `irmaos_autorizados` | Acesso: CIM, e-mail, senha no Auth, perfil, `irmao_id` |
| `irmaos` / `familiares` / `casamentos` | Celebrações institucionais. Um Irmão pode existir aqui sem login |
| `irmaos_cargos` | Cargo institucional vigente (`encerrado_em is null`) e histórico de mandatos |

Perfil de acesso e cargo institucional são entidades independentes.

Perfis do portal (`irmaos_autorizados.perfil`): `irmao`, `secretario`, `veneravel_mestre`, `administrador`. O perfil responde o que o usuário pode fazer no portal. `veneravel_mestre` herda as permissões operacionais de `secretario` (Gestão de Irmãos, convites, eventos, comunicados) e não recebe poderes técnicos exclusivos de `administrador`. Cargo institucional **não** concede perfil nem staff.

Cargos da Loja (`irmaos_cargos`): catálogo de 17 cargos, no máximo um vigente por Irmão e um ocupante vigente por cargo. O Venerável Mestre institucional é a linha `cargo = 'veneravel_mestre'` com `encerrado_em is null` em Irmão `situacao = 'ativo'`. Pode existir sem conta no portal. A Loja pode ficar sem Venerável. Não há sucessão automática. A atribuição **não** altera `perfil`. Somente Administrador atribui, encerra ou substitui o cargo institucional `veneravel_mestre`. Secretaria e o perfil Venerável gerem os demais cargos. Se o ocupante deixa de estar `ativo`, um trigger encerra o mandato na mesma transação da mudança de situação.

Meu Perfil exibe os dois campos separados, mesmo quando o rótulo humano coincide (“Venerável Mestre”).

A Secretaria pode preencher `irmao_id` uma vez. A carga GLMERJ também tenta casar por **nome normalizado exato** e, em seguida, por **CIM**. Nomes parciais (ex.: “Paulo Henrique Braga” versus “PAULO HENRIQUE BRAGA DA SILVA”) não casam sozinhos.

Casamentos ativos: no máximo um por Irmão e uma cunhada (`esposa`/`companheira`) por vez. Encerrar o vínculo anterior libera novo cadastro.

A Secretaria mantém o cadastro unificado em `/area-restrita/gestao/` (Irmãos, familiares, casamentos, eventos e comunicados). Ferramentas de migração CSV ficam no submenu **Mais**, visível só para administrador. Mutações passam pela Edge Function `gerenciar-irmao` (`service_role`). Membros autenticados e ativos apenas leem o que a RLS permitir. Anônimos não têm GRANT efetivo.

A lista de Irmãos é clicável e o botão **Ver detalhes** abre a ficha. Formulários usam rodapé com largura automática. Feedback de sucesso e erro vai para um toast compartilhado (`showToast`), que some em 4–5 segundos, pode ser fechado e não persiste entre abas nem no `localStorage`. Datas de eventos e comunicados são `dd/mm/aaaa` + `hh:mm`, gravadas em ISO.

O fuso de referência é **America/Sao_Paulo**. Aniversários e iniciações usam dia/mês (e ano só quando existir), sem deslocar o dia por conversão UTC. Sessões ordinárias são geradas às 19h30 nesse fuso.

Aniversários extraídos do HTML trazem só dia e mês. O ano de nascimento **não** é calculado a partir da idade. A idade da extração fica em `idade_informada_na_importacao` (auditoria). Iniciações, casamentos e a fundação da Loja (`2018-08-06`, em `eventos_internos`) usam `date` completa. A interface calcula os anos dinamicamente.

Familiares e casamentos nascem com `autorizado_exibicao = false`. Irmãos: `exibir_aniversario = true`, `exibir_idade = false`, `exibir_iniciacao = true`.

### Carga inicial (dados pessoais fora do Git)

O repositório pode ser público. Nomes e datas pessoais **não** devem ser versionados.

1. Coloque os CSVs extraídos em `data/glmerj/` (pasta ignorada pelo Git) ou aponte `GLMERJ_DATA_DIR`.
2. `node scripts/import-glmerj-initial-data.mjs`
3. Revise `relatorio-importacao.json` e o SQL gerado em `data/glmerj/_generated/` (também ignorado).
4. Execute o SQL no projeto de homologação, confira quantidades e RLS, e só então repita em produção.

A migration `202608190006_cadastro_institucional.sql` cria só a estrutura. A migration `202608200001_vinculo_irmao_institucional.sql` adiciona `irmaos_autorizados.irmao_id` e sincroniza com `irmaos.auth_member_id`. Idempotência da carga: `ON CONFLICT` em nome normalizado, familiar+parentesco, casamento+data e `chave_idempotencia` da fundação.

O dashboard usa `irmao_id` para destacar aniversário, iniciação e casamento autorizado do próprio Irmão. Nomes da extração em caixa alta são apresentados em title case só na interface.

## Sessões da Loja

As sessões ordinárias ocorrem na **2ª quarta-feira** e na **4ª quarta-feira** de cada mês, às **19h30** (America/Sao_Paulo). Agosto de 2026: 12 e 26.

A função `private.gerar_sessoes_ordinarias(12)` faz upsert em `eventos_internos` com `chave_idempotencia = sessao_ordinaria:YYYY-MM-DD`. Edições excepcionais (cancelar, magna, administrativa, mudança de data) marcam `excepcional = true` e não são sobrescritas na geração.

O calendário e o card **Próxima sessão** leem esses registros publicados e ativos. A fundação da Loja não compete com uma sessão futura mais próxima. Se houver comunicado de sessão ligado à próxima data, o card mostra um bloco complementar com o link “Ler comunicado →”, sem botão.

## Comunicados e mensalidade

Secretaria, Venerável Mestre e Administrador cadastram comunicados em Gestão → Comunicados.

Prioridade no dashboard:

1. urgente ou destacado;
2. sessão administrativa com presença obrigatória;
3. demais comunicados ativos;
4. aviso automático de mensalidade (somente do dia 5 ao dia 20);
5. estado vazio: “Não há comunicados ativos no momento.”

Em 21/08 o lembrete de mensalidade não aparece.

No dashboard, Irmãos veem tipo, título, badges e o resumo. A janela de publicação (`inicio_exibicao` / `fim_exibicao`) permanece só na Gestão de Comunicados. Se o comunicado for de sessão, o card mostra a data e o horário do evento, não o período administrativo.

## Situação maçônica

`irmaos.situacao`: ativo, quiet_placet, transferencia, afastado, inativo, desligado, falecido.

Quiet placet e transferência ficam em tabelas próprias, com histórico. Quiet placet **não** revoga o cadastro. A opção “Suspender acesso durante o afastamento” é administrativa. Transferência concluída desativa o cadastro na Loja atual e suspende/revoga o acesso, sem apagar aniversários e iniciações.

## Logs

A tela `/area-restrita/logs/` usa o mesmo shell autenticado. A consulta passa por `gerenciar-irmao` (`acao: logs`) com `service_role` e junta o nome pelo `auth_user_id`. Há paginação, contagem, ordenação por data, estado vazio e botão para limpar filtros. A UI vazia vinha do layout isolado e da ausência de nome/origem — não da falta de gravação.

Novos eventos incluem `convite_aceito`, quiet placet, transferência, eventos e comunicados. A tela não exibe senha, token, CIM completa nem hashes.

## Inventário e backlog

- Escopo real desta branch: [feat-members-authentication-summary.md](feat-members-authentication-summary.md)
- Itens pós-merge: [area-dos-irmaos-backlog.md](area-dos-irmaos-backlog.md)

## Migrations

Ordem local (arquivos em `supabase/migrations/`):

1. `202608190001_irmaos_autorizados.sql`
2. `202608190002_logs_autenticacao.sql`
3. `202608190003_conteudo_interno.sql`
4. `202608190004_harden_member_writes.sql`
5. `202608190005_auth_hardening.sql`
6. `202608190006_cadastro_institucional.sql`
7. `202608200001_vinculo_irmao_institucional.sql`
8. `202608200002_casamento_integridade.sql`
9. `202608210001_gestao_sessoes_comunicados.sql`
10. `202608210002_gerar_sessoes_service_role.sql`
11. `202608220001_datas_institucionais.sql`
12. `202608230001_cargos_institucionais.sql`

A operação pontual de vínculo de CIMs oficiais **não fica no repositório** (dados pessoais). A cópia local, se existir, está em arquivos ignorados pelo Git. No projeto remoto essa operação já foi aplicada uma vez.

## Edge Functions

| Função | JWT no gateway | Uso |
| --- | --- | --- |
| `login-with-cim` | não | Login por CIM e senha |
| `recuperar-senha-cim` | não | Pedido de recuperação |
| `ativar-conta` | sim | Confirma CIM e cria senha |
| `gerenciar-irmao` | sim | Administração e autoações do Irmão |
| `bootstrap-convite-admin` | não | Primeiro administrador |
| `registrar-interesse` | não | Site institucional |
| `abrir-cartilha` | não | Site institucional |

## Testes

```bash
node --test
```

Os testes unitários usam fixtures fictícios. A lista oficial de CIM não é versionada.

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
