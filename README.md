# Laços de Fraternidade

Landing page estática para apresentação do processo de candidatura, acesso à cartilha e demonstração de formulário com validação local.

## Executar localmente

Não há dependências nem etapa de build. Abra `index.html` diretamente no navegador ou sirva a pasta com qualquer servidor HTTP estático.

Exemplo com Python:

```bash
python -m http.server 8080
```

Depois, acesse `http://localhost:8080`.

## Publicar no GitHub Pages

Publique os arquivos da raiz do repositório diretamente pelo GitHub Pages. Todos os caminhos são relativos e funcionam em subdiretórios de projeto.

## Privacidade

O formulário é somente uma demonstração. O JavaScript não usa `fetch`, envio HTTP, armazenamento local, cookies ou serviços externos. Após uma validação bem-sucedida, os valores são removidos da interface. Uma coleta real de dados pessoais, especialmente CPF, exige backend e processo seguros e adequados à LGPD; isso não deve ser implementado diretamente no GitHub Pages.
