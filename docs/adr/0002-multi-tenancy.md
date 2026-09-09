# ADR 0002 — Isolamento lógico por organização

## Status

Aceita.

## Decisão

Usar `Organization` e `organization_id` como limite lógico de tenant, sem banco separado por usuário.

## Motivo

Permite governança, auditoria e evolução para escala sem acoplar o produto a uma topologia de banco prematura.

