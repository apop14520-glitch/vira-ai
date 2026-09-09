# Adaptação do Radar Leads para VIRA.AI

O projeto **radar-leads-vira-norte** é uma referência funcional autorizada pelo
proprietário. Esta integração não copia seu stack nem transporta dados: traduz
os comportamentos aderentes para a arquitetura modular do VIRA.AI.

## Entregue nesta etapa

- Pipeline de empresas: novo, qualificado, em conversa, proposta, ganho e perdido.
- Cadastro local de empresa, segmento, cidade, UF, site, origem e prioridade.
- Separação por organização, preparada para o futuro contexto autenticado.
- Controle de versão ao movimentar uma empresa, evitando sobrescrita silenciosa.
- Eventos de auditoria sem contatos ou conteúdo sensível.
- Interface VIRA Business consumindo a API FastAPI local.
- Busca opcional pela Foursquare Places, com nome do estabelecimento, cidade,
  UF e quantidade limitada a 20 resultados.
- Configuração da chave no menu superior, mascarada e mantida somente em
  memória durante a sessão local.
- Seleção explícita de um resultado para preencher nome, categoria, cidade, UF,
  site e origem do lead; a temperatura comercial permanece uma decisão do
  operador (`quente`, `morno` ou `frio`).

## Não portado deliberadamente

- Login, usuários, cookies e permissões: dependem da camada de identidade do VIRA.AI.
- Telefones, e-mails, nomes de contato, endereço e anotações livres: não são
  necessários para a primeira etapa e poderiam introduzir dados pessoais.
- Scraping, importação CSV, Google Places, Gemini e Ollama continuam fora do
  escopo. A Foursquare foi ativada apenas para busca explícita e limitada,
  com chave local não persistente; uso em produção exige controles adicionais.

## Próxima migração segura

Depois de autenticação e tenancy, substituir a organização local por contexto
de sessão, criar permissões por papel e avaliar cada fonte de dados em
`docs/legal/DATA_SOURCES.md` antes de qualquer coleta externa.
