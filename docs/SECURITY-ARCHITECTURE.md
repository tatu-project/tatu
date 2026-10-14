# Security architecture and agent boundaries

Status: private Colab version 2 published October 13, 2026. Historical version 2
proof is 205 tests/Python11+8; current public-source checks are 210 tests/Python13+8.
Static review and two 22-case gateway phases pass; native task read remains verified. Real owner Colab
pairing/first Tatu answer, active behavior, browser CRUD/mobile QA, scheduled
delivery remain open. Public [47bfc1e](https://github.com/tatu-project/tatu/commit/47bfc1e7de4e44a4bf9b074618df0d921db48b1b)/
[CI38500459769](https://github.com/tatu-project/tatu/actions/runs/38500459769)
passed Windows/Linux. Historical October 12 proof is separate. Neither these
checks nor publication prove full release acceptance, native control, audio, or E2EE. Completion
belongs to [`ROADMAP.md`](../ROADMAP.md). [ADR-0024](decisions/ADR-0024-mobile-cloud-security-and-agent-boundaries.md)
records the decision and alternatives. No 100%-secure claim is made.

[Verified app revision 4323d45](https://github.com/tatu-project/tatu/commit/4323d4584c0e8a9cce9857ff521ae1f5f27beafe)
has [successful Windows/Linux CI](https://github.com/tatu-project/tatu/actions/runs/38336981415).
The final local 189 tests/eight export cases pass with no failures/skips; the
cloud bundle remains unchanged. This closes the repository/CI gate only, not
the remaining web/mobile/AI/scheduling or planned privacy guarantees.

## Current protection versus planned privacy

| Boundary               | Current code/platform fact                                                                                                                                            | Limit or remaining acceptance                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transport              | Private QA Site published over HTTPS; live unauthenticated/forged identity and foreign-Origin requests are rejected.                                                  | Positive owner sign-in/CRUD, direct Worker-origin behavior, mobile visual QA, and provider calls remain unverified.                                    |
| D1 storage             | The platform encrypts storage; application records for messages, notes, and preferences are currently plaintext to the server.                                        | Disk encryption is not application E2EE and does not prevent an authorized runtime from reading content.                                               |
| Operational API keys   | Server AES-256-GCM envelopes, bounded current/previous keyring and compare-and-swap rotation pass fixture tests; the native runtime `v1` master secret is configured. | The server can decrypt keys: not E2EE. No real owner provider key/call was used; live connection/provider revocation and OAuth acceptance remain open. |
| Assistant context      | Selected conversation/memory/note context is sent to the authorized remote model route.                                                                               | The receiving provider can process that plaintext. Deleting Tatu records does not erase the provider's copies.                                         |
| Password/private vault | A separate user-held-key E2EE/zero-knowledge vault is planned.                                                                                                        | Not implemented or verified. The client key must never reach the server; lock/recovery/export and independent security tests are required.             |

Cloudflare documents provider-managed encryption at rest and TLS between Workers
and D1. This platform property does not change which content Tatu's runtime can
read. [D1 data security](https://developers.cloudflare.com/d1/reference/data-security/).

Current implementation pointers are [`vault.ts`](../apps/cloud/src/vault.ts),
[`providers.ts`](../apps/cloud/src/providers.ts),
[`storage.ts`](../apps/cloud/src/storage.ts), and
[`workspace.ts`](../apps/cloud/src/workspace.ts). Final static review has no
blocking findings; this remains a bounded reviewed QA release, not a universal
security guarantee. Exact deployment/probe evidence and gaps are in
[DEPLOYMENT.md](DEPLOYMENT.md#october-13-private-colab-publication-evidence).

## Identity, owner isolation, and portable deployment

The private Sites beta is the first deployment lane; independent Cloudflare
Workers/D1/Access configuration is the second, separately verified lane. An
identity adapter accepts only identity established by that lane's authenticated
ingress and maps its verified issuer/subject to an internal owner ID. An
arbitrary client-supplied owner header or raw Site ID cannot grant access.

All personal SQL reads, writes, foreign references, task claims, and tool actions
must use the internal owner. Authentication, cross-owner denial, CSRF/origin
checks, public projections, and deletion are enforced in deterministic code.
Moving between Sites/providers requires reauthentication and an explicit owner
remap; copying raw Site user IDs is not portable authorization. See
[`auth.ts`](../apps/cloud/src/auth.ts) and [`storage.ts`](../apps/cloud/src/storage.ts).

Published `/api/system/run-due` code requires independent
`SYSTEM_RUN_TOKEN`, including private Sites; absent that secret it is disabled.
Platform gateway bypass or Colab pair/session credentials establish neither
owner identity nor dispatcher authority. Route fixtures reject these broader
credentials, including operator/vault/Groq collisions during bootstrap.
The October 12 private-boundary probe is historical; the new live status-only
probes reject system requests before/after service-token configuration without
executing due work. Native automations are empty; prompt-based platform scheduling
has no verified code-dispatch mapping or guaranteed free cadence. Scheduling
stays disabled; portable code Cron has separate account/deployment requirements.

For the Colab adapter, expiry immediately denies credential use and late
completion; it does not schedule physical deletion. Payload/hash cleanup
requires subsequent configured scoped access/revoke/delete/retention. Disabling
configuration provides no guaranteed timed database erase. Notebook cleanup
clears references without guaranteed physical Python memory erasure; selected
context is plaintext in the Google VM and not E2EE against that executor.

## Operational secrets and the separate private vault

The current envelope code imports a 32-byte AES key, generates a random 12-byte
nonce, and authenticates owner, provider, envelope version, and key identifier as
additional authenticated data. The master key belongs only to runtime-secret
configuration. Key material must not appear in committed files, client assets,
model context, logs, returned metadata, or another owner's records. Decryption
is allowed only for a permitted provider operation; fixed failures reveal no
secret. Auditable access, key rotation, connection removal, and provider token
revocation remain required release/adapter checks, not automatic guarantees of
an encrypted column.

The current/previous keyring and compare-and-swap rotation are now fixture-tested.
That does not establish live credential revocation or every audit requirement.
The raw configured runtime master secret is never copied into these documents.
No AI binding/Groq key or real inference call was configured during publication
verification; context/provider exposure above describes the active data flow
when a user later enables an authorized route.

The planned private vault has a different trust boundary: its user key is held
by the client, and the server stores ciphertext without the ability to decrypt.
Passwords/private material are allowed only in that boundary. They never enter
assistant chat, memory, logs, models, plaintext SQL, or server operational-secret
records. OAuth/passkeys/API keys remain preferred for automation; raw cards,
CVVs, bank passwords, and wallet passwords are never part of the agent path.

An unattended online agent cannot use zero-knowledge data that it cannot decrypt.
Any future narrow delegation must explicitly state recipient, exact material,
purpose, expiration, and revocation. Plaintext temporarily supplied to an
authorized runtime/provider leaves the private E2EE boundary for that operation;
it cannot be described as still invisible to that runtime/provider. Locking,
recovery, encrypted export, key loss, ciphertext tampering, and owner isolation
require independent tests before the private vault is advertised as available.

## Account actions and platform boundaries

External actions use typed capabilities backed by an official authorized API,
least-privilege OAuth, or delegated access. The assistant may propose an action;
deterministic application code must bind its exact account, target, effect,
normalized inputs, and owner to an expiring one-use approval. Permission checks,
idempotency, sanitized audit, cancellation, and connection/token revocation must
still hold when a model retries, a response is lost, or untrusted content asks
for a different action. Tokens/passwords and unrestricted browser/command
execution never substitute for a missing action adapter.

Google Play Developer API access is restricted by Play Console permissions.
Its subscription cancellation operation needs the application's package and
purchase token; this is not evidence of a general API for a consumer's YouTube
Premium account. [Developer access requirements](https://developers.google.com/android-publisher/getting_started),
[subscription cancellation reference](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/cancel).

Without an authorized personal-account API, Tatu provides an explicit
user-assisted official subscription/settings handoff. The user chooses and
confirms the real action in that provider surface; no cancellation has been
performed in this work. [Google Play's official subscription flow](https://support.google.com/googleplay/answer/7018481).

Physical app/device control requires a separately accepted native companion
with visible opt-in, scoped permissions, cancellation, and revocation. A website,
PWA installation, or native wrapper alone does not automate Play Store. Actual
native mobile/desktop packages share the online backend but need their own
build/install/authentication/privacy tests.

## Daily briefing and NotebookLM handoff

The founder confirmed AI news at 09:00 in `America/Sao_Paulo` with NotebookLM
Audio Overviews. The current implemented Tatu handoff exports cited text for
manual NotebookLM import; the user generates audio there. Automatic Tatu audio
API integration is not implemented. Consumer access is not an automation API
grant; do not fabricate an audio artifact or count text delivery alone as
completion of the requested audio goal.

For a separately authorized automatic audio adapter, NotebookLM Enterprise overviews are Preview and require an existing
notebook with sources. Enterprise setup includes a billing-enabled Cloud project,
authorized identity/IAM access, and licensed user access. The standalone Podcast
API is deprecated and is not adding
new allowlisted customers. No unlimited-free or account-eligibility promise is
made. [Audio overview API](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview),
[Enterprise setup](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/set-up-notebooklm),
[standalone Podcast API status](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/podcast-api).

Plan a replaceable audio port with explicit source text, citations, authorized
credential, output, quota/cost, cancellation, and privacy contracts. An optional
authorized Enterprise adapter remains later work. Google Cloud Text-to-Speech
is a separate product with its own pricing/allowances; browser/device TTS is
another optional adapter and neither is NotebookLM. [Cloud TTS basics](https://docs.cloud.google.com/text-to-speech/docs/basics),
[Cloud TTS pricing](https://cloud.google.com/text-to-speech/pricing).

## Required verification

The [release checks](RELIABILITY-TRIAL.md) and roadmap remain unchecked until
the orchestrator records the relevant outcome. Security verification includes:

- Real authenticated deployment plus missing-auth, forged-identity, cross-owner,
  CSRF/origin, hostile text/link, deletion, and identity-migration denial cases.
- Operational-key ciphertext tampering, wrong owner/provider/key/version,
  missing master key, output/log redaction, rotation/removal, and revocation.
- Concurrent global/per-user quotas, timeout/provider failure, no silent paid
  route, and honest unavailable/manual-handoff states.
- External-action exact-target binding, expiration, replay, changed inputs,
  cancellation, idempotent retry, audit visibility, and revoked access.
- Independent native-device, real audio/playback, and client-held-key private
  vault tests before advertising those distinct capabilities.

Encryption cannot prevent every compromised-device, malicious authorized
runtime, identity-provider, browser-script, or recipient-provider failure.
Protection claims must name the tested boundary and remaining exposure.
