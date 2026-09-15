# Compatibilidade futura com Cloudflare

## Decisão atual

O VIRA.AI continua sendo executado localmente e o ambiente remoto existente
continua fora desta mudança. Nenhum arquivo de configuração do Railway foi
criado ou alterado, nenhum deploy foi disparado e a branch principal não é
modificada por este trabalho.

A compatibilidade futura foi preparada por fronteiras de runtime:

- o navegador chama somente rotas same-origin em `/api/...`;
- o proxy do Next mantém `API_INTERNAL_URL` exclusivamente no servidor;
- o FastAPI continua separado como serviço de API;
- a persistência é acessada por uma porta, permitindo trocar SQLite por outro
  adapter no futuro;
- secrets continuam sendo fornecidos pelo ambiente ou por um gerenciador de
  secrets, nunca pelo bundle do navegador;
- as rotas do proxy usam uma allowlist explícita, evitando encaminhamento
  arbitrário para destinos internos.

## Opções de implantação futura

O frontend pode ser avaliado para Cloudflare Workers com OpenNext, que é o
caminho documentado para aplicações Next.js existentes. Para projetos novos,
a documentação atual da Cloudflare também apresenta o vinext como opção em
beta. A escolha deve ser feita depois de validar as dependências do VIRA.AI,
o comportamento do App Router e os limites de runtime.

O FastAPI pode permanecer como serviço de origem no Railway ou ser avaliado
separadamente no runtime Python da Cloudflare, que oferece suporte a ASGI.
Essa avaliação não faz parte desta etapa e não substitui a persistência ou a
gestão de secrets de produção.

Referências oficiais:

- [Next.js na Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext na Cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [FastAPI no runtime Python da Cloudflare](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/)

## Contrato de configuração

No frontend, a variável aceita é:

```text
API_INTERNAL_URL=https://origem-privada-da-api.example
```

Ela deve ser configurada como variável server-side/secret no ambiente de
execução. Não deve ser renomeada para `NEXT_PUBLIC_API_INTERNAL_URL`, nem
exposta em componentes client-side.

Quando o frontend e a API forem serviços separados no Railway, essa variável
fica somente no serviço web. Ela deve apontar para a URL base do serviço da
API, sem acrescentar `/login`, `/api` ou `/health`. O serviço da API recebe as
variáveis de identidade e os tokens de runtime; ele não precisa receber
`API_INTERNAL_URL` para atender às requisições.

Para a primeira publicação, os nomes canônicos recomendados são
`ADMIN_USERNAME`, `ADMIN_INITIAL_PASSWORD`, `ENVIRONMENT`, `CORS_ORIGINS`,
`API_ACCESS_TOKEN`, `ADMIN_ACCESS_TOKEN` e `AUTH_ORGANIZATION_ID`. A senha
inicial é usada apenas quando não existe uma credencial persistida; alterar a
variável depois não redefine a senha existente.

No ambiente local, o valor padrão aponta para `http://127.0.0.1:8000`. No
Railway, a configuração existente deve continuar sendo administrada pelo
serviço correspondente. Em Cloudflare, o mesmo contrato poderá ser mapeado
para a variável ou binding equivalente da plataforma escolhida.

## Checklist antes de migrar

1. Escolher OpenNext ou vinext com base em uma matriz de compatibilidade
   testada, sem substituir o build atual de forma silenciosa.
2. Manter a API e o frontend com origens e healthchecks observáveis.
3. Substituir SQLite por um adapter de produção; o arquivo local não pode ser
   usado como banco de uma implantação distribuída.
4. Configurar secrets somente no ambiente de execução e rotacioná-los antes
   da publicação.
5. Validar cookies HttpOnly, CORS, rate limit, auditoria e logs sem dados
   pessoais no novo runtime.
6. Fazer a migração por ambiente separado, preservando o Railway como origem
   de rollback até a confirmação dos testes.
