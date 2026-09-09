# ADR 0001 — Modular monolith inicial

## Status

Aceita.

## Decisão

Iniciar como modular monolith com fronteiras explícitas entre plataforma, módulos, core e integrações.

## Motivo

Mantém baixo custo operacional e permite validar domínios antes de extrair serviços. Extração futura dependerá de necessidade real de escala, isolamento ou ownership.

