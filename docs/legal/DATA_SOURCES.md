# Fontes de dados

## Estado atual

O VIRA Business possui uma integração opcional com a Foursquare Places para
buscar estabelecimentos por nome e localidade. A busca só é executada depois
que o operador configura uma Service Key no menu superior e confirma cada
resultado antes de criar um lead.

Nesta etapa, o VIRA.AI não solicita telefone, e-mail, nome de contato ou
endereço residencial. O endereço comercial retornado pela busca é exibido
somente para conferência e não é persistido no lead. O banco local guarda os
campos empresariais mínimos, a origem `Foursquare Places` e o identificador
externo do local selecionado.

A chave da Foursquare pode vir de `FOURSQUARE_API_KEY` no ambiente ou ser
configurada pela interface para a sessão local. Ela nunca é retornada pela
API, gravada no navegador ou registrada em logs. Antes de produção, substituir
o armazenamento em memória por um gerenciador de segredos e concluir a revisão
de termos de uso, retenção, atribuição e redistribuição.

Referência técnica do fornecedor:
<https://docs.foursquare.com/fsq-developers-places/reference/place-search>.

Para facilitar a seleção de localidade, a busca utiliza a lista pública de
municípios do IBGE por UF. Essa consulta serve apenas para preencher o filtro
de cidade/município; não cria lead, não envia dados pessoais e possui uma lista
local de referência para manter a tela utilizável quando o serviço estiver
indisponível.

Referência técnica do IBGE:
<https://servicodados.ibge.gov.br/api/docs/localidades>.

## Processo obrigatório para fontes futuras

Antes de ativar uma fonte, registrar:

- identificação do fornecedor ou origem;
- tipo de dado e classificação (empresarial, pessoal, sensível ou segredo);
- finalidade específica e produto que a utiliza;
- base legal e avaliação de necessidade;
- termos de uso, licença, restrições de redistribuição e frequência de atualização;
- países envolvidos e eventual transferência internacional;
- retenção, descarte, correção e mecanismo de auditoria;
- controles de acesso, minimização e tratamento de erros.

Dados de CNPJ podem ser empresariais, mas registros associados podem conter dados pessoais. A classificação deve ocorrer por campo e não apenas por fonte. Dados publicamente acessíveis também devem ser tratados com responsabilidade e dentro da finalidade aprovada.
