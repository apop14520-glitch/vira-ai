# API

A API é exposta por FastAPI e gera OpenAPI automaticamente. O espaço `/api/v1/` está reservado para endpoints versionados; `GET /health` permanece um endpoint operacional estável fora do namespace de produto.

Respostas de erro futuras seguirão `{ "error": { "code", "message", "request_id" } }`.

