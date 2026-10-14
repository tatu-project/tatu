# ADR-0026: Public source and private installation configuration

Status: accepted, October 13, 2026; user-requested forward-source privacy cleanup.

Public source ships a generic hosting template, not actual installation URLs,
project/deployment/account identities or credentials. Normal build/CI remains
identity-neutral. Managed export requires valid explicit per-process
`SITE_PROJECT_ID`, failing before build if absent/invalid while preserving the
existing checkout/realpath/archive identity guards.

The Colab companion receives origin/project identity through hidden VM inputs;
sealed metadata and plaintext must match that configuration before HTTP. Do not
infer trusted installation identity from an incoming envelope. Operator settings,
runtime secrets and exact operational evidence remain outside Git; no actual
values enter examples, saved notebook outputs or public screenshots.

This separates portable code from personal deployment instead of maintaining
owner-specific public defaults. It changes no private audience or backend scope,
adds no production dependency, and does not rewrite prior Git history. See
[DEPLOYMENT.md](../DEPLOYMENT.md) and [ADR-0025](ADR-0025-personal-colab-connection.md).
