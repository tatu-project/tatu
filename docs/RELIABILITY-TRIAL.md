# Reproducible online release checks

The October 12, 2026 direction is a mobile-first online assistant without an
end-user PC, Ollama, local runtime, or model download. The 30-day pilot remains
removed. October 12–18 in `America/Sao_Paulo` is a target, not verified delivery.
[`PROJECT.md`, section 25](../PROJECT.md#25-mvp-the-first-useful-vertical-slice)
defines scope; [`ROADMAP.md`](../ROADMAP.md) owns completion status.

The first deployment lane is a private Sites managed auth/D1/MCP beta. Portable
Cloudflare Workers/D1/Access configuration is a second lane and requires its
own deployed verification. Historical Node/SQLite/RSS/Ollama evidence below is
optional legacy/self-hosted evidence, not proof of the mobile backend.

## Preparation

1. Record the candidate revision, deployed HTTPS URL, hosting lane, authorized
   test accounts, available bindings/credentials, and exact maintainer commands.
2. Use dedicated non-sensitive test records/accounts; preserve existing user
   data and credentials. Run developer installation and `npm run ci` and record
   the actual passing checks rather than reusing historical counts.
3. Verify server authentication and map the verified identity issuer/subject to
   an internal owner ID. Deployment/identity migration requires reauthentication
   and explicit remapping, never copying raw Site user IDs across Sites.
4. Inspect actual remote AI, storage, and scheduler capabilities. Use a real
   authorized inference binding/key only when available; label fixtures and
   missing capabilities rather than inventing live success.
5. For scheduled proof, let online Cron reach a confirmed task's due instant
   without manual triggering or the user's phone/PC running. If unsupported,
   leave that gate unchecked and disclose the gap before a limited beta release.

## Release checks

Every check requires dated revision/environment evidence. All new checks start
unchecked. No elapsed-day wait is required, and tests do not prove 24/7 uptime.

- [ ] **Authentication and owner isolation:** unauthenticated, forged-owner,
      and cross-owner reads/mutations fail before private access. A verified
      issuer/subject maps to an internal owner; deletion and tools use that
      owner. Migration requires reauthentication and explicit remapping.
- [ ] **CSRF and rendering:** invalid origins/cross-site mutations are rejected;
      cookie/token behavior is tested for the actual hosted lane. Untrusted
      content renders safely and cited links are validated. Local Host checks
      alone do not authenticate a remote user.
- [ ] **Encrypted keys and privacy:** optional Groq API keys persist encrypted
      and owner-scoped, with metadata-only status. Logs, model inputs, errors,
      API/tool outputs, and another owner cannot retrieve key material. Publish
      the actual owner-data retention/deletion and remote-provider data flow.
- [ ] **Quotas and authorized remote AI:** global/per-user caps stop requests at
      limits and remain enforceable under concurrent calls. Available Workers
      AI bindings use a compatible capped sponsored route; Groq uses an
      authorized optional official API key. No paid fallback, pooled accounts,
      consumer-session scraping, or quota bypass is permitted.
- [ ] **Live inference or honest gap:** demonstrate actual remote inference only
      with authorized available bindings/credentials. Label fixture tests,
      missing routes, exhausted quota, timeouts, and provider failures. Manual
      ChatGPT/Grok/Gemini redirects are explicit user actions, not API access
      granted by consumer login. Unpaid Gemini is not default personal context.
- [ ] **Mobile personal-assistant flows:** a real deployed HTTPS URL passes phone
      browser chat/reopen/delete, preference/note create/edit/delete, task
      pause/edit/resume, and full cited-reader smoke under the authenticated
      owner. Context selection and unavailable-provider states are visible.
- [ ] **Hosted scheduling and delivery:** an actual remote scheduled occurrence
      produces a cited result/trace independently of the user's device. Repeated
      Cron/request keys, retries, provider/network outages, and recovery retain
      one intended delivery and owner scope. A manual run/fixture does not prove
      Cron; unsupported scheduling remains an explicitly unchecked capability.
- [ ] **PWA and offline behavior:** deployed mobile/desktop layouts are usable
      and installable shell assets are served. Internet failure explains the
      unavailable online service, disables mutations, and does not cache
      personal API responses or imply offline assistant execution.
- [ ] **Remote MCP and private package:** an authenticated real remote client
      initializes, lists implemented tools, and exercises bounded reads and
      permitted mutations. Malformed/unknown/cross-owner operations fail safely.
      Private package instructions match deployed tools. Live ChatGPT connection
      and public directory approval require separate account-supported proof.
- [ ] **Quality and publication:** formatting, lint, typecheck, relevant unit/
      integration/security/quota tests, build, remote CI, and deployed mobile
      smoke pass. First-lane verification does not mark portable second-lane
      deployment as live-tested. Release notes distinguish live capabilities,
      fixtures, missing bindings, and any limited-beta scheduler/inference gap.

## Evidence and completion

Record safe execution IDs, fixed events, command outcomes, URL reachability,
and result presence. Do not publish keys, credentials, raw provider payloads,
identity tokens, database rows, private conversations, notes, or personal full
briefings. A safe failure remains a failure, with its recovery recorded honestly.

Private publication requires reviewed evidence for the capabilities advertised;
missing inference or scheduling stays unchecked and is disclosed before any
limited beta. A deployed page or package alone proves neither inference nor
scheduled execution. Free hosting/AI/account eligibility, unlimited quotas,
parity with Grok/Muse/Dots, and continuous uptime are not guaranteed. Native
payments, computer/device control, marketplace, broad multi-agent workflows,
and an OAuth catalog remain later work. Optional legacy self-hosting retains
separate installation/container verification.

## Historical evidence retained

The September 16, 2026 start used a confirmed daily 08:00 task in
`America/Sao_Paulo`. Its manual preflight exhausted three research attempts and
produced no artifact because outbound HTTPS was unavailable. It was excluded
from the historical observation count.

| Date       | Execution status            | Public event types                                                  | Delivery artifact present | Restart/recovery note                                                                                             | Safe failure note                                                                                               |
| ---------- | --------------------------- | ------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 2026-09-17 | failed (`research_failure`) | `queued`, `claimed`, `research_failed`, `retry_scheduled`, `failed` | no                        | The local process had stopped; restart recovery created one occurrence for the missed 08:00 run and no duplicate. | Outbound HTTPS to the configured public feed was unavailable; the occurrence ended safely after three attempts. |

On October 3, 2026, a separate temporary installation passed ordinary Windows
dependency installation and the full 116-test quality suite. Its manual
preflight used the default public RSS feed, recovered the persisted task and
queue after API restart, delivered three distinct cited stories/facts in one
Markdown artifact, and recorded `queued`, `claimed`, `delivered`, `succeeded`.
Repeating the same manual request key did not create another execution.

The helper processes were stopped afterward. That manual preflight did not
verify a new scheduled occurrence or fill unobserved calendar days after
September 17. These dated records remain historical; neither is evidence that
the expanded October 12 release scope has passed.
