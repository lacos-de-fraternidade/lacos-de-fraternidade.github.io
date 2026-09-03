# Templates de e-mail da Área dos Irmãos

Os e-mails de autenticação usam a mesma identidade visual do e-mail institucional **Nova manifestação de interesse**: fundo `#f4f7fb`, card branco, cabeçalho `#071a3a`, botão `#123a74` e rodapé `#06142d`.

O brasão é a URL pública:

`https://lacos-de-fraternidade.github.io/assets/logo-classica.jpg`

Credenciais SMTP **não** entram no repositório.

## Onde editar no Dashboard

[Authentication → Email Templates](https://supabase.com/dashboard/project/klxcwkclydirdxomkbtv/auth/templates)

| Template no Dashboard | Arquivo no repositório | Assunto |
| --- | --- | --- |
| Invite user | `supabase/templates/invite.html` | Convite para a Área dos Irmãos — Laços de Fraternidade 357 nº 251 |
| Reset password | `supabase/templates/recovery.html` | Redefinição de senha — Área dos Irmãos |

O botão e o link alternativo **não** usam `{{ .ConfirmationURL }}`. Esse endereço aponta para o Auth e é de uso único: o Gmail pode abri-lo sozinho e gastar o convite.

Use o site da Loja com o token na query, para o scanner só ver uma página comum:

```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite
```

Na recuperação, o `type` é `recovery`. `{{ .RedirectTo }}` já sai com `/area-restrita/ativar/` ou `/area-restrita/redefinir-senha/` conforme o envio.

A página aberta **não** valida o token ao carregar. O irmão clica em **Continuar a ativação** (ou **Continuar a redefinição**) e só então o site chama o Auth.

## URLs de redirecionamento

[Authentication → URL Configuration](https://supabase.com/dashboard/project/klxcwkclydirdxomkbtv/auth/url-configuration)

- Site URL de produção: `https://lacos-de-fraternidade.github.io`
- Redirect URLs:
  - `https://lacos-de-fraternidade.github.io/area-restrita/ativar/`
  - `https://lacos-de-fraternidade.github.io/area-restrita/redefinir-senha/`
  - `http://localhost:8080/area-restrita/ativar/`
  - `http://localhost:8080/area-restrita/redefinir-senha/`

O envio do convite usa `redirectTo` apontando para `/area-restrita/ativar/`. A recuperação usa `/area-restrita/redefinir-senha/`.

## Como aplicar no projeto hospedado

1. Abra o template no Dashboard.
2. Cole o assunto e o HTML do arquivo correspondente.
3. Salve.
4. Envie um convite de teste pela Gestão de Irmãos.
5. Confira assunto, preheader, brasão, botão e destino da ativação.

Para aplicar pelo Management API, com a CLI já autenticada:

`node supabase/scripts/apply-auth-email-templates.mjs`

O script exige `SUPABASE_ACCESS_TOKEN` no ambiente. Não versiona o token.

Não use `supabase config push` só para estes templates: o `config.toml` local não contém SMTP, Site URL nem demais ajustes de produção.

## Como validar o fluxo

1. Enviar convite para um e-mail de teste.
2. Abrir o e-mail e confirmar o assunto em português.
3. Clicar em **Ativar meu acesso**.
4. A página aberta deve ser `/area-restrita/ativar/?token_hash=...&type=invite`, não o `/auth/v1/verify` do Supabase, e não `localhost` quando o envio partiu do site publicado.
5. Clicar em **Continuar a ativação** e só então ver o formulário de senha.
6. Repetir com **Esqueci minha senha** e o template de recuperação.

## Checklist

- [ ] Assunto do convite em português
- [ ] Conteúdo sem inglês padrão do Supabase
- [ ] `{{ .RedirectTo }}?token_hash={{ .TokenHash }}` no botão e no link alternativo
- [ ] Nenhum `{{ .ConfirmationURL }}` no HTML
- [ ] A tela de ativação pede um clique em continuar antes de validar o token
- [ ] Brasão carregando pela URL do GitHub Pages
- [ ] Recuperação de senha no mesmo visual
- [ ] Nenhuma senha SMTP versionada
