# Tatu

> A free and open-source personal AI agent that works for you 24/7.

**Status:** early development. Tatu is not ready for production use yet.

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

The project is in repository and technical-foundation setup. See:

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

The development stack is not final until Stage 2 records ADR-0001. Do not follow guessed installation commands yet. Start with [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Security

Do not report vulnerabilities through public issues. Follow [`SECURITY.md`](SECURITY.md).

## License

MIT — see [`LICENSE`](LICENSE).
