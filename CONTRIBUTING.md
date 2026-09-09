# Contribuindo com o VIRA.AI

## Princípios

Contribuições devem preservar modularidade, segurança por padrão e a separação entre dados pessoais e dados empresariais. Toda nova capacidade deve declarar sua finalidade, seus dados de entrada, retenção, controles de acesso e impacto sobre privacidade.

## Fluxo local

1. Crie uma branch a partir da branch principal.
2. Faça mudanças pequenas e focadas dentro do monorepo.
3. Não inclua secrets, chaves de API, dados pessoais reais ou bancos locais nos commits.
4. Execute os testes do backend com `python -m pytest apps/api/tests`.
5. Para mudanças no frontend, execute `npm run build:web` quando as dependências estiverem instaladas.
6. Atualize a documentação quando uma decisão arquitetural, de segurança ou privacidade mudar.

## Novos módulos e integrações

Novos módulos devem ficar em `modules/`. Integrações externas devem ficar em `integrations/`, atrás de uma interface, com configuração por ambiente e sem credenciais no código. Scraping, coleta de dados pessoais, autenticação e APIs pagas exigem uma decisão explícita de produto, segurança e privacidade antes da implementação.

## Qualidade

Prefira interfaces pequenas, dependências mínimas, validação de entrada, logs sem dados pessoais e testes que cubram comportamentos observáveis. Não use dados de produção em desenvolvimento local.

