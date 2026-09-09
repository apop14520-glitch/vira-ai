# AI Gateway

O gateway em `core/providers/ai/` define `AIProvider`, `ModelRouter`, `AIRequest` e `AIResponse`. Módulos de negócio dependem desses contratos, nunca de SDKs de OpenAI, Anthropic, xAI ou Ollama.

O contrato já reserva espaço para finalidade, organização, timeout, uso de tokens e custo estimado. Roteamento, fallback, retry, observabilidade e versionamento de prompts serão implementados somente quando houver provider autorizado e requisitos de produto.

