# Deployment and operations

The standard path is an authenticated online app/Worker with owner-scoped D1,
remote AI and an online-only Portuguese PWA. End users need no PC left running,
Node.js, Ollama or local model. Installation addresses/IDs, runtime credentials
and exact operational release records are private and never shipped in source.

## Current verified state

Private version 2 is published: three migrations/15 D1 tables, bounded Colab
adapter, preserved owner-only audience and no automations. Two phases of 22
negative gateway probes pass; native task listing returns an empty result.
On October 14 the owner reported Qwen loading, pairing and real Tatu replies on
version 2. This is owner-observed use, not a controlled current-revision probe,
guardrail-quality test or independent full browser CRUD proof. Stop/active,
mobile/PWA and scheduled-delivery acceptance remain open.

Recorded version 2 code proof is 205 tests/build/format/lint/types, zero known
production vulnerabilities and no blocking static finding. October 13 public-source
checks passed lint/types/210 tests/build and companion13/original notebook8;
that backend artifact was identical to the verified private version. Historical public
[47bfc1e](https://github.com/tatu-project/tatu/commit/47bfc1e7de4e44a4bf9b074618df0d921db48b1b)/
[CI38500459769](https://github.com/tatu-project/tatu/actions/runs/38500459769)
passed Windows/Linux. The October 14 connection/status/public-probe/history
candidate passed root format/lint/types/226 tests/build after the manual-tab fix.
Final browser, private/public publication and remote CI evidence are pending;
the candidate is not the same artifact as historical version 2. No old
deployment record or owner report satisfies the new controlled live test.

The October 12 baseline and October 13 version 2 are historical release records,
not a public install address or invitation. Exact identifiers/hash/configuration
are retained privately by the operator. Forward-source sanitation does not
rewrite earlier Git history.

## Generic public configuration

`apps/cloud` is canonical. Public metadata is
`apps/cloud/.openai/hosting.template.json`; it contains no real project identity.
Normal build/CI is identity-neutral. Managed export requires a valid explicit
per-process `SITE_PROJECT_ID`, failing before build if missing/invalid. It
preserves checkout identity, canonical paths, symlink/preflight and archive guards.
Generated private hosting metadata/artifacts belong in ignored output, not Git.

Maintainers use Node.js `>=24.11.0 <25` and npm `>=11.6.0 <12`:

```sh
npm ci
npm run ci
npm run build:cloud
```

For managed export, privately supply the intended project identity to that
process using the hosting workflow, then run `npm run export:site`. Do not insert
actual values in commands saved to shared logs/docs, committed `.env` files or
screenshots. Review the prepared artifact and target before publication. Ordinary
build success is not permission to deploy to a personal or production account.

## Private Sites lane

Use an eligible hosting account and owner-only access. Apply the three immutable
migrations under `apps/cloud/migrations`; the current schema includes workspace,
provider and Colab tables. Configure values/secrets through the runtime control
plane:

| Configuration                              | Purpose                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `AUTH_MODE=sites`, `SITES_OWNER_PRIVATE=1` | Managed private identity boundary                                                          |
| `SITE_PROJECT_ID`, `SITE_ORIGIN`           | Actual per-installation identity/exact HTTPS origin; kept private                          |
| `DB`                                       | D1 with all migrations applied                                                             |
| `TATU_ENCRYPTION_KEY`, `_ID`               | Runtime operational envelope key/version; never commit actual values                       |
| Optional previous envelope key/ID          | Bounded two-key rotation; preserve old decryptability/backups                              |
| `AI`                                       | Optional authorized Workers AI binding; do not assume it exists                            |
| Optional Groq runtime/owner key            | Legitimate official API route, entered privately over HTTPS                                |
| `TATU_COLAB_SITES_SERVICE_TOKEN`           | Optional server-only gateway access for encrypted personal pairing                         |
| `SYSTEM_RUN_TOKEN`                         | Independent operator secret for HTTP system dispatch; gateway access alone is insufficient |
| `SCHEDULER_ENABLED=false`                  | Keep disabled until native scheduling bridge/due occurrence is verified                    |

A Colab service token must differ from system/vault/provider credentials; missing
or colliding configuration fails closed. Only encrypted bootstrap ciphertext is
shown in the owner UI; notebook-private RSA decrypts in VM memory. Gateway access
does not create owner identity or authorize ordinary APIs. Runtime key values
and private installation metadata must never appear in source/client code/chat/
logs/outputs. Removing a provider key from Tatu is not provider-side revocation.

The HTTP `/api/system/run-due` dispatcher requires independent `SYSTEM_RUN_TOKEN`
in every mode. Without it, dispatch is disabled. Native automations currently
have no verified code-dispatch bridge; a prompt-based cloud task is not proof of
that integration. Keep managed scheduling off. Portable native Cron is a separate
entry point with its own deployment/allowance/live acceptance.

## Pair personal Colab

[COLAB-CONNECTION.md](COLAB-CONNECTION.md) describes the owner flow. Verify/load
Qwen3-8B in the current Google VM, obtain the installation origin/project ID
privately from its operator, and enter them in hidden notebook prompts. No
actual installation values are provided by this repository or derived from a
received envelope. The connector checks exact configuration binding before HTTP.

Generate the ephemeral public key, pair via the authenticated Tatu form and
notebook hidden input within two minutes. Review exact context in Tatu and use
`PROCESSAR` in manual mode. Optional active mode needs eligible paid entitlement
with positive Colab units, explicit owner selection and consent; observed
eligibility is not a permanent balance or GPU guarantee. A paid consumer AI
subscription alone does not establish Colab compute units.

The connector reuses the loaded model; it opens no listener/tunnel/proxy,
installs no PC model and provides no unattended scheduler. Selected text is
plaintext in the Google VM, not E2EE against that executor. Private prompts,
responses, origins/IDs and credentials stay out of saved notebook outputs.

Use **Desconectar** in Tatu for server revocation; stopping the cell alone is
not revocation. Expiry denies access/late completion immediately, while physical
payload/hash cleanup needs later configured access/revoke/delete/retention.
Disabled configuration has no guaranteed timed database erase. Python reference
cleanup is not guaranteed physical memory zeroization.

## October 13 private Colab publication evidence

Public proof records technical outcomes only:

- Private version 2, same verified backend artifact, three immutable migrations
  and 15 tables; owner-only access and zero automations preserved.
- Before the new service secret: 18 ordinary/discovery/MCP probes and two system
  probes returned 401; two unconfigured runtime probes returned 503.
- After server-only configuration/same-version deployment: all 22 invalid or
  insufficient-credential probes returned 401. No owner data/job/inference/due
  execution was created by those probes. Native task listing remained positive.
- Packaging was corrected with process-only environment settings, preserving
  export/checkout/archive guards; no persistent system or skill mutation.
- Local tests/security review passed. Actual Google pairing/first Tatu answer
  and live active behavior remain open; the earlier manual answer is separate.

### October 12 private publication evidence

Historical native list/proposal and negative-access evidence remains
in [session history](../brain/07-Session-Log.md). Proposals created no confirmed
task. Neither an empty-queue probe nor private publication proves unattended work.

## Independent Workers/D1/Access lane

This portable configuration is not yet live-verified. It requires your own
eligible account, D1 allowance, HTTPS hostname/Access policy and authorized
model route. Do not change unrelated production resources or infer zero billing
from account ownership. Managed installation IDs/credentials are not portable.

From your authorized checkout/account, maintainers configure
`apps/cloud/wrangler.jsonc`: their D1 ID, controlled route, Access team/audience,
exact origin, migrations and secrets. Authorization maps verified issuer/subject
to internal owners; migration requires reauthentication/explicit remap.

```sh
cd apps/cloud
npx --no-install wrangler login
npx --no-install wrangler d1 create tatu --config wrangler.jsonc
npx --no-install wrangler d1 migrations apply tatu --remote --config wrangler.jsonc
npx --no-install wrangler secret put TATU_ENCRYPTION_KEY --config wrangler.jsonc
npx --no-install wrangler deploy --config wrangler.jsonc
```

Commands create resources/deploy only in the operator's explicitly intended
account. Secret operations can create a version; review target/account first.
Set `AUTH_MODE=cloudflare-access`, Access validation parameters and exact origin.
Use Workers AI only if entitled/bound; otherwise authorized Groq or an honest
unavailable state. No automatic paid fallback. Enable portable Cron only after
review; configuration alone does not prove an actual due run. The current
Colab pairing adapter targets private managed Sites, not a proven portable lane.

Official references: [D1 setup](https://developers.cloudflare.com/d1/get-started/),
[migrations](https://developers.cloudflare.com/d1/reference/migrations/),
[secrets](https://developers.cloudflare.com/workers/configuration/secrets/),
[Access validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

## Verify, retain and operate

Follow [RELIABILITY-TRIAL.md](RELIABILITY-TRIAL.md): actual owner browser/mobile
flows, auth/cross-owner/CSRF/credential/quotas, live inference, MCP and a real due
occurrence or an explicit scheduler gap. No 30-day waiting gate remains.

Curated AI feeds produce 1–10 cited stories, distinguishing RSS excerpts from
inference. In-app results and reviewed text export support manual NotebookLM
Audio Overviews; automatic audio/native/account actions remain later work.
Request/context/output/concurrency/shared budgets are bounded and external
allowances unknown. No free-unlimited or continuous-availability claim follows.
Terminal execution/job retention is bounded; pending/running behavior is handled
separately. Backups remain private and need applicable envelope keys.

Operational keys are server-decryptable, assistant text is application-plaintext,
and selected context leaves for providers. Deleting Tatu does not delete provider
copies. A client-held password vault is future work. See
[SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md).

## Optional legacy Node/SQLite

`npm run dev` uses a loopback Node API/local SQLite/outbox; it is not the online
mobile backend. Never expose its unauthenticated API publicly. Its local session
projection is not remote identity/logout, and no full local-PWA acceptance is
claimed. Historical Docker build/startup proof retains its date; reverify
current container behavior on a Docker-enabled machine. No local model is a
requirement of the standard online product.
