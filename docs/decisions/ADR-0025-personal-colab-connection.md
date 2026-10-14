# ADR-0025: Personal Colab connection

Status: accepted, implemented and statically reviewed, October 13, 2026. Final
post-collision root CI (205 tests), current public-source companion13/original notebook8,
client checks and review pass; production audit has zero known vulnerabilities.
Private version 2 publication/gateway probes pass with 15 applied D1 tables;
real owner pairing/first Tatu chat, active behavior and new GitHub/remote CI remain
pending. Exact records are in [deployment evidence](../DEPLOYMENT.md#october-13-private-colab-publication-evidence).
Eligible paid entitlement/positive Colab units were observed; active mode is their optional checkbox choice,
not a permanent balance/availability guarantee. Model loading in the current runtime is
unconfirmed; the prior manual answer remains historical. Gemini Pro alone would
not establish Colab units.

## Context

The user authorizes an optional connection between their private Tatu and their
already-loaded Qwen in Colab, cancelling the OpenRouter pivot. One manually
reported short 8B answer exists; it is not evidence of Tatu integration.
Standard Tatu remains free-first, with no end-user PC/Ollama requirement.
The owner's existing Cloudflare production rules/resources must not change;
the private Site audience remains owner-only.

The [Colab FAQ](https://research.google.com/colaboratory/faq.html) prioritizes
interactive notebook use, disallows unrelated service offerings/proxies and
restricts free sessions without positive units from primarily using another
web UI. Paid plans with positive units remove those additional restrictions;
availability remains variable. The [v6 additional terms](https://research.google.com/colaboratory/tos_v6.html)
recognize connected services while requiring applicable rights and policies,
and prohibit giving third parties direct or indirect Colab access.

Our narrow interpretation permits the owner to run a notebook cell that
fetches, reviews, computes and returns their own inference request. It is not
Google endorsement or a guarantee against termination, and does not require an
invented separate Google approval gate. Both documents still govern use.

## Decision

Offer an optional personal compute adapter with two distinct modes:

- Manual one-shot: the owner reviews/consents to exact context in Tatu; each
  notebook Run fetches at most one job, requires `PROCESSAR` confirmation without
  displaying its private prompt/result, uses the existing loaded model and
  returns the result to the same owner's Tatu conversation.
- Active interactive polling: maximum 20 minutes, enabled only after the owner
  declares eligible paid Colab/Google AI entitlement granting Colab units with
  positive balance. Eligible paid entitlement/positive units were observed;
  the owner may select active mode without another eligibility question.
  Absent eligible balance, retain manual one-shot mode. It is never an unattended
  service or scheduler.

Neither mode opens a listener, tunnel, proxy or third-party service, uses
keepalive/UI bypass, or reloads a model onto the owner's PC. No account sharing,
R$0, fixed GPU, repeated performance, 24-hour or permanent-runtime promise follows.

### Pairing and platform boundary

1. The notebook generates ephemeral RSA keys, keeps its private key in VM memory
   and supplies only the public key to the authenticated owner UI.
2. The server seals a scoped bootstrap with AES-GCM and wraps its AES key with
   RSA-OAEP/SHA-256. The browser displays only ciphertext for notebook transfer.
   The platform bypass secret is configured server-side; neither it nor the
   one-use pair token appears plaintext in browser code, source, logs or output.
3. `/api/system/run-due` requires independent `SYSTEM_RUN_TOKEN` authorization
   in every mode, including private Sites. Platform bypass permits
   crossing the gateway; it does not establish user identity or ordinary API
   authorization. Missing configuration fails closed. Pairing rejects service
   tokens colliding with operator/current/previous vault/provider keys; route
   regression tests include sponsored and stored Groq credential collisions.
4. Only the ephemeral private key decrypts the bootstrap in the notebook VM.
   Consume pairing once; persist only hashes of scoped inner pair/session
   credentials. Sessions are bound to one owner, expire within 20 minutes and
   can be revoked. They authorize inference claim/complete only, not normal
   tasks, notes, memories, account settings or arbitrary user APIs.

Use server Web Crypto without new backend dependencies. The notebook preserves
compatible installed `cryptography` (42.0.2 or later), otherwise installs the
official 50.0.2 inside Colab only; no PC install or real runtime execution is
implied by static dependency checks.

### Job, privacy and stop behavior

Persist asynchronous jobs for an owner conversation with cancellation/revision
checks, fenced short leases, short TTLs and bounded prompt/output/quotas. A
stale, replayed or duplicate completion must not append an answer after cancel,
delete, revision change or lease replacement. No automatic paid fallback runs.

Obtain the owner's review/consent to exact selected context in Tatu before
generation and `PROCESSAR` confirmation in manual notebook mode. The prompt is
plaintext in the Google VM but not printed into notebook outputs. Exclude operational credentials and
private-vault content; this compute path is not E2EE. Inner credentials and the
ephemeral private key stay in notebook memory, never notebook outputs/files.
Revocation/expiry stops claims and completions; runtime loss, stopped notebook,
or unavailable model produces honest disconnected/stopped state, not fabricated
answers or a continuous-availability indicator.

## Alternatives and consequences

- Keep manual copy/paste as an available experiment; it does not connect Tatu.
- Continue official provider adapters for independently authorized hosting; the
  company Cloudflare account remains protected and OpenRouter is cancelled.
- Reject a public Colab API/tunnel, background polling, shared compute, or
  credential pasted in browser/chat/source; these defeat the accepted boundaries.

The owner supplies optional compute and may incur their own entitlement costs.
This adapter cannot satisfy unattended daily delivery or the standard free-hosted
route. Code/tests must prove isolation, replay/expiry/revoke, encrypted bootstrap,
independent system authority, quotas, cancellation/fencing and secret redaction.
Private deployment/gateway probes pass, while actual same-owner pairing and
first Tatu chat still require separate live proof; the prior manual answer and
fixtures do not complete those gates.

Implementation bounds: pairing/job TTL 120 seconds, claim lease 90 seconds,
session at most 20 minutes, one queued/running job per session; 4,096 context
bytes/1,024 input tokens and 256 output tokens/4,096 output bytes. Quotas and
bounded terminal retention apply. Completion/failure/cancel/revoke clear job
payloads according to those paths. Expiry immediately denies access and late
completion, but payload/hash physical cleanup depends on later configured
scoped access, revoke/delete and retention, not independent background TTL.
Removed/disabled configuration provides no guaranteed timed database erase.
Notebook cleanup clears references without guaranteed physical Python memory
erasure. Conversation history retains its existing rules.
