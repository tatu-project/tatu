---
title: Current State
tags:
  - tatu
  - current-state
updated: 2026-10-03
---

# Current State

- Active outcome: finish the local scheduled-briefing release. Stages 1–6 have
  their recorded bounded acceptance; Stage 7 reliability validation remains open.
- Stack: TypeScript npm workspaces, Node.js `>=24.11.0 <25`, npm
  `>=11.6.0 <12`, native Node HTTP, and the replaceable local SQLite adapter
  using the approved `better-sqlite3` dependency.
- Implemented workflow: confirm a bounded daily-briefing request, persist the
  task, execute durable scheduled/manual occurrences with retries and restart
  recovery, research public HTTPS RSS, and write cited Markdown to a local inbox.
- The selected default source is TechCrunch's AI RSS feed. Optional Ollama
  synthesis uses a loopback endpoint; the default RSS output is deterministic
  and does not call an AI model.
- The UI exposes tasks, manual testing, execution events, a bounded title/source
  preview, and Setup Health. Worker liveness and estimated monetary cost are
  explicitly unknown.
- General AI conversation, editable product memory, installable PWA assets,
  push notifications, remote authentication, durable BYOK key management,
  additional live providers, and MCP/ChatGPT integration are not implemented.
- The installation is individual/local. Do not expose the unauthenticated API
  through a remote address, tunnel, reverse proxy, or shared hosting.
- Accepted technical choices are indexed in
  [the ADR index](../docs/decisions/README.md). The development brain summarizes
  those sources; it is not product memory.

## Reliability evidence

The recorded trial started September 16, 2026. Its only recorded daily
observation, September 17, recovered one missed occurrence without a duplicate
and failed safely after three research attempts because HTTPS was unavailable.
No delivery artifact was produced. No later observation or 30-day success is
established by those records.

On this workstation on October 3, ordinary `npm ci` succeeded on Windows
x64/Node 24.13.0/npm 11.6.2 without external C++ tools. Full `npm run ci` passed
formatting, lint, typecheck, 116 tests, and build. ADR-0022 records the reviewed
lifecycle and LF policies; ADR-0023 records the local HTTP boundary.

An isolated manual live preflight recovered its task/queue after API restart,
fetched three cited stories from the default feed, and delivered exactly one
Markdown artifact. A foreign Origin was rejected. All helper processes were
stopped; no trial days or continuous uptime were added. Standalone Compose
validated the new host-loopback mapping, but Docker image startup still needs
a Docker-enabled machine.

Next action: resume scheduled observations on the owner's running installation
and inspect the optional Docker runtime before using containers. A usable
public release, outside-user feedback, and support-program eligibility evidence
remain to be established. General conversation and MCP require later scoped
acceptance criteria; the local briefing release stays first.

Exact acceptance and next action: [ROADMAP.md](../ROADMAP.md).
Observation protocol: [docs/RELIABILITY-TRIAL.md](../docs/RELIABILITY-TRIAL.md).
Session history: [[07-Session-Log]].
