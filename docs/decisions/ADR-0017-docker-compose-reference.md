# ADR-0017: Docker Compose reference packaging

- Status: accepted as a reference packaging decision
- Date: 2026-09-16

## Context

The local API and worker now have stable process boundaries, a shared SQLite data directory, and a local filesystem delivery outbox. A reproducible container reference can package those two processes without choosing a remote database, hosted provider, or production deployment model.

## Decision

Add a multi-stage `Dockerfile` and `compose.yaml` with separate `api` and `worker` services built from the same runtime image. Both services share a named `/app/data` volume for the local SQLite database and delivery outbox. The API exposes port 3000 and has a local `/api/health` container healthcheck; the worker starts after that check succeeds. Optional RSS/model environment variables are passed through without committing values or credentials.

The Compose file is a reference for local/self-hosted use only. It does not add Supabase, Firebase, a VPS, PostgreSQL, provider authentication, or a claim of production hardening.

## Verification boundary

`docker compose config` exits successfully and validates the `api` and `worker` services, their shared data volume, the API healthcheck, and the worker dependency on API health. A clean `docker compose build --no-cache` produces both `tatu-api` and `tatu-worker` images. The build stage installs only the native compilation tools required by `better-sqlite3`, excludes TypeScript incremental artifacts from the build context, and forces a fresh TypeScript emission; the runtime image remains slim. `docker compose up -d` starts a healthy API and running worker, and both `/api/health` and `/api/setup-health` return `200` in the smoke test. The named data volume is preserved when the temporary test stack is stopped with `docker compose down`.

This is an acceptance result for the local/self-hosted reference only. It does not claim production hardening, remote database support, provider reachability, or external delivery guarantees. The Stage 7 Docker Compose checkbox is complete for this bounded reference deployment.
