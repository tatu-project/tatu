# Development setup

## What is required now

- Git.
- Visual Studio Code.
- Codex extension for VS Code.
- A GitHub account with access to the repository.
- Node.js only after Stage 2 confirms the supported version.

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

## Why Node.js

The current technical recommendation is a TypeScript application. Node.js runs the development tools, web/backend code, package manager scripts, tests, and builds. The exact supported Node.js version will be pinned during Stage 2 instead of relying on whichever version happens to be installed.

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

> Continue o Tatu e conclua a Etapa 2.

The user does not need to type Git commands during normal work. GitHub authentication, Codex execution approval, an ambiguous conflict, or a security-sensitive situation may still require user interaction. Those stops are intentional safety boundaries.

## Shared workstation configuration

Repository-safe VS Code settings may be committed under `.vscode/`. The `.gitignore` allows `settings.json`, `extensions.json`, `tasks.json`, and `launch.json` while continuing to ignore personal or machine-specific VS Code state.

This keeps useful project behavior aligned without attempting to clone the entire workstation. Credentials, GitHub login, Codex login, personal VS Code preferences, absolute local paths, caches, and secrets must remain local.

When Stage 2 selects the stack, the repository will also pin the Node.js version, package manager, lockfile, formatter, lint rules, TypeScript settings, and repeatable setup commands. Those files—not Docker alone—will make both development environments equivalent.

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

The next Codex task is Stage 2, beginning with ADR-0001 and environment detection. Do not scaffold the application before that decision is recorded.
