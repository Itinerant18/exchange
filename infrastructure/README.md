# Infrastructure

The local development stack is intentionally simple:

```text
infrastructure/
├── docker/
│   └── postgres/   # Reserved for PostgreSQL init/configuration assets
└── scripts/        # Reserved for repeatable local operational scripts
```

- The PostgreSQL and pgAdmin services are defined in the root
  `docker-compose.yml`.
- `docker/postgres/` is empty of SQL scripts because no schema or seed data is
  created in this phase.
- Schema changes will use migrations, not ad-hoc init scripts.
- No Kubernetes or production deployment manifests are part of this phase.
