# Contributing to Tatu

Tatu is in early development. Contributions, design discussion, tests, documentation, and careful technical criticism are welcome.

## Before contributing

1. Read `PROJECT.md` and `ROADMAP.md`.
2. Read the applicable `AGENTS.md` instructions.
3. Check existing issues and pull requests to avoid duplicate work.
4. For a large change, discuss the proposal before implementing it.

## Workflow

1. Fork or create a branch from the current `main`.
2. Use a focused branch name such as `feat/scheduled-tasks` or `fix/job-deduplication`.
3. Keep changes limited to one coherent outcome.
4. Add or update tests and documentation.
5. Run every relevant verification command documented by the repository.
6. Review your diff for secrets and unrelated changes.
7. Open a pull request explaining the outcome, verification, risks, and roadmap effect.

## Commit messages

Prefer Conventional Commit-style prefixes:

- `feat:` new behavior
- `fix:` bug fix
- `docs:` documentation only
- `test:` tests
- `refactor:` internal change without intended behavior change
- `chore:` tooling or maintenance

## Pull requests

A pull request should include:

- What outcome changed.
- Why the change is needed.
- How it was verified.
- Screenshots for visible UI changes.
- Security, privacy, compatibility, or cost implications.
- Documentation or roadmap updates.

Do not mark a roadmap stage complete unless every acceptance criterion is proven.

## Secrets and personal data

Never commit API keys, tokens, passwords, private keys, cookies, OAuth credentials, personal databases, real customer data, or logs containing sensitive payloads. Use placeholders in `.env.example`.

## License

By contributing, you agree that your contribution is licensed under the project's MIT License.
