# ADR-0004: Individual local deployment

- Status: accepted
- Date: 2026-09-15

## Context

Tatu has a local SQLite adapter behind persistence ports and does not yet need a shared service, remote database, multi-user tenancy, or managed infrastructure for its first useful workflow.

## Decision

The first continuous deployment is one individual local/self-hosted installation per user. Tasks, executions, and data remain in that installation's `data/tatu.sqlite` file. The initial path does not configure Supabase, Firebase, a VPS, a hosted database, or a PostgreSQL migration.

## Consequences

The installation owner is responsible for keeping the process running, local backups, machine security, and availability. Separate installations do not share users or data. SQLite remains an adapter, not a universal production decision: a PostgreSQL adapter may be considered only after an explicit product decision requires remote or shared deployment.

## Acceptance

A clean clone can run `npm ci` and `npm run dev`, use its local database without external credentials or services, and recover persisted tasks and execution history after restart.
