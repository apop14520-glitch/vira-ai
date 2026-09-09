# LGPD e privacidade

Este documento estabelece guardrails técnicos iniciais alinhados à Lei nº 13.709/2018 (LGPD). Ele não substitui análise jurídica específica para cada produto, fonte de dados ou operação de tratamento.

## Princípios adotados

- **Privacy by design e by default:** privacidade é requisito de arquitetura; configurações iniciais devem expor o mínimo.
- **Finalidade e necessidade:** cada campo e fluxo futuro deve ter finalidade documentada e ser limitado ao necessário.
- **Transparência e responsabilização:** decisões, fontes, retenção, acessos e incidentes devem ser registráveis e auditáveis.
- **Segurança e prevenção:** controles proporcionais devem existir antes da ativação de novos tratamentos.
- **Não discriminação e livre acesso:** produtos futuros devem considerar impactos sobre titulares e meios adequados de consulta/correção.

## Regras técnicas iniciais

1. Não coletar dados pessoais nesta fase.
2. Não usar dados reais em desenvolvimento, testes, fixtures ou logs.
3. Separar dados pessoais de dados empresariais em modelos, tabelas, permissões, retenção e observabilidade.
4. Definir base legal, finalidade, controlador/operador, retenção e descarte antes de ativar um tratamento.
5. Tratar dados públicos como dados que ainda podem conter dados pessoais; publicidade não elimina obrigações de proteção.
6. Não enviar dados a providers de IA sem avaliação de finalidade, contrato, transferência internacional, retenção e controles.
7. Manter secrets fora do código e do controle de versão.

## Classificação futura

Todo dado deverá ser classificado, no mínimo, como: público, empresarial não pessoal, pessoal, pessoal sensível, credencial/segredo ou dado operacional. A classificação deverá orientar acesso, retenção, criptografia, mascaramento e auditoria.

## Direitos dos titulares

Fluxos futuros que tratem dados pessoais deverão prever mecanismos para atender direitos aplicáveis dos titulares, com validação de identidade, escopo, prazo, trilha de auditoria e proteção contra divulgação indevida.

