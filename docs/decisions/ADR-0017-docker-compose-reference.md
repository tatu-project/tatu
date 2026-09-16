# ADR-0017: Docker Compose reference packaging

- Status: accepted as a reference packaging decision
- Date: 2026-09-16

## Context

The local API and worker now have stable process boundaries, a shared SQLite data directory, and a local filesystem delivery outbox. A reproducible container reference can package those two processes without choosing a remote database, hosted provider, or production deployment model.

## Decision

Add a multi-stage `Dockerfile` and `compose.yaml` with separate `api` and `worker` services built from the same runtime image. Both services share a named `/app/data` volume for the local SQLite database and delivery outbox. The API exposes port 3000 and has a local `/api/health` container healthcheck; the worker starts after that check succeeds. Optional RSS/model environment variables are passed through without committing values or credentials.

The Compose file is a reference for local/self-hosted use only. It does not add Supabase, Firebase, a VPS, PostgreSQL, provider authentication, or a claim of production hardening.

## Verification boundary

`docker compose config` validates the service, volume, healthcheck, and dependency structure. A full image build remains an environment-dependent acceptance check; on the development workstation it was blocked before Dockerfile execution by Windows Docker context symlink permissions. The Stage 7 Docker Compose checkbox therefore remains unchecked until a clean Docker build and startup smoke test are completed.
