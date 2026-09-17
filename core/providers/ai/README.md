# AI Gateway

O AI Gateway é a fronteira vendor-neutral entre os módulos do VIRA.AI e
futuros provedores de IA. Os contratos ficam em `contracts.py`; nenhum SDK,
cliente HTTP, chave ou credencial deve ser colocado neste diretório.

## Estado atual

- `AIRequest` aceita, opcionalmente, `request_id`, `source_ids` e metadados não
  sensíveis para rastreabilidade e futura proveniência.
- `SafetyVerdict` representa uma decisão `allow`, `warn` ou `block` sem guardar
  o texto que foi inspecionado.
- `guardrails.py` possui um inspetor determinístico inicial de prompt injection,
  bypass de segurança, troca de papel e sondagem do system prompt.
- `evaluation.py` mede fixtures offline com acertos, falsos positivos, falsos
  negativos, precisão e recall.

## Fronteiras

O guardrail é um sinal inicial. Autorização, tenancy, auditoria, privacidade,
rate limit, orçamento, revisão humana e política de provider continuam sendo
responsabilidades do módulo ou da plataforma que orquestrar a solicitação.

Os módulos não devem enviar dados para um provider até que exista um adapter
autorizado, um esquema de entrada/saída, política de retenção, avaliação,
observabilidade e configuração de segredo em runtime.

Consulte [`docs/architecture/AI_ENGINEERING_INTEGRATION.md`](../../../docs/architecture/AI_ENGINEERING_INTEGRATION.md)
e o [ADR 0004](../../../docs/adr/0004-ai-engineering-foundation.md) para o mapa
de evolução do VIRA Studio, VIRA Concursos e VIRA Business.
