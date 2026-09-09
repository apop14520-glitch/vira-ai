# Providers

Este espaço define contratos neutros para futuros adapters de OpenAI, Anthropic, xAI e Ollama. Nenhum SDK, cliente HTTP, token ou chamada de API é implementado nesta fase.

Cada provider futuro deverá:

- receber configuração por ambiente ou secret manager;
- aplicar menor privilégio e limites de finalidade;
- evitar registrar prompts, respostas ou identificadores pessoais;
- expor capacidades por uma interface comum;
- possuir testes isolados e documentação de retenção e transferência internacional, quando aplicável.

