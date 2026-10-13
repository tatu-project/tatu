---
title: Current State
tags:
  - tatu
  - current-state
updated: 2026-10-13
---

# Current State

- Private QA beta published: https://tatu-brasil-beta-vitti.craftystar18.chatgpt.site
  with one owner and no other groups/external access. Native `DB` has 12 applied
  tables. The user reports ChatGPT sign-in worked on October 13; independent
  browser CRUD/mobile QA and full assistant acceptance remain open.
- Verified app [4323d45](https://github.com/tatu-project/tatu/commit/4323d4584c0e8a9cce9857ff521ae1f5f27beafe)
  is published on main; root synchronized `664b648`. [CI 38336981415](https://github.com/tatu-project/tatu/actions/runs/38336981415)
  passed Windows and Linux. Private Site source/deployment records are in
  [deployment evidence](../docs/DEPLOYMENT.md#october-12-private-publication-evidence).
  The founder's four `.codex` edits remain unchanged outside the intended commit.
- Root final checks: ordinary install of 157 locked packages, Windows Node
  24.13.0/npm 11.6.2; format/lint/types/189 tests/build passed; production audit
  has zero known vulnerabilities; final static review has no blocking findings.
- Fixture SQL/API and ten client tests cover scoped identity/data, encrypted keys,
  quotas, scheduler/MCP boundaries, and reviewed public cited-text NotebookLM
  export. Real HTTPS probes confirm negative access guards and empty-queue
  system readiness, not authenticated CRUD, real AI, or a scheduled task.
- Mobile/desktop online PWA remains the standard path; no end-user PC/Ollama.
  Independent Workers/D1/Access/Cron is a second lane not deployed live. Actual
  native packages/device actions and account integrations remain separate work.
- No AI binding/Groq key is configured: live chat is unavailable until the owner
  connects their authorized key in the HTTPS form, never chat. Site scheduling
  is false; no schedule/new task or LLM call was created by publication probes.
- October 13: the founder prohibits any existing Cloudflare rules/resources
  changes in the production business account. Wrangler 4.149 is installed and
  authenticated; root read only account/model metadata, with no Cloudflare/Site
  changes or inference. Billing-plan lookup returned 403; a standard usage label
  does not prove a Free plan. The shared account-wide 10,000 daily free Neurons
  do not guarantee zero billing or no business impact; activation is deferred.
- No usable browser session is available in this session; live browser QA remains
  open. Public API candidates produced no verified model output. These are
  current-session limitations, not permanent impossibility claims.
- The [manual Colab experiment](../docs/COLAB-EXPERIMENT.md) defaults to 8B with
  optional 27B/GPU preflight. User-pasted October 13 logs report T4 GPU/package
  setup, 16.4 GB downloaded (5/5), and loading 399/399, then `AttributeError`
  at the final `model.hf_device_map.items()` diagnostic. Actual device placement
  and inference are unconfirmed; diagnostic/cleanup correction passes root
  static/mock/local CI and reviewer checks. Actual guarded in-session GPU
  recovery awaits fresh output. Ideal 27B four-bit
  weights are about 13.5 GB plus overhead,
  not dependable T4 fit; Colab is not an unattended Tatu backend.
- Native automations are empty and have no verified code-dispatch bridge/free
  cadence guarantee. Dispatch trusts the single-owner private platform boundary,
  not service-only identity; wider sharing requires independent dispatch authority.
- Native `/mcp` tools are live for this authenticated platform account:
  `tatu_listar_tarefas` returned `[]`; `tatu_preparar_tarefa` returned an expiring
  09:00/three-story AI proposal requiring app confirmation. The proposal is
  transient owner QA data, not a created task. Standalone/manual OAuth, web cookie
  CRUD and mobile visual QA remain open; no raw direct Worker origin was guessed.
- Runtime `v1` envelope secret is configured privately; current/previous keyring
  CAS rotation passes tests. Server-decryptable keys and application-plaintext
  assistant records are not E2EE; a user-key password vault remains planned.
- Goal: daily 09:00 São Paulo AI news with NotebookLM Audio Overviews. Current
  handoff exports cited text for manual NotebookLM import/user audio generation;
  automatic audio integration is not implemented. Text alone is not the goal.
- The 30-day gate is removed without rewriting historical failures. Temporary
  approximately 3.66 GiB Ollama verification was removed after correction; no
  local service/process or downloaded model assets remain.

Next action: verify legitimate isolated free-inference entitlement outside the
protected production resources, then prove an authorized real turn. For the
manual Colab experiment, apply the reviewed guarded recovery in the existing
session and capture placement inspection plus the first real short answer.
Independently verify browser CRUD/mobile QA; native
MCP read/proposal is already verified, while broader confirmation/CRUD, actual
scheduling and portable deployment remain unchecked.
The local-session regression fix is included in the verified 189-pass/zero-fail final suite; the cloud bundle matches the published artifact.

Authoritative scope/status: [PROJECT.md](../PROJECT.md), [ROADMAP.md](../ROADMAP.md).
Security: [SECURITY-ARCHITECTURE.md](../docs/SECURITY-ARCHITECTURE.md).
Release checks: [RELIABILITY-TRIAL.md](../docs/RELIABILITY-TRIAL.md).
Session history: [[07-Session-Log]].
