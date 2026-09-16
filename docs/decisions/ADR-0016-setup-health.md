# ADR-0016: Bounded Setup Health surface

- Status: accepted
- Date: 2026-09-16

## Context

The original `/api/health` contract proves only that the HTTP foundation is serving. Beginners also need a safe operational view of the local setup, but a health page must not claim provider reachability, worker liveness, memory support, exact next-run timing, or pricing facts that the current architecture cannot prove.

## Decision

Keep `/api/health` stable and add a separate `GET /api/setup-health` contract rendered by the existing Tatu Health page. It reports bounded, provider-independent checks for the API process, readable task storage, configured AI route, research configuration, memory support, and scheduler liveness. It also reports an explicit unknown cost and the next enabled task's configured local time/timezone when available.

The endpoint performs no network or provider probe. It never returns environment values, feed or model URLs, database or delivery paths, credentials, raw errors, task topics, or provider payloads. States such as `unknown`, `disabled`, `not_implemented`, and `unavailable` remain visible rather than being presented as green readiness.

## Consequences

The page gives beginners a truthful zero-cost setup overview while preserving the replaceable persistence and provider boundaries. Worker heartbeat, live provider reachability, persistent memory, exact next-occurrence calculation, and monetary pricing remain separate future contracts; this decision does not mark them as implemented.
