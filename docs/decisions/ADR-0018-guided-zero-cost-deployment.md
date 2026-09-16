# ADR-0018: Guided zero-cost local deployment

- Status: accepted
- Date: 2026-09-16

## Context

The first useful Tatu workflow is designed for one person and one local installation. It must be usable without a hosted database, provider account, paid service, or Docker, while still explaining persistence, scheduled execution, delivery, and safety limits clearly enough for a beginner.

## Decision

Document `docs/DEPLOYMENT.md` as the primary guided path: clone the repository, run `npm ci`, verify with `npm run ci`, start the API and standby worker with `npm run dev`, confirm Setup Health, and create the daily briefing task. The default public RSS route and local filesystem outbox remain the zero-cost path; local Ollama is optional and loopback-only. The guide includes local backup and troubleshooting instructions and explicitly prohibits committing secrets or exposing the local API publicly.

Docker Compose remains an optional packaging reference, not a prerequisite or a production deployment decision. Supabase, Firebase, VPS hosting, remote/shared PostgreSQL, provider authentication, and paid services remain outside this path.

## Consequences

Another founder can reproduce the verified local workflow with the existing Node/npm requirements and no new infrastructure. Availability still depends on the local machine and public RSS source, and the guide does not claim worker liveness, persistent memory, exact next-run timing, monetary pricing, or production hardening.
