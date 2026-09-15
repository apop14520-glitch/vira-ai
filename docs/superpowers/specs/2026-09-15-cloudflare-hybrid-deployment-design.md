# Design: publicação híbrida do VIRA.AI no Cloudflare

**Data:** 2026-09-15  
**Status:** aprovado em conversa; aguardando revisão deste documento antes do plano de implementação

## Objetivo

Publicar o frontend do VIRA.AI no Cloudflare Workers sem interromper o
frontend existente no Railway, mantendo a API FastAPI, a persistência atual e
a integração Foursquare no Railway durante a primeira fase. A publicação
deverá preservar o login administrativo, os cookies de sessão, o proxy
same-origin e a possibilidade de rollback sem apagar dados ou rotacionar
segredos automaticamente.

## Contexto e evidências

- `apps/web` é uma aplicação Next.js 15 com App Router, Route Handler de proxy
  em `src/app/api/[...path]/route.ts` e autenticação baseada em cookie HttpOnly.
- `apps/api` é uma aplicação FastAPI Python com `uvicorn`, SQLite configurável,
  sessões administrativas, rate limit e integração Foursquare.
- A API pública `https://vira-api-production.up.railway.app` responde com
  `service: vira-api` e `status: ok`.
- O domínio `*.railway.internal` é uma rede privada do Railway e não pode ser
  resolvido pelo navegador do usuário. O Worker do Cloudflare usará a origem
  HTTPS pública da API na primeira fase.
- O repositório não possui atualmente `wrangler.jsonc`, adaptador OpenNext,
  configuração de Workers ou segredo versionado.

## Decisão arquitetural

### Fase 1: frontend no Cloudflare, API no Railway

    Navegador
      -> Cloudflare Worker com Next.js/OpenNext
          -> API pública HTTPS no Railway
              -> SQLite, autenticação e Foursquare

O navegador continuará chamando somente caminhos same-origin `/api/...`. O
Route Handler do Next continuará funcionando como proxy server-side. A origem
da API será fornecida ao Worker pela variável secreta `API_INTERNAL_URL` com
valor-base `https://vira-api-production.up.railway.app`, sem `/login`, `/api` ou
`/health`.

O frontend atual do Railway permanecerá publicado durante a validação. O
domínio Cloudflare será tratado como ambiente de pré-produção até que a matriz
de testes seja concluída. A troca do domínio principal não faz parte da
primeira publicação.

### Fase 2: avaliação independente da API no Cloudflare

A migração da API será um projeto separado. O FastAPI é compatível com o
runtime Python Workers por meio do adaptador ASGI do Cloudflare, mas a API
atual depende de caminho de arquivo SQLite, ciclo de vida de `uvicorn`, estado
de sessão e rate limit em memória. A fase 2 exigirá adaptar persistência para
D1 ou outra solução adequada, revisar concorrência, armazenamento de sessão,
auditoria, segredos e integração Foursquare. Nenhum desses passos será
misturado à primeira publicação do frontend.

## Componentes e responsabilidades

### Configuração do frontend

- `apps/web/wrangler.jsonc`: nome do Worker, entrada gerada pelo OpenNext,
  data de compatibilidade, assets e observabilidade não sensível.
- `apps/web/open-next.config.ts`: configuração do adaptador para preservar o
  App Router e os Route Handlers existentes.
- `apps/web/package.json`: scripts separados para `build`, `preview`, geração
  de tipos e `deploy`, sem alterar `dev` ou `start` usados no Railway.
- `pnpm-lock.yaml`: dependências do adaptador fixadas pelo gerenciador já usado
  no monorepo.

### Proxy e sessão

- O proxy continuará aceitando somente a allowlist atual de saúde,
  autenticação e Business.
- `API_INTERNAL_URL` será lida somente no limite server-side.
- Os headers necessários serão encaminhados: `Accept`, `Content-Type`,
  `Cookie` e `X-Request-ID`.
- Respostas de autenticação encaminharão todos os `Set-Cookie` sem copiar o
  valor para JavaScript.
- A mensagem de falha de login será distinta da mensagem de sessão expirada,
  sem revelar se o usuário existe ou se a senha está correta.
- Nenhum token bearer, senha, chave Foursquare ou URL de origem será colocado
  em `NEXT_PUBLIC_*`, no bundle ou em arquivos versionados.

### Origem Railway

- `vira-api` continuará recebendo `ENVIRONMENT`, credenciais administrativas,
  tokens de serviço, `AUTH_ORGANIZATION_ID`, `CORS_ORIGINS` e a chave
  Foursquare exclusivamente pelo ambiente do Railway.
- O domínio público da API será mantido apenas como origem do proxy na fase 1.
- O banco não será removido, o volume não será recriado e a variável
  `ADMIN_INITIAL_PASSWORD` não será usada como mecanismo de reset.
- O serviço web existente permanecerá intacto para rollback.

## Fluxo de dados

1. O usuário acessa o domínio do Worker Cloudflare.
2. Uma página administrativa chama `/api/v1/auth/session` no mesmo domínio.
3. O Route Handler monta `API_INTERNAL_URL + /api/v1/auth/session` no servidor
   do Worker e encaminha o cookie recebido.
4. No login, o Worker encaminha o JSON para `/api/v1/auth/login`, copia o
   status, o request id e cada `Set-Cookie` para o navegador.
5. As telas Business repetem o mesmo fluxo para leads, resumo e busca
   Foursquare, sem chamada direta do browser ao domínio da API.
6. Em caso de falha upstream, o Worker retorna uma mensagem segura e um
   `request_id` para correlação nos logs, sem devolver detalhes internos.

## Segurança e confiabilidade

- O Worker não será usado como substituto da autenticação da API; a API
  continuará sendo a autoridade para sessão, organização, papéis e rate limit.
- A API pública deverá manter as rotas sensíveis protegidas por sessão ou
  bearer token conforme o contrato atual. Nenhuma rota nova será adicionada à
  allowlist do proxy sem teste de autorização.
- A configuração de `CORS_ORIGINS` incluirá o domínio de pré-produção do
  Cloudflare, mas as requisições normais continuarão same-origin pelo proxy.
- A variável `API_INTERNAL_URL` será configurada como segredo/variável privada
  do Worker; o valor não aparecerá no cliente.
- O Railway será a origem de rollback até a validação de login, sessão,
  Business, Foursquare e troca de senha.
- A implantação deverá ter um healthcheck público do frontend e um healthcheck
  da API, sem expor banco, variáveis, tokens ou dados pessoais.
- A publicação será feita em ambiente separado ou preview primeiro. A
  promoção para produção será manual e reversível.

## Escolha do adaptador

O projeto atual continuará usando Next.js 15 durante a primeira migração. O
OpenNext é a escolha inicial por ser o caminho documentado para manter uma
aplicação Next.js existente com App Router e Route Handlers. O vinext ficará
fora desta etapa porque a documentação atual o recomenda como caminho padrão
para novos projetos e sua integração com aplicações existentes depende da
matriz de compatibilidade do projeto.

## Testes e critérios de aceite

### Verificações locais

- O build existente do Next.js continua passando sem a configuração Cloudflare
  ativada.
- O typecheck continua passando.
- Testes do proxy cobrem montagem de URL-base, allowlist, encaminhamento de
  cookie, múltiplos `Set-Cookie`, erro de URL inválida e erro upstream.
- O dry-run do Wrangler/OpenNext conclui sem autenticação de produção e sem
  upload de segredo.
- O bundle não contém `API_INTERNAL_URL`, `API_ACCESS_TOKEN`,
  `ADMIN_ACCESS_TOKEN`, `ADMIN_INITIAL_PASSWORD` ou `FOURSQUARE_API_KEY`.

### Verificações no preview Cloudflare

- `/login` abre sem erro de runtime.
- `/api/health` confirma a comunicação Worker -> API.
- Login válido redireciona para o painel e mantém o cookie HttpOnly.
- Login inválido retorna mensagem genérica e não cria sessão.
- Sessão válida abre `/business`; logout revoga o acesso.
- Troca de senha exige sessão e encerra as sessões anteriores.
- Busca Foursquare, adição de lead, mudança de estágio e exclusão de lead
  continuam funcionando.
- Tema claro/escuro e layout móvel permanecem funcionais.
- O frontend do Railway continua acessível durante todo o teste.

## Rollback

O rollback inicial consiste em manter o domínio do Railway como endereço
principal e remover ou pausar o domínio Cloudflare. Nenhum rollback poderá
apagar banco, remover volume ou alterar a senha administrativa. A promoção
definitiva só ocorrerá depois de um teste manual com credencial válida e de
uma confirmação de que a versão do Railway ainda pode ser acessada.

## Fora de escopo

- Migração do FastAPI para Python Workers.
- Conversão de SQLite para D1.
- Criação de um novo provedor de identidade.
- Rotação automática de senha, tokens ou chave Foursquare.
- Alteração do domínio principal antes da validação.
- Desligamento, exclusão ou alteração destrutiva no Railway.

## Fontes técnicas

- Cloudflare: Next.js e vinext —
  https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare: adaptador OpenNext —
  https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Cloudflare: FastAPI no Python Workers —
  https://developers.cloudflare.com/workers/languages/python/packages/fastapi/
