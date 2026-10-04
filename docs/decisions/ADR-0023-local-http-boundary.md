# ADR-0023: Local HTTP boundary

- Status: accepted
- Date: 2026-10-03

## Context

ADR-0004 chooses one individual local installation without remote account
authentication. The API previously supplied no listening host, and Compose
published its port on every host interface. Documentation asking owners to
keep the service local did not enforce those defaults. A loopback service
also needs browser request checks against unexpected origins and DNS rebinding.

## Decision

- Bind the native API to IPv4 loopback by default.
- Permit an explicit, validated container listening address while publishing
  the Compose host port only on IPv4 loopback. Loopback inside a container
  alone cannot serve its forwarded port.
- Before routing any request, validate the Host authority against literal
  loopback/localhost names and the actual listening port.
- Require a supplied Origin to match the request's local origin. Reject
  opaque, invalid, and cross-origin values, and hostile Fetch Metadata.
- Keep ordinary no-Origin CLI requests working and ignore forwarding headers.
- Return fixed errors without reflecting attacker-provided values.

The implementation remains dependency-free. The precise accepted configuration
and regression cases are defined by the API's local-access module and tests.

## Alternatives

Documentation alone leaves unsafe network defaults. Loopback binding alone
does not address browser access through an attacker-controlled hostname.
Prompt-based checks cannot protect HTTP routes. Adding a remote login system
would introduce accounts, sessions, and a larger deployment contract before
there is a supported remote product flow.

## Consequences

The default service is intended for its machine owner. These checks are not
authentication and do not protect against a malicious local process or a
deliberately exposed container/network configuration. Remote access, tunnels,
reverse proxies, OAuth connections, and shared hosting need an explicit
authentication/authorization design first.

Regression tests and process/HTTP smoke checks verify the native boundary.
Compose configuration validation is separate from building and running Docker
images; only performed checks may be recorded as evidence.
