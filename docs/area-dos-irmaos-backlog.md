# Backlog da Área dos Irmãos

Itens que **não** entram no merge de `feat/members-authentication`. Abrir branches menores depois do merge.

## P0 — segurança ou falha crítica

Nenhum item P0 conhecido após a estabilização. MFA e CAPTCHA continuam pendentes, mas já estavam fora do escopo desta entrega.

## P1 — importante para a próxima entrega

- MFA obrigatório para Secretaria e Administrador (TOTP, AAL2 nas ações críticas)
- CAPTCHA após falhas repetidas de login e recuperação
- Testes de integração completos (`AUTH_INTEGRATION=1` em projeto de teste)
- Alinhar `search_path = public, pg_temp` nas funções `SECURITY DEFINER` que ainda usam só `public`
- Conferir checksum/histórico da operação pontual de CIM no remoto sem versionar a lista oficial
- Publicar `/area-restrita/` no GitHub Pages ou em outro host autenticado (hoje o Pages só serve o site institucional)

## P2 — melhoria operacional

- Histórico administrativo mais detalhado
- Notificações (convite, sessão, comunicado)
- Presença em sessão
- Relatórios da Secretaria
- Ferramenta interna para aplicar vínculo de CIM a partir de arquivo local ignorado pelo Git

## P3 — refinamento futuro

- Graus maçônicos
- Instalação de Veneráveis
- Expansão do catálogo de Datas Maçônicas
- Melhorias adicionais do calendário
- Quebrar a Área dos Irmãos em branches semânticas (`feat/admin-events`, `feat/member-degrees`, `feat/mfa-privileged-users`, etc.)
