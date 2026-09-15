# Multi-tenancy

## Decisão

O VIRA.AI será multi-tenant por isolamento lógico em `organization_id`, dentro de um modular monolith inicialmente. Não haverá banco separado por usuário.

## Modelo conceitual

```text
Organization
├── Users
├── Leads
├── Sites
├── Agents
├── Usage
└── Billing
```

O modo local usa um principal de desenvolvimento limitado ao ambiente local. Fora de `development`, a API exige bearer tokens configurados por ambiente, resolve `actor_id` e `organization_id` desse contexto e aplica papéis de operador/administrador. Novos contratos tenant-scoped devem continuar carregando `organization_id`, e repositories/aplicação devem exigir o contexto da organização antes de acessar dados.

## Evolução

O desenho permite particionamento, políticas de acesso, filas por organização e extração de módulos para serviços independentes no futuro, sem antecipar microservices.
