# Deployment and operations

The standard path is an authenticated online app/Worker with owner-scoped D1,
remote AI and an online-only Portuguese PWA. End users need no PC left running,
Node.js, Ollama or local model. Installation addresses/IDs, runtime credentials
and exact operational release records are private and never shipped in source.

## Current verified state

Private version 3 is published at the existing installation. Artifact/build
checks confirm three immutable migration files; native metadata confirms 15 D1
tables. The one-owner audience, no external/group
access or automations, and existing server secrets are preserved. There is no
new schema or enabled dispatcher. Native MCP task listing returns an empty result.
The two 22-case version 2 negative gateway phases remain historical evidence.
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
passed Windows/Linux. October 14 version 3 passed final root format/lint/types/
226 tests/build, companion13/original8 and nine private handoff checks. The Worker
is 225,716 bytes with three migrations and no native imports. Final code/privacy
review has no blocker. Actual-built desktop/mobile browser fixtures pass layout,
manual/active consent visibility, isolated test payload, expected/divergent reply,
expired-feedback and bounded-cancellation checks. Mocked APIs were used; these
are not Google inference or latency measurements.

Private deployment succeeded without changing the audience, existing two-secret
configuration or disabled scheduling. Sixteen live access/readiness checks pass:
bounded denial cases return 401/403 and public health returns 200. Direct Worker
origin and positive browser owner-login tests are two explicit gaps, not passing
cases. Public implementation [78f5c2b](https://github.com/tatu-project/tatu/commit/78f5c2bf2816e12879cf41fa5732e54c33290dd9)/
[CI38567151349](https://github.com/tatu-project/tatu/actions/runs/38567151349)
completed success on Windows/Ubuntu for that revision. Root created no Google
inference, owner response probe or scheduled execution. No older deployment or
owner report satisfies the new controlled live test.

The October 12 baseline and October 13 version 2 are historical release records,
not a public install address or invitation. Exact identifiers/hash/configuration
are retained privately by the operator. Forward-source sanitation does not
rewrite earlier Git history.

Next, refresh the app and re-pair only if the session expired; reuse a loaded
Google model, authorize the public probe and test a harmless turn with history
disabled. The documentation-only reconciliation needs no additional Site redeploy.

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

Use an eligible hosting account and owner-only access. Apply the four immutable
migrations under `apps/cloud/migrations`; the current schema includes workspace,
provider, Colab and Telegram/preference tables. Configure values/secrets through the runtime control
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

Always apply pending migrations before deploying a new Worker version; new
code may read tables that only a newer migration creates.

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
review; configuration alone does not prove an actual due run. The optional
Telegram bot (`TELEGRAM_*` secrets, Access bypass only for
`/api/telegram/webhook`) is described in [TELEGRAM.md](TELEGRAM.md). The current
Colab pairing adapter targets private managed Sites, not a proven portable lane.

### Automatic deployment from `main`

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) publishes the
Worker after the CI workflow succeeds for a push to `main`, deploying exactly
the commit CI verified. It applies pending D1 migrations, then deploys, then
checks `/api/health`. Repositories without `TATU_SITE_ORIGIN` skip the job, so
forks never try to deploy. Worker secrets (`TELEGRAM_*`, encryption keys) are
set once with `wrangler secret put` and survive deploys; they are not stored in
GitHub.

The job runs in the `production` environment. Create it under Settings →
Environments, restrict its deployment branches to `main`, and store the two
Cloudflare secrets there (not as repository secrets) so a workflow pushed to
another branch cannot read them. A commit that is no longer the tip of `main`
is skipped, so out-of-order CI completions never roll back production. Manual
**Run workflow** (`workflow_dispatch`) only deploys from `main` and does not
wait for CI. Keep D1 migrations additive: they run before the deploy and there
is no automatic rollback (`wrangler rollback` is manual). In
`cloudflare-access` mode the health smoke check is skipped unless you add an
Access bypass for `/api/health`.

Configure the `production` environment (secrets) and repository variables:

| Kind       | Name                     | Value                                                               |
| ---------- | ------------------------ | ------------------------------------------------------------------- |
| Env secret | `CLOUDFLARE_API_TOKEN`   | Account token: Workers Scripts Edit, D1 Edit, Account Settings Read |
| Env secret | `CLOUDFLARE_ACCOUNT_ID`  | The dedicated Tatu account ID                                       |
| Variable   | `TATU_D1_DATABASE_ID`    | UUID of the `tatu` D1 database                                      |
| Variable   | `TATU_SITE_ORIGIN`       | Public HTTPS origin, e.g. `https://tatu.<sub>.workers.dev`          |
| Variable   | `TATU_AUTH_MODE`         | Optional: `telegram-only` (default) or `cloudflare-access`          |
| Variable   | `TATU_SCHEDULER_ENABLED` | Optional: `false` (default); `true` also enables the Cron           |

`cloudflare-access` additionally needs `TATU_ACCESS_TEAM_DOMAIN` and
`TATU_ACCESS_AUDIENCE`. `node scripts/cloud-deploy-config.mjs` generates the
ignored `apps/cloud/wrangler.deploy.jsonc` from these values, so account IDs
stay out of Git (variable values such as the origin do appear in deploy logs;
they are not secrets). Use a dedicated Cloudflare account so the token cannot reach
unrelated production resources, and renew the token before it expires.

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
