# Tatu

> A free and open-source personal AI agent that works for you 24/7.

**Status:** early development. Stage 3 can persist confirmed daily briefing tasks locally; Tatu is not ready for production use yet.

Tatu aims to let anyone describe what they want in natural language while the system handles scheduling, research, tools, memory, model selection, free-provider fallback, permissions, and execution traces.

## Principles

- Free isn't a tier. It's the architecture.
- R$0 is the standard path for the creator and user whenever technically possible.
- Simple for nontechnical users; powerful for developers.
- Provider-agnostic, self-hostable, and open source.
- Optional BYOK and premium models, never required for the base experience.
- Safe autonomy through deterministic permissions and risk-based confirmation.

## First useful version

The first end-to-end goal is intentionally small:

> Every day at 8 AM, find the three most important AI stories and send them to me.

Tatu must execute this automatically on the following day, use an available free route, cite sources, record a trace, and deliver the result.

## Current status

Stage 3 is complete: a daily briefing request can be parsed, confirmed, persisted locally, listed, and recovered after an API restart. Stage 4 execution is not started. See:

- [`PROJECT.md`](PROJECT.md) for the product source of truth.
- [`ROADMAP.md`](ROADMAP.md) for stages and current progress.
- [`AGENTS.md`](AGENTS.md) for Codex working agreements.
- [`brain/`](brain/README.md) for the Obsidian-compatible project brain and compact current context.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution workflow.

## Planned MVP surfaces

- Chat
- Tasks
- Executions
- Setup Health
- Responsive PWA

## Development

Requirements: Node.js `>=24.11.0 <25` and npm `>=11.6.0 <12`.

From a clean clone, install and start both the API and standby worker with:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` for the responsive Tatu Health page, or `http://localhost:3000/api/health` for its JSON contract. Stop the development processes with `Ctrl+C`.

Run the full local quality suite with:

```sh
npm run ci
```

[`ADR-0001`](docs/decisions/ADR-0001-initial-stack.md) records the dependency-free Stage 2 foundation. [`ADR-0002`](docs/decisions/ADR-0002-local-task-persistence.md) supersedes that narrow runtime restriction for Stage 3 and approves `better-sqlite3` as the sole production runtime dependency.

## Security

Do not report vulnerabilities through public issues. Follow [`SECURITY.md`](SECURITY.md).

## License

MIT — see [`LICENSE`](LICENSE).
