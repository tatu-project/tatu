# ADR-0001: Initial technical foundation

- Status: accepted
- Date: 2026-09-02

## Context

Tatu needs a small, reproducible foundation before scheduling and research work begins. The initial environment must be free-first, self-hostable, and easy for both founders to run.

## Decision

Use an npm-workspaces TypeScript monorepo on Node.js `>=24.11.0 <25` and npm `>=11.6.0 <12`.

- `apps/web` renders the responsive Tatu Health page.
- `apps/api` is a Node HTTP server and owns `GET /api/health`.
- `apps/worker` is a separate standby process with no scheduling behavior.
- `packages/shared` owns the typed health-status contract.
- Production code uses only Node.js built-ins and TypeScript. TypeScript, ESLint, and Prettier are development-only tooling.

## Consequences

The foundation has no framework, database, provider, scheduler, Docker dependency, or paid service. It favors a clear vertical health slice and leaves later architectural choices isolated behind app/package boundaries.

## Alternatives considered

- A full web framework: deferred until a user-facing workflow needs it.
- A single-process application: rejected because the roadmap requires separate API and worker responsibilities.
- Third-party runtime libraries: rejected to keep the initial path minimal and dependency-free in production.
