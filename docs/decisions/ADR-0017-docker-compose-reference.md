# ADR-0017: Docker Compose reference packaging

- Status: accepted as a reference packaging decision
- Date: 2026-09-16

## Context

The local API and worker now have stable process boundaries, a shared SQLite data directory, and a local filesystem delivery outbox. A reproducible container reference can package those two processes without choosing a remote database, hosted provider, or production deployment model.

## Decision

Add a multi-stage `Dockerfile` and `compose.yaml` with separate `api` and `worker` services built from the same runtime image. Both services share a named `/app/data` volume for the local SQLite database and delivery outbox. The API exposes port 3000 and has a local `/api/health` container healthcheck; the worker starts after that check succeeds. Optional RSS/model environment variables are passed through without committing values or credentials.

The Compose file is a reference for local/self-hosted use only. It does not add Supabase, Firebase, a VPS, PostgreSQL, provider authentication, or a claim of production hardening.

## Verification boundary

`docker compose config` exits successfully and validates the `api` and `worker` services, their shared data volume, the API healthcheck, and the worker dependency on API health. Docker CLI `29.8.0` and Compose `v5.5.1` are installed. However, `docker version` cannot connect to the Docker Engine named pipe, and the Docker client reports access denied while reading the user Docker configuration/context. No image build or container startup has therefore been proven.

The next action is to start or repair Docker Desktop/the Docker daemon and restore access to the Docker configuration/context, then rerun `docker compose build` followed by a `docker compose up` smoke test. The Stage 7 Docker Compose checkbox remains unchecked until those build and startup checks succeed.
