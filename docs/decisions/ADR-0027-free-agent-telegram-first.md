# ADR-0027: Free no-training agent, Telegram-first

Status: accepted as product direction, October 15, 2026. Nothing in this record
is implemented yet; each consequence below is an unchecked roadmap item until
its own verification passes.

## Context

The user restated the goal: a simpler, good, free, MIT-licensed personal
assistant that combines the useful parts of Grok Bot, Meta Muse and OpenAI
Dots, is easy to configure, and stays on without paid infrastructure ("free
isn't a plan, free is the architecture").

Public references (checked October 15, 2026; product details may change):

- [Grok Bot](https://x.ai/news/introducing-grok-bot) /
  [docs](https://docs.x.ai/grok-bot/overview): persistent named bots with
  their own memory, files and a cloud computer; voice/text/photos; connectors
  and MCP; workflows saved as scheduled routines; approval before irreversible
  actions (send, post, buy, delete). Paid plans only.
- Meta Muse ([TechRepublic](https://www.techrepublic.com/article/news-meta-muse-ai-agent-us-launch/)):
  goal -> plan -> act agent in an app and WhatsApp, with a separate guard agent,
  approvals and an audit trail.
- OpenAI Dots ([TechCrunch](https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/)):
  always-on background agents reachable by text or voice, with many app
  connectors. Paid plans only.

The current Tatu setup (Sites, D1, Access, `SYSTEM_RUN_TOKEN`, Colab PEM
pairing) is too hard for a nontechnical person, and no free hosted inference or
scheduled run is verified yet.

The user rejected free routes that train on user data.

## Decision

1. **Telegram is the first user surface.** One Telegram bot per installation,
   receiving updates by webhook on the Worker. The web app/PWA remains a
   secondary surface for settings and long results. No app-store package is
   needed for the first release. The bot answers only allowlisted Telegram user
   IDs (the owner by default); everyone else is ignored.
2. **Free always-on runtime is the architecture.** The standard install runs on
   a free serverless plan (currently Cloudflare Workers + Cron Triggers + D1)
   with no server, PC or paid add-on. Known free-plan bounds — about 10 ms CPU
   per invocation, 5 Cron Triggers per account, 100k requests/day, 50
   subrequests per request and D1 daily row limits enforced since September 1,
   2026 ([limits](https://developers.cloudflare.com/workers/platform/limits),
   [D1 change](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/))
   — are design constraints: one Cron dispatcher, lean handlers, indexed
   queries, multi-step agent work split into persisted steps.
3. **No training on user data is a hard eligibility gate.** A model/provider
   route is eligible by default only when its current terms state that API
   inputs/outputs are not used for training, recorded with a source URL and
   check date. Free routes that train, or whose policy is unknown, are
   excluded. A user may still attach any route with their own key (BYOK), and
   the UI shows that route's recorded policy.
4. **Free Resource Radar.** Tatu keeps a versioned registry of free models,
   compute and tool APIs with: provider, model, free limits, training policy,
   retention, region, terms URL, last-checked date and status. A scheduled
   searcher looks for new free offers and policy changes, but web content is
   untrusted: it may only propose registry changes. A route becomes eligible
   only through a reviewed registry change (maintainer PR upstream; owner
   confirmation for a local override).
5. **BYOK and in-chat model selection.** The owner can add any OpenAI-compatible
   endpoint or supported provider key (encrypted at rest, as today) and switch
   the active model from the chat (`/modelo` in Telegram, a selector on the
   web). Automatic routing only falls back among eligible free routes and the
   owner's own keys; never to a paid route the owner did not add.
6. **Agent with tools, approvals for consequences.** The assistant plans and
   uses tools: web search/RSS research, reminders and scheduled routines,
   memory and notes, and MCP connectors (Gmail/Calendar first, via official
   OAuth). Irreversible actions (send, post, buy, delete) require a one-tap
   Telegram approval bound to the exact action, expiring and single-use, as
   already required by ADR-0024. Every action is audited.
7. **Easy setup target.** Create a bot with @BotFather, click a one-click
   deploy, paste the bot token and optionally one key, done. Target: under five
   minutes without a terminal.
8. **Colab becomes an advanced option.** ADR-0025 remains valid but is no
   longer on the default setup path.

## Alternatives considered

- **Per-user cloud VM (Grok Bot style).** Gives full computer use, but has no
  sustainable free path. Deferred; a bounded browser tool may be added later as
  an optional adapter.
- **Native mobile apps first.** Store review, signing and two codebases before
  the core agent works. Deferred behind Telegram + PWA.
- **WhatsApp first.** The official Business API is paid/metered and requires
  business verification. Deferred.
- **Accept training-allowed free tiers (e.g. unpaid Gemini, Mistral Experiment,
  most OpenRouter `:free` endpoints).** Rejected by the user's privacy rule.

## Consequences

- Initial candidate routes need verification against official terms before
  enabling. Third-party reports as of October 2026: Groq does not retain
  inference data by default (abuse logs up to 30 days; zero-retention option);
  Cerebras does not train/retain but may no longer offer a permanent free tier;
  Cloudflare Workers AI gives 10,000 Neurons/day free
  ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/))
  but its training policy was not confirmed in this research; Mistral's free
  tier and unpaid Gemini train by default; OpenRouter free endpoints vary and
  data-policy filtering may need a paid plan; the OpenCode Zen DeepSeek free
  model's policy is unconfirmed (earlier Zen free models collected data) and its
  terms may restrict use outside coding agents. All of these stay pending until
  the radar records verified official terms.
- Free inference stays bounded. Quality will trail frontier paid agents; the
  differentiators are ownership, privacy, openness and cost.
- `PROJECT.md` section 2 gains the Telegram-first and no-training principles;
  `ROADMAP.md` gains stages 12–15. Existing stages and evidence are unchanged.
