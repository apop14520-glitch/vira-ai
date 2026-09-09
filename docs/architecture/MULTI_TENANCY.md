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

Autenticação ainda não existe. Mesmo assim, novos contratos tenant-scoped devem carregar `organization_id`, e repositories/aplicação devem exigir o contexto da organização antes de acessar dados.

## Evolução

O desenho permite particionamento, políticas de acesso, filas por organização e extração de módulos para serviços independentes no futuro, sem antecipar microservices.

