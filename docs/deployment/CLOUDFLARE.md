# Publicação híbrida no Cloudflare

Este documento descreve a publicação do frontend do VIRA.AI no Cloudflare
Workers, com a API e o banco hospedados em um servidor próprio (Oracle Cloud).
A estratégia é um preview isolado primeiro; o domínio principal só deve ser
promovido depois da validação manual.

## Topologia ativa

| Serviço | Plataforma | Responsabilidade | Origem |
| --- | --- | --- | --- |
| `vira-ai-web` | Cloudflare Workers + OpenNext | Next.js, páginas e proxy same-origin | preview do Worker |
| `vira-api` | VM Oracle Cloud (systemd + Nginx) | FastAPI, autenticação, Business, Concursos e persistência | `https://137-131-255-128.nip.io` |
| PostgreSQL | VM Oracle Cloud (local) | Persistência real, sobrevive a deploy/reboot | `127.0.0.1:5432` (não exposto publicamente) |

O navegador chama apenas `/api/...` no próprio frontend. O Worker usa a
variável server-side `API_INTERNAL_URL` para encaminhar as requisições ao
domínio público da API na VM. Nenhum token de integração, senha, chave
Foursquare ou valor de `API_ACCESS_TOKEN` deve entrar no bundle do navegador.

## Pré-requisitos

1. O código deve estar no repositório conectado ao Cloudflare, na branch
   `feat/admin-ui-cloudflare` para o primeiro preview.
2. A API pública precisa responder em
   `https://137-131-255-128.nip.io/health`.
3. A conta do Cloudflare deve estar autenticada no painel ou no ambiente de
   CI. A autenticação é manual; nunca coloque um token no repositório ou no
   chat.
4. A VM Oracle Cloud deve estar acessível via SSH para manutenção (`postgresql`,
   `vira-api` e `nginx` rodam como serviços `systemd`, com restart automático).

## Configuração do Worker

O projeto já contém `apps/web/wrangler.jsonc` com o nome `vira-ai-web`, o
artefato `.open-next/worker.js`, os assets `.open-next/assets`,
`nodejs_compat` e observabilidade habilitada. O build usa
`apps/web/open-next.config.ts`.

O repositório declara em `apps/web/wrangler.jsonc` a origem pública padrão da
API, que não é um segredo:

```text
API_INTERNAL_URL=https://137-131-255-128.nip.io
```

Se preferir administrar a configuração pelo painel do Cloudflare, mantenha a
mesma variável `API_INTERNAL_URL` na versão ativa do Worker; a publicação usa
`--keep-vars` para preservar variáveis já configuradas. Use a URL base sem
`/login`, `/api` ou `/health`. Não crie `NEXT_PUBLIC_API_INTERNAL_URL` e não coloque `API_ACCESS_TOKEN`,
`ADMIN_ACCESS_TOKEN`, `ADMIN_INITIAL_PASSWORD` ou `FOURSQUARE_API_KEY` no
Cloudflare Worker. Esses valores, quando necessários, pertencem ao arquivo
`.env` do serviço `vira-api` na VM.

Para criar o primeiro administrador pela página, configure
`ADMIN_SETUP_TOKEN` **somente** como segredo no `.env` do `vira-api` na VM,
com `ADMIN_INITIAL_PASSWORD` vazio. Não inclua o código no Worker, no
repositório nem em logs. `GET /api/v1/auth/setup-status` decide se `/login`
mostra a ativação; `POST /api/v1/auth/setup` aceita os quatro campos e cria
uma sessão HttpOnly. Depois da primeira credencial, o cadastro não pode ser
repetido. Remova ou rotacione o código após a ativação.

Antes da ativação, confirme que `DATABASE_URL` do `vira-api` aponta para o
PostgreSQL local da VM (`postgresql://vira_api:...@127.0.0.1:5432/vira_api`).
Um redeploy da API não deve recriar o banco nem apagar a credencial — o
PostgreSQL roda como serviço `systemd` independente e sobrevive a reboot.

Depois de configurar a variável no painel, confirme que `API_INTERNAL_URL`
aparece entre as variáveis e associações da versão ativa do Worker. A presença
do valor apenas no histórico de versões não garante que a publicação em
produção consiga encaminhar requisições para a API.

O host `137-131-255-128.nip.io` resolve para o IP público da VM e carrega um
certificado Let's Encrypt válido (HTTPS com redirect automático a partir de
HTTP). Ao trocar de servidor ou obter um domínio próprio, atualize
`API_INTERNAL_URL` em ambos os `wrangler.jsonc` (raiz e `apps/web/`) e nos
testes de contrato em `apps/web/src/lib/cloudflare-package.test.ts`.

## Publicação pelo repositório conectado

Configure o projeto do Cloudflare Workers para usar a raiz do repositório e a
branch `feat/admin-ui-cloudflare`. Como o Workers Builds separa a compilação da
publicação, use estes comandos no painel:

Build command:

```text
pnpm install --frozen-lockfile && pnpm --dir apps/web exec opennextjs-cloudflare build && pnpm --dir apps/web run check:cloudflare
```

Preview deploy command:

```text
pnpm --dir apps/web exec wrangler versions upload
```

Production deploy command:

```text
pnpm --dir apps/web exec wrangler deploy --keep-vars
```

O `wrangler` também está declarado na raiz do workspace para que o comando
padrão de preview do Cloudflare (`npx wrangler versions upload`) funcione caso
o painel seja deixado com o valor padrão. A configuração `wrangler.jsonc` da
raiz aponta para `apps/web/.open-next/worker.js` e
`apps/web/.open-next/assets`, que são os caminhos reais quando o comando de
publicação é executado a partir da raiz do repositório. A forma explícita com
`pnpm --dir` continua recomendada porque deixa o diretório e a configuração
usados pelo Workers Builds sem ambiguidade.

Para uma publicação manual fora do Workers Builds, o script `deploy` do pacote
continua executando, nessa ordem, o build OpenNext, a verificação de artefatos e
a publicação no Worker com `--keep-vars`. Essa opção preserva as variáveis de
runtime configuradas pelo painel do Cloudflare durante novos deploys. O
`check:cloudflare` interrompe a publicação se
`.open-next/worker.js` ou `.open-next/assets` não existirem ou se arquivos
textuais emitidos contiverem nomes/valores com formato de credencial.

Para preview local ou validação em CI, use:

```text
pnpm install --frozen-lockfile
pnpm --dir apps/web run typecheck
pnpm --dir apps/web run build
pnpm --dir apps/web exec opennextjs-cloudflare build
pnpm --dir apps/web run check:cloudflare
pnpm --dir apps/web exec wrangler deploy --config wrangler.jsonc --dry-run
```

O OpenNext informa que o suporte nativo no Windows é incompleto. Se o build
falhar apenas por limitação do Windows/esbuild, execute esses passos no CI
Linux, no WSL ou no próprio ambiente de build do Cloudflare; não remova a
checagem de artefatos para contornar o erro.

## Roteiro de validação do preview

Depois que o Cloudflare fornecer uma URL de preview, valide nesta ordem:

1. `GET /login` exibe a tela de acesso.
2. `GET /api/health` retorna o healthcheck da API na VM Oracle Cloud.
3. Se não existir administrador, `/login` mostra a ativação inicial. Se já
   existir, mostra o login; falha de conexão mantém o login utilizável.
4. Uma senha incorreta mostra apenas `Usuário ou senha inválidos.` e não cria
   sessão. Cadastro válido cria o cookie HttpOnly sem repetir a senha no login.
5. Um login válido cria o cookie HttpOnly e abre `/business`.
6. O acompanhamento, a alteração de estágio, a exclusão de empresas e a
   busca Foursquare funcionam por caminhos same-origin `/api/...`.
7. O logout encerra a sessão; a próxima rota protegida volta a exigir login.
8. O código-fonte do navegador e os assets públicos não contêm a origem da
   API server-side, tokens, senha ou chave Foursquare.
9. A API na VM continua respondendo durante todos os testes.

Se a API usar uma lista de CORS para alguma chamada direta adicional, inclua a
origem pública ou de preview do frontend somente no `.env` do `vira-api`; o
fluxo normal deve continuar passando pelo proxy same-origin.

## Promoção e rollback

Não troque o domínio principal na primeira publicação de uma mudança de
infraestrutura. Valide login, cookie, Business, Concursos e o healthcheck
antes de promover.

Em caso de falha:

1. pare ou remova a rota/domínio do preview Cloudflare;
2. reverta `API_INTERNAL_URL` para o último valor conhecido-bom nos dois
   `wrangler.jsonc` e republique o Worker;
3. confirme que os serviços `postgresql`, `vira-api` e `nginx` continuam
   ativos na VM (`systemctl status`);
4. corrija a branch e gere outro preview antes de tentar novamente.

Esse rollback não exige apagar banco, recriar volume, alterar a branch
principal ou rotacionar automaticamente qualquer segredo. A promoção do
Cloudflare para o domínio principal requer aprovação explícita depois dos
testes.

## Próxima etapa fora deste escopo

Mover o FastAPI para Python Workers, migrar para outro provedor de VM ou
trocar a topologia atual por algo totalmente gerenciado exige uma avaliação
separada de ASGI, banco, sessões, auditoria, rate limit e armazenamento de
segredos. A compatibilidade Python da Cloudflare é uma possibilidade futura,
não parte desta publicação híbrida.

Referências oficiais:

- [OpenNext para aplicações Next.js existentes](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Next.js na Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [FastAPI no runtime Python da Cloudflare](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/)
