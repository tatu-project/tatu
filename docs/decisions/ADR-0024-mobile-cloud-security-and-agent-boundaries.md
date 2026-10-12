# ADR-0024: Mobile cloud security and agent boundaries

- Status: accepted architecture; implementation/deployment acceptance remains open
- Date: 2026-10-12

## Context

The user corrected the first product to an online assistant usable from a
phone without a local PC/model, then required website/mobile/desktop surfaces,
eventual actions for connected accounts, a daily 09:00 AI briefing with Google
notebook summaries, encrypted credentials/passwords, and strong practical E2EE.
The user confirmed NotebookLM Audio Overviews: summaries in audio. The earlier
text-only interpretation was incorrect. The current Tatu handoff exports cited
text for manual NotebookLM import, where the user generates audio; an automatic
Tatu audio API adapter is not implemented or implied by consumer access.
Local-only deployment rules cannot satisfy that direction. An encrypted
server-held API key also cannot honestly be marketed as a zero-knowledge vault.

Cloud implementation is uncommitted WIP with focused tests; this ADR accepts
boundaries, not a live release or completion of any unchecked roadmap stage.

## Decision

1. Verify the website and installable mobile/desktop PWA against one online
   backend first. Native packages and an optional visible/revocable device
   companion require separate platform acceptance. No end-user Ollama/local
   model requirement returns through packaging.
2. Use a private Sites authenticated/D1/MCP lane first, retaining portable
   Workers/D1/Access configuration as a separately tested second lane. Verified
   issuer/subject maps to internal owners; migration requires reauthentication
   and explicit remapping rather than copying raw Site user IDs.
3. Use TLS, platform storage encryption, server-enforced owner SQL boundaries,
   CSRF checks, bounded projections, redaction, strict quotas, and revocation.
   Operational API/OAuth tokens use server envelope AES-256-GCM with a
   runtime-only master key and owner/provider/version-bound authenticated data.
   Current provider-key envelopes are server-decryptable, not E2EE; current
   messages/notes/preferences remain plaintext at the application layer.
4. Plan a separate user-key E2EE/zero-knowledge private vault. Its key never
   reaches the server; password storage is allowed only in that boundary,
   superseding the former blanket password ban for this scoped purpose. No
   passwords in chat/logs/models/plain SQL/server operational records; no raw
   cards/CVV/bank/wallet password in the agent path. Lock/recovery/export and
   independent security tests are prerequisites.
5. Never imply that an unattended cloud agent can decrypt that private vault.
   A future narrow delegation explicitly authorizes a temporary plaintext
   runtime/recipient boundary. Provider-bound context is outside private E2EE;
   Tatu deletion does not delete provider-held copies. No 100%-secure claim.
6. Prefer typed official APIs and least-privilege OAuth/passkeys for owner
   actions. Exact owner/account/target/effect/inputs bind to expiring one-use
   approval enforced in deterministic code, with idempotency, sanitized audit,
   cancellation, and revocation. Unsupported personal APIs use an explicit
   user-assisted official settings/browser handoff; a PWA does not perform
   physical Play Store actions.
7. Preserve daily 09:00 `America/Sao_Paulo` news with NotebookLM Audio Overviews
   as the goal. The current handoff is cited text export/manual import, with the
   user generating audio in NotebookLM. A replaceable audio port/authorized
   Enterprise adapter requires separate acceptance and is not implemented. No
   fake audio, assumed consumer API grant, automatic Tatu audio generation, or
   unlimited-free inference/audio; text delivery alone is not goal completion.

The detailed current-versus-planned model, code pointers, source checks, and
acceptance matrix are in [SECURITY-ARCHITECTURE.md](../SECURITY-ARCHITECTURE.md).

## Alternatives

- Keeping local runtime/Ollama mandatory contradicts the mobile online goal.
- Calling disk/envelope encryption E2EE obscures server access. One vault for
  operational tokens and zero-knowledge passwords hides incompatible trust
  boundaries; retain separate contracts.
- Prompt-only permission or reusable blanket approval permits target changes,
  replay, and untrusted-content escalation; require deterministic authorization.
- Generic consumer subscription cancellation through developer purchase APIs
  assumes rights not granted by that API. Use official permitted actions or
  explicit user handoff.
- Assuming consumer notebook access grants audio automation overlooks Enterprise
  prerequisites and deprecated API availability; verify the authorized adapter.

## Consequences and verification

The first online beta may ship a tested subset with explicit gaps while native
actions, private E2EE, and audio remain unchecked. No account was cancelled.
Deployment, auth/owner/CSRF, key tamper/redaction/rotation, quotas, action
expiry/replay/cancel/revoke, native permissions, actual audio, and private-vault
key/recovery tests must establish each advertised capability. Historical local
successes and fixture tests do not establish these live guarantees.

Official Google boundaries were checked on October 12, 2026: the
[Play developer access requirements](https://developers.google.com/android-publisher/getting_started)
and [package/purchase-token cancellation API](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/cancel)
are not a generic consumer YouTube Premium API. The
[Enterprise audio overview API](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview)
is Preview; the [standalone Podcast API](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/podcast-api)
is deprecated and not accepting new allowlisting. Full prerequisites and manual
fallback sources are linked in the security architecture rather than treated
as existing Tatu integrations.
