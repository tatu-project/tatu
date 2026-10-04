# Guided zero-cost local deployment

This is the supported first deployment path for one person and one local/self-hosted installation. It uses the replaceable SQLite adapter and local filesystem outbox already shipped in Tatu. It does not require Supabase, Firebase, a VPS, a hosted database, provider credentials, or Docker.

## 1. Prerequisites

Install Git, Node.js `>=24.11.0 <25`, and npm `>=11.6.0 <12`. Docker Desktop and Ollama are optional. Keep the installation on a computer where the owner can protect the local database and keep the processes running.

## 2. Install and verify

From a clean clone, run:

```sh
git clone https://github.com/tatu-project/tatu.git
cd tatu
npm ci
npm run ci
```

The CI command is the local proof that formatting, linting, type checking, build, and tests pass before starting the service.

The repository's `.npmrc` disables dependency lifecycle scripts. The current
audited lockfile includes native SQLite prebuilds, so the supported Windows
installation does not require Python, Visual Studio Build Tools, or a C++
compiler. A missing or incompatible platform binary must fail visibly when
storage loads; do not override the policy to silently compile or run install
hooks. Future dependencies that require lifecycle scripts need a separate
review. `.gitattributes` keeps tracked text in LF format even with Windows Git
`core.autocrlf=true`.

## 3. Start the local service

Run the API and standby worker together:

```sh
npm run dev
```

Open `http://127.0.0.1:3000` (or `http://localhost:3000` if your browser connects
through IPv4). The API binds only IPv4 loopback by default. For explicit IPv6
loopback, set `TATU_BIND_HOST=::1` and open `http://[::1]:3000`. `PORT` must be an
integer from 1 to 65535. The page's Setup Health section should show the API and
task storage as ready, the deterministic RSS route as configured, memory as not
implemented, scheduler liveness as unknown, and cost as unknown. The
machine-readable checks are available at `/api/health` and `/api/setup-health`.

Use the Chat section to confirm the daily briefing task. The worker polls the same local SQLite file and writes completed briefings to `data/deliveries`. Leave the terminal running for scheduled execution.

For the creator's reliability observation, follow the 30-day checklist in
[`docs/RELIABILITY-TRIAL.md`](RELIABILITY-TRIAL.md). It records only public
execution events and delivery outcomes; it does not require copying keys or
raw provider payloads into notes.

To test a confirmed task without waiting for its scheduled time, call the
manual execution endpoint with a stable key:

```sh
curl -X POST http://localhost:3000/api/tasks/TASK_ID/test \
  -H 'Idempotency-Key: manual-check-1'
```

The response queues a separate execution for the standby worker. Repeating the
same task and key is idempotent; the request key is hashed and neither it nor
the internal occurrence key appears in the public response. The Tasks section
also provides a `Testar agora` button for the same local check.

## 4. Zero-cost defaults

With no additional environment variables, the worker uses the selected public TechCrunch Artificial Intelligence RSS feed and no credentials. This is a public external source, so an outage or unavailable network records a safe research failure rather than inventing a briefing.

To configure public feeds for one shell session, use a comma-separated list:

```powershell
$env:TATU_RSS_FEEDS = 'https://example.org/news.xml,https://example.net/feed.xml'
npm run dev
```

```sh
TATU_RSS_FEEDS=https://example.org/news.xml,https://example.net/feed.xml npm run dev
```

Set `TATU_RSS_FEEDS=` explicitly to disable research for a local test. Feed URLs must be public HTTPS URLs; do not put credentials or tokens in them.

## 5. Optional local model

The deterministic RSS route is the zero-cost default. If Ollama is already installed locally, set only the model name and keep the endpoint loopback-only:

```powershell
$env:TATU_OLLAMA_MODEL = 'llama3.2'
$env:TATU_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
npm run dev
```

```sh
TATU_OLLAMA_MODEL=llama3.2 TATU_OLLAMA_BASE_URL=http://127.0.0.1:11434 npm run dev
```

No API key is needed for this local route. A model failure falls back to the validated cited RSS result; it does not turn a paid provider into a zero-cost guarantee.

## 6. Local data and backups

The default data is local and ignored by Git:

- `data/tatu.sqlite` — tasks, executions, and event history;
- `data/deliveries/` — cited Markdown outbox artifacts.

Stop `npm run dev` before copying these files for a backup. Protect the backup with the same care as the computer that runs Tatu. `TATU_DATABASE_PATH` and `TATU_DELIVERY_DIR` can point to another local directory when needed.

## 7. Safety boundaries and limits

Keep the service on a trusted local machine and do not expose port 3000 publicly. Do not commit `.env` files, credentials, database files, or delivery artifacts. The first deployment is single-user/local; production database selection, remote/shared hosting, worker heartbeat, persistent memory, provider authentication, and monetary pricing remain undecided or unimplemented.

Before routing any request, the API requires a `Host` authority of
`127.0.0.1`, `localhost`, or `[::1]` with the actual listening port. Browser
requests with an `Origin` must match that exact authority over HTTP; loopback
aliases are different origins. Cross-site and same-site `Sec-Fetch-Site`
requests are rejected. Local CLI requests without these browser headers remain
supported. Forwarding headers cannot override these checks. A denied request
returns a fixed `403` error. These boundaries reduce browser cross-origin and
DNS-rebinding exposure; they do not authenticate local programs or users.

The Docker Compose files are an optional local packaging reference. The
September 16, 2026 roadmap record covers its previous image build/startup
acceptance. The October 3 update is validated with standalone Compose config;
image build/startup has not been repeated on this workstation because there
is no Docker engine. Recheck the updated runtime on a Docker-enabled machine.

Compose explicitly sets `TATU_BIND_HOST=0.0.0.0` inside the container and
publishes `127.0.0.1:3000:3000` on the host. The wildcard bind is only for that
container interface; it does not enable an authenticated remote deployment.
Keep this loopback mapping and do not put the API behind a public tunnel or
reverse proxy. The container image retains its separate native-build path;
the repository `.npmrc` policy applies to the ordinary Node/npm installation.

## 8. Troubleshooting

- Port 3000 is busy: stop the other process or set `PORT` to another local port.
- Browser receives `403`: use the documented loopback URL and port directly;
  browser extensions or proxies must not replace the Host/Origin headers.
- Setup Health reports research disabled: remove `TATU_RSS_FEEDS` or set it to a valid public HTTPS feed list.
- Setup Health reports scheduler unknown: this is expected until a worker heartbeat contract exists; keep the standby worker process running.
- No briefing is delivered: inspect the execution timeline and `data/deliveries`; research failures are recorded rather than hidden.
- After pulling updates: stop the service, run `npm ci` and `npm run ci`, then start `npm run dev` again.
