# ADR-0002: Local task persistence

- Status: accepted
- Date: 2026-09-02

Use local SQLite through `better-sqlite3` for the Stage 3 task repository. The default path is `data/tatu.sqlite` and `TATU_DATABASE_PATH` may override it. This preserves a local-first, no-service foundation. This ADR narrowly supersedes ADR-0001's dependency-free production-runtime restriction: `better-sqlite3` is the sole approved production runtime dependency. `node:sqlite` was rejected because it emitted an ExperimentalWarning on Node.js v24.11.1. Scheduling and execution remain out of scope.
