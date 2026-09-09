# Database

SQLite é o banco inicial para desenvolvimento local. A aplicação acessa persistência por portas e adapters, mantendo a URL de conexão configurável por ambiente. Isso permite substituir o adapter por PostgreSQL no futuro sem acoplar os módulos de domínio a SQLite.

Não há schema de negócio nesta fase.

