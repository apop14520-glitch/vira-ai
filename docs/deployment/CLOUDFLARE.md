# Publicação híbrida no Cloudflare

Este documento descreve a publicação do frontend do VIRA.AI no Cloudflare
Workers mantendo a API e o banco no Railway. A estratégia é um preview isolado
primeiro; o domínio principal só deve ser promovido depois da validação manual.

## Topologia ativa

| Serviço | Plataforma | Responsabilidade | Origem inicial |
| --- | --- | --- | --- |
| `vira-ai-web` | Cloudflare Workers + OpenNext | Next.js, páginas e proxy same-origin | preview do Worker |
| `vira-api` | Railway | FastAPI, autenticação, Business, Foursquare e persistência | `https://vira-api-production.up.railway.app` |
| frontend atual | Railway | rollback operacional | `https://vira-ai-production.up.railway.app` |

O navegador chama apenas `/api/...` no próprio frontend. O Worker usa a
variável server-side `API_INTERNAL_URL` para encaminhar as requisições ao
domínio público da API Railway. Nenhum token de integração, senha, chave
Foursquare ou valor de `API_ACCESS_TOKEN` deve entrar no bundle do navegador.

## Pré-requisitos

1. O código deve estar no repositório conectado ao Cloudflare, na branch
   `feat/admin-ui-cloudflare` para o primeiro preview.
2. A API pública precisa responder em
   `https://vira-api-production.up.railway.app/health`.
3. A conta do Cloudflare deve estar autenticada no painel ou no ambiente de
   CI. A autenticação é manual; nunca coloque um token no repositório ou no
   chat.
4. O serviço atual do Railway deve continuar disponível para rollback.

## Configuração do Worker

O projeto já contém `apps/web/wrangler.jsonc` com o nome `vira-ai-web`, o
artefato `.open-next/worker.js`, os assets `.open-next/assets`,
`nodejs_compat` e observabilidade habilitada. O build usa
`apps/web/open-next.config.ts`.

O repositório declara em `apps/web/wrangler.jsonc` a origem pública padrão da
API, que não é um segredo:

```text
API_INTERNAL_URL=https://vira-api-production.up.railway.app
```

Se preferir administrar a configuração pelo painel do Cloudflare, mantenha a
mesma variável `API_INTERNAL_URL` na versão ativa do Worker; a publicação usa
`--keep-vars` para preservar variáveis já configuradas. Use a URL base sem
`/login`, `/api` ou `/health`. Não crie `NEXT_PUBLIC_API_INTERNAL_URL` e não coloque `API_ACCESS_TOKEN`,
`ADMIN_ACCESS_TOKEN`, `ADMIN_INITIAL_PASSWORD` ou `FOURSQUARE_API_KEY` no
Cloudflare Worker. Esses valores, quando necessários, pertencem ao serviço
`vira-api` no Railway.

Para criar o primeiro administrador pela página, configure
`ADMIN_SETUP_TOKEN` **somente** como segredo no serviço `vira-api` do Railway,
com `ADMIN_INITIAL_PASSWORD` vazio. Não inclua o código no Worker, no
repositório nem em logs. `GET /api/v1/auth/setup-status` decide se `/login`
mostra a ativação; `POST /api/v1/auth/setup` aceita os quatro campos e cria
uma sessão HttpOnly. Depois da primeira credencial, o cadastro não pode ser
repetido. Remova ou rotacione o código após a ativação.

Antes da ativação, confirme que `DATABASE_URL` do `vira-api` aponta para um
volume persistente no Railway. Um redeploy da API não deve recriar o banco nem
apagar a credencial. Alterar `ADMIN_INITIAL_PASSWORD` posteriormente não
redefine a senha já cadastrada.

Depois de configurar a variável no painel, confirme que `API_INTERNAL_URL`
aparece entre as variáveis e associações da versão ativa do Worker. A presença
do valor apenas no histórico de versões não garante que a publicação em
produção consiga encaminhar requisições para a API.

Não use `vira-api.railway.internal` nessa configuração. Um domínio
`railway.internal` é privado à rede do Railway e não é resolvível pelo
navegador nem por um Worker Cloudflare externo. Para esta topologia híbrida,
use o domínio público da API Railway.

## Publicação pelo repositório conectado

Configure o projeto do Cloudflare Workers para usar a raiz do repositório e a
branch `feat/admin-ui-cloudflare`. O comando de build é:

```text
pnpm install --frozen-lockfile && pnpm --dir apps/web run deploy
```

O script executa, nessa ordem, o build OpenNext, a verificação de artefatos e a
publicação no Worker com `--keep-vars`. Essa opção preserva as variáveis de
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
2. `GET /api/health` retorna o healthcheck da API Railway.
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
9. O Railway continua respondendo durante todos os testes.

Se a API usar uma lista de CORS para alguma chamada direta adicional, inclua a
origem pública ou de preview do frontend somente no serviço `vira-api`; o
fluxo normal deve continuar passando pelo proxy same-origin.

## Promoção e rollback

Não troque o domínio principal na primeira publicação. Mantenha o frontend
Railway disponível até concluir login, cookie, Business, Foursquare e
rollback.

Em caso de falha:

1. pare ou remova a rota/domínio do preview Cloudflare;
2. mantenha `https://vira-ai-production.up.railway.app` como frontend ativo;
3. preserve o serviço `vira-api`, o banco e o volume no Railway;
4. corrija a branch e gere outro preview antes de tentar novamente.

Esse rollback não exige apagar banco, recriar volume, alterar a branch
principal ou rotacionar automaticamente qualquer segredo. A promoção do
Cloudflare para o domínio principal requer aprovação explícita depois dos
testes.

## Próxima etapa fora deste escopo

Mover o FastAPI para Python Workers ou trocar SQLite por uma persistência
distribuída exige uma avaliação separada de ASGI, banco, sessões, auditoria,
rate limit e armazenamento de segredos. A compatibilidade Python da Cloudflare
é uma possibilidade futura, não parte desta publicação híbrida.

Referências oficiais:

- [OpenNext para aplicações Next.js existentes](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Next.js na Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [FastAPI no runtime Python da Cloudflare](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/)
