# ADR 0003 — Abstração de providers de IA

## Status

Aceita.

## Decisão

Centralizar contratos no AI Gateway e manter vendors atrás de adapters.

## Motivo

Preserva independência de fornecedor, testabilidade e capacidade futura de routing/fallback, sem integrar APIs nesta etapa.

