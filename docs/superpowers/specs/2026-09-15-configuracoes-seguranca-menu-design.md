# Configurações, segurança e menu administrativo

**Status:** aprovado para planejamento em 15/09/2026.

## Objetivo

Simplificar o menu suspenso de configurações do VIRA.AI e transformar a opção de senha administrativa em uma capacidade real, persistente e auditável. A interface deve deixar de apresentar preferências sem valor operacional, manter a leitura confortável em telas pequenas e permitir que o administrador troque a senha que controla o acesso administrativo do sistema.

## Contexto atual

O frontend está em `apps/web` com Next.js, React, TypeScript e Tailwind. O componente `PreferencesMenu` já possui tema, densidade, idioma, região, Foursquare, saúde, workspace, governança e capacidades, mas vários desses itens são apenas informativos. A densidade altera espaçamentos por meio de `data-density`, porém acrescenta complexidade visual sem uma necessidade operacional clara.

O backend em `apps/api` possui autenticação por bearer token para a API e bypass explícito somente no desenvolvimento local. Ainda não existe fluxo de senha, sessão web ou persistência de credenciais. Portanto, a troca de senha exige uma pequena camada de identidade; um formulário isolado no menu não seria funcional nem seguro.

## Decisões de escopo

### Incluído

- Remoção completa da preferência “Densidade”, incluindo estado React, `localStorage`, script de hidratação e regras CSS exclusivas.
- Redução do menu para três áreas de entendimento direto:
  - **Aparência:** tema, idioma e região.
  - **Integrações:** Foursquare e um diagnóstico compacto dos serviços.
  - **Segurança:** troca de senha administrativa e um resumo curto das proteções ativas.
- Rolagem interna explícita no menu, com altura máxima adaptada à viewport, `dvh`, `scrollbar-gutter` e navegação por teclado.
- Login administrativo por usuário e senha com sessão opaca em cookie protegido.
- Troca de senha exigindo senha atual, nova senha e confirmação.
- Hash de senha PBKDF2-HMAC-SHA256 com salt individual e 600.000 iterações.
- Revogação das sessões existentes após uma troca de senha.
- Rate limit local para tentativas de login e alteração de senha.
- Auditoria mínima para login, falha de login, troca de senha e encerramento de sessão, sem senha, token, IP ou conteúdo desnecessário.
- Manutenção do bearer token para integrações técnicas e compatibilidade com chamadas não-web.
- Uso de abstrações de persistência para que a implementação SQLite possa ser substituída por PostgreSQL.

### Não incluído

- Recuperação de senha por e-mail.
- Cadastro de múltiplos administradores.
- MFA, SSO ou integração com provedor externo de identidade.
- Alterações automáticas nas variáveis do Railway.
- Armazenamento da senha ou da chave Foursquare no navegador.
- Mudança de senha via chamada externa ou envio de credencial pelo chat.

## Experiência da interface

### Estrutura final do menu

O painel continuará aberto pelo botão superior com a sigla `V`, mas exibirá apenas:

| Grupo | Item | Conteúdo |
| --- | --- | --- |
| Preferências | Aparência | Tema e formato regional em uma área curta e legível. |
| Operação | Integrações | Foursquare e saúde da API, sem detalhes de infraestrutura que não podem ser alterados ali. |
| Segurança | Segurança | Troca de senha administrativa e indicadores resumidos de proteção. |

Os blocos “Workspace”, “Tenancy”, “Recursos”, “Capacidades”, “Eventos” e os avisos genéricos de roadmap serão retirados do menu principal. Decisões de arquitetura, privacidade e capacidades futuras continuam documentadas em `docs/`, onde podem ser consultadas sem competir com configurações executáveis.

### Aparência

“Aparência” terá somente o seletor de tema e uma linha compacta indicando `Português (Brasil)` e `America/Manaus`. Como idioma e região ainda não são editáveis, serão apresentados como estado ativo, sem fingir que são controles configuráveis.

O tema continuará sendo salvo em `localStorage` e aplicado antes da hidratação. A remoção da densidade não deve alterar o conteúdo nem a aparência base das páginas; o espaçamento padrão continuará definido pelo layout e pelos componentes.

### Integrações

“Integrações” manterá a configuração protegida da Service Key da Foursquare, sempre em campo de senha, sem retorno de valor à interface. A mensagem indicará claramente se a chave veio do ambiente ou da sessão local. O diagnóstico da API ficará em um cartão menor e não exibirá dados de usuários, chaves ou banco.

### Segurança

“Segurança” terá um formulário com:

- senha atual;
- nova senha;
- confirmação da nova senha;
- indicação de requisitos: 12 a 128 caracteres e confirmação idêntica;
- botão `Alterar senha`;
- mensagem de resultado sem ecoar dados enviados.

Após o sucesso, todas as sessões administrativas serão invalidadas e o frontend retornará ao login. O painel mostrará apenas a confirmação de que será necessário entrar novamente.

### Rolagem e acessibilidade

O diálogo terá `max-height` baseado em `100dvh`, com margem segura em celulares. O painel de conteúdo e a navegação lateral terão áreas de rolagem independentes quando necessário. A área de conteúdo usará `overflow-y: auto`, `scrollbar-gutter: stable`, `overscroll-behavior: contain` e foco visível. O botão de fechar, os itens de menu e os campos terão rótulos acessíveis e navegação por teclado.

## Fluxo de identidade

### Endpoints

O módulo de identidade fornecerá:

- `POST /api/v1/auth/login`: recebe `username` e `password`, valida o administrador e cria uma sessão.
- `GET /api/v1/auth/session`: informa apenas se existe uma sessão administrativa válida e retorna o identificador público do usuário, sem credenciais.
- `POST /api/v1/auth/logout`: revoga a sessão atual e remove o cookie.
- `PUT /api/v1/auth/password`: exige sessão administrativa e recebe `current_password`, `new_password` e `new_password_confirmation`.

As respostas seguirão o envelope de erro existente e sempre incluirão o `request_id`. Falhas de login não dirão se o usuário existe. A troca de senha terá respostas genéricas para credencial atual incorreta e não revelará o hash ou os requisitos internos do armazenamento.

### Sessão web

O login criará um token aleatório de alta entropia. O navegador receberá o token somente em cookie `HttpOnly`, com `SameSite=Lax` no desenvolvimento e `Secure` em ambiente HTTPS. O banco armazenará apenas o SHA-256 do token, junto de ator, organização, emissão, expiração e revogação. A sessão terá oito horas de validade e não será colocada em `localStorage`, query string ou resposta JSON.

As rotas web usarão `credentials: include`. O handler de proxy do Next.js encaminhará as chamadas para a API sem expor bearer tokens ou URLs internas ao bundle. O proxy receberá a origem exclusivamente por `API_INTERNAL_URL`, variável server-only com fallback local para `http://127.0.0.1:8000`; o bundle usará apenas caminhos same-origin. Cookies `Set-Cookie` da API serão repassados pelo handler, sem copiar o valor para JavaScript. O backend continuará aceitando bearer tokens apenas para integrações técnicas e operações automatizadas autorizadas.

### Credencial inicial

O ambiente fornecerá `ADMIN_USERNAME` e `ADMIN_INITIAL_PASSWORD` somente no primeiro provisionamento. Na inicialização, o backend criará o registro caso ainda não exista; uma senha já persistida nunca será sobrescrita automaticamente por uma variável de ambiente. Depois que a credencial existir, a senha inicial poderá ser removida do ambiente sem alterar o hash persistido. A senha inicial não será registrada em logs.

Para produção, a base usada pelo serviço deve ser persistente. SQLite continua válido para desenvolvimento local; uma implantação que precise manter a troca de senha após recriações deve usar a futura implementação PostgreSQL ou um volume persistente equivalente.

### Persistência

Será criada uma porta de identidade independente do SQLite, com uma implementação inicial contendo:

```text
admin_credentials
- id
- organization_id
- username
- password_hash
- password_changed_at
- created_at
- updated_at

admin_sessions
- token_hash
- actor_id
- organization_id
- issued_at
- expires_at
- revoked_at
```

O registro de credencial será único por organização e usuário. A organização será resolvida a partir de `AUTH_ORGANIZATION_ID` em ambientes não locais e do principal de desenvolvimento no loopback. Nenhuma tabela armazenará senha em claro.

### Hash e política de senha

O formato persistido conterá algoritmo, número de iterações, salt e digest para permitir evolução futura sem migração destrutiva. O verificador usará comparação em tempo constante. PBKDF2-HMAC-SHA256 com 600.000 iterações será o padrão inicial porque está disponível na biblioteca padrão e atende à recomendação atual da OWASP para ambientes que adotam PBKDF2. A política de interface limitará o tamanho máximo para evitar abuso de CPU e exigirá 12 caracteres no mínimo.

Referência: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Segurança e auditoria

- Login, logout e alteração de senha serão limitados por ator, endereço lógico da operação e janela de tempo em memória no adaptador local.
- Falhas de autenticação usarão o mesmo texto público, sem distinguir usuário inexistente de senha incorreta.
- A troca de senha exigirá sessão administrativa válida e a senha atual, além da confirmação da nova senha.
- A alteração revogará todas as sessões da organização antes de obrigar novo login.
- Eventos registrarão `actor_id` quando conhecido, `organization_id`, `request_id`, ação e resultado. Não registrarão senha, hash, token, IP, user-agent ou conteúdo do formulário.
- O cookie será apagado no logout e sessões expiradas serão ignoradas pelo resolvedor.
- O desenvolvimento continuará com bypass local explícito para preservar o fluxo existente, mas o formulário de senha poderá ser exercitado quando `ADMIN_INITIAL_PASSWORD` estiver configurada.
- Em produção, a ausência de configuração de identidade ou organização impedirá a inicialização segura.

## Organização de arquivos prevista

### Backend

- `apps/api/app/modules/identity/`: domínio, contratos e rotas de login, sessão e senha.
- `apps/api/app/security/passwords.py`: hash, verificação e validação de política sem dependência externa.
- `apps/api/app/security/auth.py`: resolução unificada de sessão web e bearer token.
- `apps/api/app/db/ports.py`: contratos necessários para o armazenamento de identidade.
- `apps/api/app/db/sqlite.py` e adaptador de identidade: implementação local e migrações aditivas.
- `apps/api/app/main.py`: inicialização do repositório, limiter e ciclo de vida.
- `apps/api/app/settings.py` e `.env.example`: configuração de usuário e senha inicial sem valores reais.

### Frontend

- `apps/web/src/app/login/page.tsx`: tela de entrada administrativa simples e compatível com tema.
- `apps/web/src/lib/auth-api.ts`: cliente de sessão e alteração de senha com cookies.
- `apps/web/src/app/api/[...path]/route.ts`: proxy same-origin para a API, com URL interna somente no servidor.
- `apps/web/src/components/preferences-menu.tsx`: menu reduzido, rolagem e formulário de segurança.
- `apps/web/src/app/layout.tsx` e `apps/web/src/app/globals.css`: remoção de densidade e tokens de rolagem.

## Testes e critérios de aceite

### Backend

- Hashes diferentes para a mesma senha por causa do salt.
- Senha correta valida e senha incorreta falha.
- Senhas abaixo de 12 ou acima de 128 caracteres são rejeitadas.
- Login válido cria cookie protegido e sessão persistida apenas por hash.
- Login inválido não revela qual parte da credencial falhou.
- Sessão expirada ou revogada não autentica uma rota protegida.
- Troca de senha exige senha atual e confirmação.
- Troca bem-sucedida persiste o novo hash e revoga sessões antigas.
- Logout revoga a sessão atual.
- Eventos de auditoria não contêm senha, hash, token ou conteúdo sensível.
- Rotas Business continuam tenant-scoped e a configuração Foursquare continua restrita ao administrador.

### Frontend

- O menu contém somente Aparência, Integrações e Segurança.
- Não existem referências funcionais a `vira-density`, `data-density`, “Densidade” ou `selectDensity`.
- O painel mostra rolagem quando a altura disponível é menor que o conteúdo.
- A troca de senha envia os três campos, trata erro e limpa os campos após sucesso.
- O frontend usa cookies com `credentials: include` e não expõe tokens em código cliente.
- O proxy usa `API_INTERNAL_URL` somente no servidor e repassa corretamente `Set-Cookie` e `Cookie`.
- `pnpm --filter @vira-ai/web run typecheck` e `pnpm --filter @vira-ai/web run build` passam.
- A suíte Python passa sem regressões.

## Operação e migração

Nenhuma alteração será feita diretamente no Railway durante a implementação local. Para ativar a senha em produção, será necessário configurar os segredos no serviço da API, garantir persistência do banco e publicar frontend e backend a partir do mesmo conjunto de alterações. A chave Foursquare existente não será lida, exibida ou migrada pelo novo fluxo.
