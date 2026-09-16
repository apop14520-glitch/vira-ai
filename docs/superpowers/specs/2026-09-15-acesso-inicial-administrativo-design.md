# Acesso inicial administrativo e estabilidade do login no Cloudflare

## Contexto

O frontend `vira-ai-web` roda em Cloudflare Workers com OpenNext e encaminha
as rotas `/api/...` para a API FastAPI hospedada no Railway. A versão ativa do
Worker perdeu a associação `API_INTERNAL_URL` após uma publicação pelo GitHub;
por isso o proxy responde `502` e a tela apresenta “O serviço está
temporariamente indisponível” antes de validar usuário ou senha.

O backend também trata `ADMIN_USERNAME` e `ADMIN_INITIAL_PASSWORD` como dados
de criação inicial: eles criam a credencial apenas quando ela ainda não existe.
Alterar essas variáveis depois não substitui uma credencial já persistida. Isso
torna o primeiro acesso pouco claro para o operador e não oferece uma forma
segura de cadastrar o primeiro administrador pela interface.

## Objetivos

- Preservar `API_INTERNAL_URL` em todas as novas publicações do Worker.
- Exibir um fluxo de criação do primeiro administrador somente quando a API
  ainda não possuir credencial administrativa.
- Manter usuário e senha exclusivamente na API; o Cloudflare recebe somente a
  URL pública da API Railway.
- Impedir que um visitante da internet reivindique a primeira conta antes do
  proprietário.
- Manter a tela atual de login para instalações que já possuem administrador.
- Oferecer mensagens que diferenciem indisponibilidade da API, configuração
  inicial pendente e credenciais inválidas.

## Fora do escopo

- Cadastro de vários usuários ou papéis.
- Recuperação pública de senha de uma credencial já existente.
- Migração do FastAPI ou do banco para Cloudflare.
- Armazenamento de senha, token administrativo ou chave Foursquare no Worker.
- Exclusão ou recriação automática do banco Railway.

## Alternativas consideradas

### 1. Manter somente variáveis do Railway

É a menor alteração, mas não atende ao pedido de cadastro pela página e mantém
ambígua a diferença entre uma senha inicial e uma senha já persistida.

### 2. Liberar o primeiro cadastro apenas verificando que a tabela está vazia

É simples, porém inseguro: em uma implantação pública, qualquer visitante pode
ser o primeiro a enviar o formulário e assumir a conta administrativa.

### 3. Cadastro inicial único com código de ativação — recomendado

A página aparece somente quando não existe administrador. Para concluir o
cadastro, o operador informa usuário, senha, confirmação e um código de
ativação definido como segredo no serviço `vira-api` do Railway. Após a criação,
o endpoint de cadastro inicial passa a responder como indisponível e a página
volta permanentemente ao modo de login enquanto o banco for preservado.

Essa opção atende ao pedido sem publicar credenciais no frontend e elimina a
corrida pelo primeiro cadastro.

## Arquitetura proposta

### Cloudflare Worker

O script de publicação do OpenNext usará `--keep-vars`, preservando as
variáveis de runtime configuradas no painel. `API_INTERNAL_URL` continuará com
o valor público base da API Railway, sem caminhos adicionais.

O `wrangler.jsonc` declarará `API_INTERNAL_URL` como associação obrigatória,
quando suportado pela versão instalada do Wrangler, para que uma publicação
sem essa configuração falhe claramente em vez de produzir um login quebrado.
O valor não será versionado no repositório.

### API Railway

Será adicionada uma variável secreta `ADMIN_SETUP_TOKEN`. Ela não é a senha do
administrador e será usada somente para autorizar a criação inicial.

O bootstrap existente por `ADMIN_INITIAL_PASSWORD` continuará funcionando por
compatibilidade. Para usar o cadastro pela página em uma instalação vazia, o
operador configura `ADMIN_SETUP_TOKEN` e deixa `ADMIN_INITIAL_PASSWORD` sem
valor. Se o bootstrap antigo já tiver criado uma credencial, o cadastro pela
página permanece bloqueado.

A API exporá dois contratos públicos e limitados:

- `GET /api/v1/auth/setup-status`: retorna apenas se o cadastro inicial está
  disponível, sem revelar usuário, organização ou configuração interna.
- `POST /api/v1/auth/setup`: aceita usuário, senha, confirmação e código de
  ativação. Só funciona quando não existe credencial e o código confere.

O backend validará usuário, senha mínima de 12 caracteres, confirmação,
limite de tentativas e comparação constante do código de ativação. A senha será
persistida somente como hash pelo repositório de identidade existente. O evento
de criação será auditado sem senha nem código de ativação.

### Frontend

A página `/login` consultará `setup-status` ao carregar:

- se o cadastro estiver pendente, exibirá “Criar acesso administrativo” com
  usuário, senha, confirmação e código de ativação;
- se já existir administrador, exibirá o formulário atual de login;
- se a consulta falhar, manterá o login visível e apresentará uma mensagem de
  indisponibilidade sem revelar detalhes internos.

Após o cadastro, a própria resposta criará a sessão HttpOnly e encaminhará o
operador ao painel, sem reenviar a senha em uma segunda requisição. A senha e o
código nunca serão gravados em armazenamento do navegador, logs ou HTML
gerado.

## Fluxo de dados

1. O navegador solicita `/api/v1/auth/setup-status` no mesmo domínio.
2. O Worker encaminha a chamada usando `API_INTERNAL_URL`.
3. A API consulta apenas a existência de credencial administrativa.
4. Se necessário, o navegador exibe o formulário de ativação.
5. O operador envia os campos e o código uma única vez.
6. A API valida o código, cria o hash da senha, persiste a credencial e cria a
   primeira sessão HttpOnly.
7. Chamadas posteriores de setup são negadas, mesmo com o código correto.
8. O login normal cria a sessão HttpOnly já existente.

## Tratamento de erros

- `401`: código de ativação inválido ou credenciais de login inválidas, com
  mensagens genéricas.
- `409`: administrador já criado; a interface muda para o modo de login.
- `412`: cadastro inicial não configurado no backend.
- `429`: limite de tentativas excedido, com `Retry-After`.
- `502/503`: API indisponível; a interface orienta verificar a conexão sem
  atribuir o problema à senha.

Nenhuma resposta deverá indicar se um usuário específico existe.

## Persistência

O banco da API precisa permanecer em volume persistente no Railway. A criação
do administrador não será considerada concluída operacionalmente até um novo
deploy da API confirmar que a mesma credencial continua funcionando. O fluxo
não apagará dados existentes nem substituirá automaticamente uma senha já
persistida.

## Testes

### Backend

- status informa cadastro disponível apenas sem credencial;
- setup exige código válido e senha conforme a política;
- setup cria hash, nunca texto puro;
- segunda tentativa retorna conflito;
- código incorreto não revela detalhes e sofre rate limit;
- eventos de auditoria não contêm senha nem código;
- login funciona com a credencial recém-criada.

### Frontend

- mostra cadastro inicial quando solicitado pela API;
- mantém login normal quando já existe administrador;
- limpa senha e código após falha;
- distingue falha de conexão de credenciais inválidas;
- envia apenas caminhos same-origin.

### Cloudflare

- o comando de deploy preserva variáveis do painel;
- a verificação de artefatos continua recusando nomes e formatos de segredos;
- `/api/health`, `setup-status`, setup e login funcionam pelo domínio do Worker.

## Implantação e rollback

1. Publicar primeiro o backend com `ADMIN_SETUP_TOKEN` configurado no Railway.
2. Confirmar volume persistente e `GET /health`.
3. Publicar o Worker preservando `API_INTERNAL_URL`.
4. Criar o primeiro administrador pelo domínio Cloudflare.
5. Confirmar login, sessão e persistência após um redeploy da API.
6. Remover ou rotacionar `ADMIN_SETUP_TOKEN` depois do primeiro acesso.

Em caso de falha, o frontend Railway permanece como rollback. O banco e o
volume não serão apagados; a versão anterior do Worker poderá receber 100% do
tráfego novamente.
