# Tatu

A Brazilian, MIT-licensed personal assistant with an online backend and a
Portuguese mobile/desktop web app. Free-first, with replaceable providers and
optional independent hosting. [Leia em português](README.pt-BR.md).

**Current state:** private version 2 is published. On October 14 its owner
reported loaded Qwen, pairing and real replies inside Tatu; native MCP task
reads/proposals are independently verified. The connection monitor, isolated
response test and per-turn history controls are implemented in the next
revision, with final browser/publication evidence pending. Owner observations
do not complete browser/PWA, guardrail or unattended scheduling acceptance.
[ROADMAP.md](ROADMAP.md) tracks each kind of proof.

Private installation URLs, IDs, account details, credentials and operational
records are absent from public source. Obtain access/configuration privately
from the operator of your own installation.

## Use your installation

1. Open its private HTTPS address and sign in with an authorized account.
2. Use Chat, Tasks, notes, explicit preference memory and the cited reader.
   The installable PWA shell exists; mobile visuals/installation still need proof.
3. Choose an available authorized AI route. Optional Groq BYOK uses the HTTPS
   form, never chat. Workers AI needs a binding; personal Colab uses your Google
   VM and entitlement.

The standard online path needs no PC left running, Node.js, Ollama or local
model download. Colab loads its model in the Google VM. Missing routes, stopped
compute, limits and network failures are shown honestly; no fabricated answer
or automatic paid fallback substitutes.

For **Meu Qwen no Google Colab**, follow [the connection guide](docs/COLAB-CONNECTION.md).
Get your installation's origin/project ID privately, then enter them only in
hidden notebook prompts. Ephemeral-key pairing displays encrypted data in Tatu.
Review exact context in Tatu and confirm `PROCESSAR` for manual execution.
Active mode is optional, at most 20 minutes, and requires eligible paid
entitlement with positive Colab units. It is not a permanent free backend.

The updated settings panel separates a valid pairing from a received answer.
Its explicit public arithmetic test creates a separate conversation, consumes
one normal request and shares no prior history, notes or memories. Inspect the
actual reply, model and elapsed time; receiving text and confirming the expected
answer are separate results. In Chat, **Usar histórico desta conversa** controls
the next turn without deleting saved messages. The context counter counts only
selected notes/memories, so zero does not mean history is excluded.

## Implemented and remaining

| Capability                                                   | Evidence                                                 | Remaining acceptance                                     |
| ------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------- |
| Conversations, notes, memory, task controls and cited reader | SQL/API/client checks                                    | Positive authenticated browser CRUD/mobile smoke         |
| Workers AI/Groq and encrypted optional keys                  | Adapters, quotas and failures tested                     | Real configured provider turn/lifecycle                  |
| Personal Qwen/Colab                                          | Private v2 and owner-observed replies; crypto/job checks | Controlled current-revision probe and stop/active proof  |
| MCP                                                          | Native listing/proposal calls verified                   | Broader confirmation, standalone OAuth/public directory  |
| Daily AI briefing                                            | Curated RSS and durable execution code                   | Actual hosted due occurrence; managed bridge disabled    |
| NotebookLM Audio Overviews                                   | Cited-text export/manual import handoff                  | User-generated audio; automatic Enterprise adapter later |

The reference task is daily AI news at **09:00, America/Sao_Paulo**. Sources
remain cited; RSS excerpts are distinct from model inference. MCP preparation
creates an expiring proposal that still requires confirmation in Tatu.

Historical private version 2 proof includes 205 application tests, three
migrations/15 D1 tables and two phases of 22 negative gateway probes. October 13
public-source proof is 210 tests/build and Colab companion13/original notebook8;
its production audit found zero known vulnerabilities. The October 14 candidate
passes format/lint/types/226 tests/build after the manual-tab fix; browser and
publication checks are tracked separately. Neither fixtures nor owner-reported
replies prove full browser CRUD, guardrail quality or scheduled delivery. No
30-day waiting period is required.

## Privacy and limits

- Operational keys are server-decryptable AES-GCM, **not E2EE**. Assistant text
  is plaintext at the application layer; selected context reaches the chosen
  provider/Google VM. Deleting Tatu data does not erase provider copies.
- Colab credentials expire/revoke and cannot authorize normal workspace/system
  APIs. Expiry denies access immediately; physical cleanup requires later
  configured access/revoke/delete/retention, not timed erasure. Python reference
  cleanup does not guarantee physical memory zeroization.
- Input/output/request/shared budgets are bounded. External quotas, eligible
  accounts, free hosting, GPU and continuous uptime are not guaranteed.
- Native packages, device/account actions, client-held password vault and
  automatic audio remain separately verified future work; parity is not claimed.

See [security](docs/SECURITY-ARCHITECTURE.md), [deployment](docs/DEPLOYMENT.md)
and the complete [current-state PRD](docs/PRD.md).

## Develop or host independently

Use Node.js `>=24.11.0 <25` and npm `>=11.6.0 <12`:

```sh
npm ci
npm run ci
npm run build
```

These are maintainer commands. `apps/cloud` is the online backend. Public source
uses a generic hosting template; normal builds need no private identity. Managed
export requires an explicit valid per-process `SITE_PROJECT_ID` and fails closed
without it. Keep actual origins/IDs/secrets out of commits, screenshots and saved
notebook outputs. [DEPLOYMENT.md](docs/DEPLOYMENT.md) explains Sites and portable
Workers/D1/Access setup. Legacy Node/SQLite remains an optional developer/self-host
profile whose unauthenticated API stays on loopback.

[PROJECT.md](PROJECT.md) owns scope; [ROADMAP.md](ROADMAP.md) owns progress;
[AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) define workflows.
[Maintainer support](docs/OPEN_SOURCE_SUPPORT.md) does not provide end-user
inference or imply program approval/adoption.

MIT: [LICENSE](LICENSE). Providers/models/dependencies retain their own terms.
Vulnerabilities: [SECURITY.md](SECURITY.md).
