# Build do frontend no Cloudflare

O Worker `vira-ai-web` é compilado pela integração de builds do Cloudflare
(Workers Builds) a partir do GitHub. A branch de produção é `main`: cada merge
nela gera uma versão e a publica automaticamente. Builds de outras branches e de
pull requests geram apenas uma versão de preview, sem afetar a produção. O build
acontece em ambiente Linux e executa o OpenNext antes da publicação.

A API roda em uma VM Oracle Cloud. O frontend usa somente a variável
server-side `API_INTERNAL_URL`, com a origem pública padrão declarada no
`wrangler.jsonc` (`https://137-131-255-128.nip.io`); nenhum token, senha ou
chave de integração deve ser versionado.

Para reverter uma publicação ruim, promova a versão anterior:

```text
pnpm --dir apps/web exec wrangler versions deploy <ID-da-versão>@100% --name vira-ai-web
```
