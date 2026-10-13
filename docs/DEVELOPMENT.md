# Development setup

Development commands are for maintainers. The standard end-user path is the
private authenticated HTTPS app on a phone/desktop browser; no local runtime
or model is required. See [DEPLOYMENT.md](DEPLOYMENT.md) for managed and independent
hosting, and [PROJECT.md](../PROJECT.md) for authoritative scope.

## Prerequisites and checks

Use Git, Node.js `>=24.11.0 <25`, and npm `>=11.6.0 <12`. VS Code/Codex, GitHub
CLI, and Docker are optional tools for the relevant workflows. On PowerShell,
use `npm.cmd` if the `.ps1` launcher is blocked.

From the repository root:

```sh
npm ci
npm run ci
npm run build
```

The final root verification on October 12, 2026 passed formatting, lint,
TypeScript, build and 189 tests with zero failures/skips on Windows Node
24.13.0/npm 11.6.2 after ordinary installation of 157 locked packages. All eight
export tests pass, mapped-drive cleanup leaves no SUBST entries, and review
retains canonical/symlink/preflight safeguards. Production audit reports zero
known vulnerabilities; no blocking static finding remains.

[Verified app revision 4323d45](https://github.com/tatu-project/tatu/commit/4323d4584c0e8a9cce9857ff521ae1f5f27beafe)
is pushed to `origin/main`, and [CI run 38336981415](https://github.com/tatu-project/tatu/actions/runs/38336981415)
completed successfully on Windows and Linux. The 173,003-byte cloud bundle is
unchanged. Earlier failures remain dated session history. These checks do not
prove web cookie login/CRUD/mobile visuals, real inference or unattended Cron;
those acceptance gates remain open.

`.npmrc` disables dependency install hooks. The legacy SQLite development/test
adapter uses audited package prebuilds on supported platforms; do not override
the lifecycle policy without review. `.gitattributes` retains LF formatting.
CI checks the repository on Windows and Linux; confirm the candidate's actual
remote run after publication.

## Cloud implementation

`apps/cloud` is the canonical online backend: a Fetch Worker with `fetch` and
`scheduled` handlers, owner-scoped D1 storage, remote provider adapters, envelope
key encryption, quotas, curated feed research, durable tasks/results, and bounded
authenticated MCP. The cloud bundle has no external native imports; local SQL
fixture tests do not prove hosted D1, real account sign-in, inference, or Cron.

```sh
npm run build:cloud
npm run export:site
```

Build generates `apps/cloud/dist/server/index.js` and supported metadata for the
two SQL migrations under `apps/cloud/migrations`. The isolated managed export
is ignored `tmp/cloudsite`; it is derived from `apps/cloud`, not a second source
of truth. The verified private QA bundle is 173,003 bytes with zero native/external
imports; record each later build's actual size rather than treating it as fixed.

Managed project metadata is `apps/cloud/.openai/hosting.json`. Its private QA Site
is published, and real HTTPS negative guards plus private MCP read/proposal calls
are verified. Positive web cookie login/CRUD, mobile visual QA, real inference,
and unattended scheduled execution remain open. Sites native scheduling
must be connected and tested before `SCHEDULER_ENABLED` changes from false.
`apps/cloud/wrangler.jsonc` is independent Workers/D1/Access configuration with a
one-minute Cron; it requires its own account, hostname, Access policy, bindings,
reviewed scheduler flag, migrations, secrets, and live acceptance.

Remote chat needs an authorized Groq key or an available Workers AI binding.
Tests may inject fixture providers; label them. Never call a consumer browser
session an API key, silently enable paid fallback, or download a model to make
a phone user's cloud setup work. A configured provider is not proven available.

The [security architecture](SECURITY-ARCHITECTURE.md) and
[ADR-0024](decisions/ADR-0024-mobile-cloud-security-and-agent-boundaries.md) explain
server-decryptable key envelopes, application-plaintext assistant records,
provider-visible selected context, and the separate planned private E2EE vault.
See the [release protocol](RELIABILITY-TRIAL.md) for auth/owner/CSRF/key/quota,
actual deployed mobile/MCP, and scheduler acceptance.

## Optional legacy local development

```sh
npm run dev
```

This starts the Node API and worker on `http://127.0.0.1:3000`, with local
SQLite/outbox configuration from `.env.example`. It remains useful for historical
self-hosting and regression work, but is not the mobile cloud backend. Keep its
unauthenticated API on loopback. `npm run smoke` is a local smoke command, not a
proof of published cloud inference or scheduling. The local stdio MCP helper is
also distinct from the authenticated hosted `/mcp` route.

Docker remains optional. September 16, 2026 verified the previous local image
build/startup; October 3 covered the updated Compose configuration only. With
no Docker engine here, a fresh container startup still needs a Docker-enabled
machine. Do not erase the historical record or call it current cloud proof.

The legacy local-individual `/api/me` projection has no remote account, session
or logout; `/` sign-out navigation is only local navigation. Data is local SQLite.
Shared UI settings retain cloud-oriented wording, so no full local-PWA or online
D1 acceptance is claimed for this Node developer/API profile. Its local-session boundary regression test passes in the final 189-test suite; no separate visual check passed.

## Coordinated development

Read `AGENTS.md`, `PROJECT.md`, `ROADMAP.md`, and the current brain before changing
code. The user selects the orchestrator model; shared project configuration does
not pin it. Meaningful work uses read-only Recon, bounded Executor, and read-only
Reviewer, with the orchestrator owning Git, final checks, status, and publication.
English delegation prompts include scope, constraints, acceptance, evidence, and
no Git publication. Preserve concurrent/user edits and stage only intended files.

The usual authorized instruction remains **Continue o Tatu**. Follow the Git
start/end protocols and report the verified commit; do not mark a roadmap stage
complete from generated code, fixtures, an expected URL, or a deadline. New agent
configuration may require restarting Codex before discovery can be verified.

Keep credentials, `.env`/runtime-secret files, databases, artifacts, caches, model
assets, private logs, and personal workstation configuration outside Git. Shared
repository documents/configuration describe reproducible behavior; private
account access, sign-in, and provider credentials remain owner-controlled.
