# Security Policy

## Project status

Tatu is in early development and is not ready to protect production secrets, financial data, customer data, or critical accounts.

## Reporting a vulnerability

Do not open a public issue for a vulnerability.

Until a dedicated security contact is published, use GitHub's private vulnerability reporting feature for this repository. Include:

- A concise description.
- Affected version, branch, or commit.
- Reproduction steps or proof of concept.
- Expected impact.
- Suggested mitigation, if known.

Do not access, modify, retain, or disclose data that does not belong to you. Stop testing when you have enough evidence to demonstrate the problem safely.

## Security principles

- No secrets in source control.
- Least-privilege access.
- Encrypted secret storage.
- Sensitive-value redaction.
- Deterministic permission enforcement outside LLM prompts.
- Explicit confirmation for external, financial, and critical actions.
- Input validation at every tool and integration boundary.
- Dependency, secret, and code scanning in CI as the project matures.

## Supported versions

No production release is currently supported. This section will be updated before the first public release.
