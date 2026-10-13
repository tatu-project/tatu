# Tatu

A Brazilian, MIT-licensed personal assistant with an online backend and an
installable mobile/desktop web app. [Leia em português](README.pt-BR.md).

**Status:** [private QA beta published](https://tatu-brasil-beta-vitti.craftystar18.chatgpt.site).
The final local suite passed 189 tests and real HTTPS probes verified negative
access guards. Authenticated native MCP read/proposal works for the checked
account; web owner sign-in/CRUD, real AI, mobile visual QA and scheduling remain
open. The [implementation commit d2a8bc2](https://github.com/tatu-project/tatu/commit/d2a8bc22e9ecb6a990852ca38c8dc8fb596ab680)
is published on `main`; [remote CI](https://github.com/tatu-project/tatu/actions/runs/38336981415)
passed on Windows and Linux for [verified app revision 4323d45](https://github.com/tatu-project/tatu/commit/4323d4584c0e8a9cce9857ff521ae1f5f27beafe), confirmed by [CI run 38336981415](https://github.com/tatu-project/tatu/actions/runs/38336981415). No mandatory 30-day wait remains. [ROADMAP.md](ROADMAP.md) records proof.

## Use the private beta

Open the private link and sign in with its owner account; access is owner-only.
The positive sign-in flow still needs a browser verification. Use the app from a phone or desktop
browser; PWA installation is optional. No PC left running, Ollama, model download,
Node.js, or terminal is required for the online user path.

The candidate provides conversations, selected preference memory/notes, daily
AI-news tasks, pause/edit/resume, execution history, a cited briefing reader,
provider connections, and bounded authenticated MCP. These are implemented
surfaces with fixture/client test evidence; the full authenticated deployed flow
is still open. No competitor-parity claim is made.

No Workers AI binding or Groq credential is configured, so general AI chat is
currently unavailable. After sign-in, connect your own authorized Groq key through
the HTTPS connection form, never chat, and verify the first real turn. Missing
routes, provider limits, and internet failures are shown rather than replaced
with fabricated replies.

The founder request is AI news at **09:00, America/Sao_Paulo**. Research currently
uses curated public AI feeds, supports 1–10 stories, and produces cited RSS
excerpts rather than claiming AI-written facts. Results are delivered in-app.
Managed Sites scheduling remains disabled until its native dispatch bridge is
connected and verified; the portable one-minute Cron configuration has separate
acceptance. A live empty-queue dispatcher readiness test passed, but no schedule
or new user task was created. This does not prove unattended task execution.

NotebookLM **Audio Overviews** are the confirmed target. Tatu currently exports
cited text for manual import into [NotebookLM](https://notebooklm.google.com/),
where you generate the audio. Automatic Tatu audio API integration is not
implemented; consumer access is not an API grant. Text delivery alone does not
complete the audio goal.

## Data, allowances, and limits

- Authenticated owner-scoped D1 stores conversations, preferences, notes, tasks,
  and results. Up to 500 terminal executions per owner are retained; pending and
  running executions are preserved.
- Operational Groq keys use server-decryptable encryption, **not E2EE**. Assistant
  text is plaintext at the application layer; selected context goes to the
  authorized provider. Provider copies are not erased by deleting Tatu records.
- Current per-owner AI caps: 8 requests/minute, 30/day for sponsored routes or
  100/day for BYOK, 4,096 context bytes, 1,024 output tokens, and 2 concurrent
  requests. Shared/provider limits may be lower and external quota is unknown.
- API caps are 240 reads and 60 mutations per minute per owner. Free hosting,
  account eligibility, unlimited inference, and continuous uptime are not
  guaranteed. There is no automatic paid fallback.

See [security architecture](docs/SECURITY-ARCHITECTURE.md) and
[deployment/operations](docs/DEPLOYMENT.md). Native mobile/desktop packages,
physical device actions, connected-account automation, a client-held password
vault, and automatic NotebookLM/audio adapters remain separately verified work.

Native private MCP is connected for the checked platform account: task listing
returned `[]`, and task preparation returned an expiring 09:00/three-story AI
proposal requiring app confirmation. It created no task or schedule. Independent
manual OAuth setup and browser cookie login are separate unverified flows.

## Develop or host independently

Maintainers use Node.js `>=24.11.0 <25` and npm `>=11.6.0 <12`:

```sh
npm ci
npm run ci
npm run build
```

These are developer checks, not online-user onboarding. The cloud Worker lives
in `apps/cloud`; [DEVELOPMENT.md](docs/DEVELOPMENT.md) explains builds/tests and
[DEPLOYMENT.md](docs/DEPLOYMENT.md) separates private Sites from independent
Workers/D1/Access deployment. Legacy Node/SQLite self-hosting remains optional
and must not expose its unauthenticated API publicly.

[PROJECT.md](PROJECT.md) defines scope, [AGENTS.md](AGENTS.md) defines the agent
workflow, and [CONTRIBUTING.md](CONTRIBUTING.md) explains contributions.
[Maintainer-support preparation](docs/OPEN_SOURCE_SUPPORT.md) is independent of
hosting and end-user inference; no application approval or adoption is claimed.

MIT: [LICENSE](LICENSE). Providers, models, and dependencies retain their own
terms. Report vulnerabilities using [SECURITY.md](SECURITY.md).
