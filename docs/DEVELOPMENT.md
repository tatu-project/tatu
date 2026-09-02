# Development setup

## What is required now

- Git.
- Visual Studio Code.
- Codex extension for VS Code.
- A GitHub account with access to the repository.
- Node.js `>=24.11.0 <25` and npm `>=11.6.0 <12`.

Docker Desktop and GitHub CLI are useful but are not mandatory for adding the initial documentation files.

## Check the current computer

Run these commands in the VS Code terminal:

```bash
git --version
node --version
npm --version
docker --version
gh --version
```

`command not found` means that tool is not installed or not available in the terminal path.

## Local development

From a clean clone, install the committed dependency set and start the API with its standby worker:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` for the responsive Tatu Health page. Its machine-readable health contract is available at `http://localhost:3000/api/health`.

Run the complete local quality suite with:

```bash
npm run ci
```

[`ADR-0001`](decisions/ADR-0001-initial-stack.md) records the dependency-free Stage 2 foundation. [`ADR-0002`](decisions/ADR-0002-local-task-persistence.md) supersedes that narrow restriction for Stage 3 and approves `better-sqlite3` as the sole production runtime dependency.

## Why Docker Desktop

Docker will provide a reproducible reference runtime and eventually allow Tatu to start through containers on different computers and servers. It is not required for the documentation-only first commit, and installation may wait until the application boundaries are stable enough to create the reference Docker Compose setup.

## Why GitHub CLI

GitHub CLI (`gh`) is optional. Git alone can commit and push code, while the GitHub website can create pull requests. `gh` makes authentication, repository inspection, pull-request creation, and automated Codex workflows easier from the terminal.

Codex can execute Git and GitHub CLI commands when the tools are installed, authentication exists, permissions allow it, and the user authorizes repository-changing actions. Codex cannot bypass missing credentials or protected-branch rules.

## One-command Codex workflow

After the initial files are committed, the normal instruction for either founder is simply:

> Continue o Tatu.

The repository `AGENTS.md` instructs Codex to synchronize `main`, read the project state, continue the next eligible roadmap outcome, verify the work, commit, integrate newer remote commits, and push directly to `main`.

For a specific objective, say:

> Continue o Tatu com o próximo objetivo elegível.

The user does not need to type Git commands during normal work. GitHub authentication, Codex execution approval, an ambiguous conflict, or a security-sensitive situation may still require user interaction. Those stops are intentional safety boundaries.

## Orchestrator and custom agents

The primary Codex session acts as the orchestrator. Its model and reasoning effort are selected by the user for each session and are not pinned in repository configuration.

Meaningful implementation work follows this sequence:

1. The orchestrator synchronizes Git and reads `PROJECT.md`, `ROADMAP.md`, and `brain/04-Current-State.md`.
2. `recon` gathers read-only evidence.
3. The orchestrator turns that evidence into a bounded plan and acceptance criteria.
4. `executor` implements only that bounded plan and runs relevant checks without performing Git operations or authoritative status updates.
5. `reviewer` performs a strict read-only review of the final behavior, diff, verification, security, architecture, and roadmap accuracy.
6. The orchestrator resolves blocking findings, runs final checks, updates authoritative documentation and the brain, then commits and pushes verified work.

All prompts from the orchestrator to a sub-agent must be written in English. Each prompt must state the objective, scope, relevant paths and context, constraints, expected evidence or deliverable, acceptance criteria, and an explicit prohibition against Git publication. Only the orchestrator communicates with the user.

The custom roles use project-scoped files under `.codex/agents/`. Both founders receive the same definitions after synchronizing Git. The project configuration enables three simultaneous sub-agent threads but does not select the orchestrator model.

### Verify agents after restarting Codex

New custom-agent files may not load into a session that was already running when they were created. After pulling the configuration:

1. Close the current Codex chat or restart the Codex extension/session from the repository root.
2. Start a new project session.
3. Ask Codex to list or use the project agents `recon`, `executor`, and `reviewer`.
4. Confirm each role is discoverable before starting further development.
5. Record the evidence in `ROADMAP.md` and `brain/04-Current-State.md`.

The standard command remains:

> Continue o Tatu.

Repository-shared workflow files are `.codex/config.toml`, `.codex/agents/*.toml`, `AGENTS.md`, `PROJECT.md`, `ROADMAP.md`, `docs/`, `brain/`, and repository-safe `.vscode/` settings. User-level `~/.codex/config.toml`, credentials, personal settings, caches, logs, and session data stay local.

## Shared workstation configuration

Repository-safe VS Code settings may be committed under `.vscode/`. The `.gitignore` allows `settings.json`, `extensions.json`, `tasks.json`, and `launch.json` while continuing to ignore personal or machine-specific VS Code state.

This keeps useful project behavior aligned without attempting to clone the entire workstation. Credentials, GitHub login, Codex login, personal VS Code preferences, absolute local paths, caches, and secrets must remain local.

The repository pins the Node.js range, npm version, lockfile, formatter, lint rules, TypeScript settings, and repeatable setup commands. Those files—not Docker alone—make both development environments equivalent.

## First documentation commit

After copying the starter files into the repository root:

```bash
git switch main
git pull --ff-only
git status
git add AGENTS.md ROADMAP.md PROJECT.md README.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md LICENSE .gitignore .editorconfig docs
git commit -m "docs: establish Tatu project foundation"
git pull --rebase origin main
git push origin main
```

The two founding maintainers may use this direct-to-main workflow during early development. External contributors must use branches and pull requests. Founders should also use a branch when they are working simultaneously on overlapping areas or when a change is risky.

Before pushing, ask Codex:

```bash
> Read AGENTS.md, PROJECT.md and ROADMAP.md. Review the current changes, verify the documentation foundation, and report any blocking issue before committing or pushing.
```

## After the first push

Both partners update their local `main`:

```bash
git switch main
git pull --ff-only
```

Stage 3 is complete: the current setup includes local persisted briefing tasks. The next gated Codex task is Stage 4; do not begin it until explicitly directed.
