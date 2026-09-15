# Build do frontend no Cloudflare

O Worker `vira-ai-web` é compilado pela integração de builds do Cloudflare a partir da branch `feat/admin-ui-cloudflare`. O build acontece em ambiente Linux e executa o OpenNext antes da publicação.

A API permanece no Railway. O frontend usa somente a variável server-side `API_INTERNAL_URL`; nenhum token, senha ou chave de integração deve ser versionado.

A publicação inicial é feita no domínio `workers.dev` para validação. O frontend e a API do Railway continuam disponíveis como rollback até a aprovação explícita da promoção.
