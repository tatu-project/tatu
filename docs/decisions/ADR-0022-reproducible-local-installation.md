# ADR-0022: Reproducible local installation

- Status: accepted
- Date: 2026-10-03

## Context

On Windows with Node.js 24.13.0 and npm 11.6.2, ordinary `npm ci` attempted
`node-gyp rebuild` for the locked `better-sqlite3` 13.0.3 package and failed
because Visual Studio C++ tools were absent. The package already includes
native binaries, declares `gypfile: false`, and its Windows binary worked
after `npm ci --ignore-scripts`. All 112 baseline tests passed under that
installation. Adding a compiler toolchain is unnecessary for this platform.

The same checkout had `core.autocrlf=true`, converting tracked LF files to
CRLF and making the repository's Prettier check fail across 104 files.

## Decision

- Set repository npm configuration to `ignore-scripts=true` for the current
  reviewed lockfile. Explicit `npm run` commands remain the build/test path.
- Use the SQLite binaries bundled with the existing approved dependency;
  do not add or replace a runtime dependency to work around this installation.
- Require a separate review before introducing a dependency that needs
  lifecycle scripts, native compilation, or a new binary distribution path.
- Keep tracked text at LF through `.gitattributes`, regardless of personal
  Git newline settings. Preserve binary files and existing user changes.
- Run the same quality checks on Windows and Linux in CI.

## Alternatives

Installing Visual Studio C++ tools would add a large prerequisite to a
beginner's setup. Upgrading global npm would alter the user's toolchain and
leave older allowed versions unsupported. Replacing the SQLite adapter is
a larger change without evidence that its runtime is broken. Accepting any
newline style would weaken the shared formatting contract.

## Consequences

An ordinary installation should use the existing packaged binary on a
supported platform. An unsupported binary/platform must fail visibly;
disabling scripts is not a promise of universal native compatibility.
This policy affects dependency lifecycle hooks across the repository and
must be reconsidered when the lockfile changes. No existing Dockerfile
build-tool setup or runtime image is changed by this decision.

Verification is recorded in `ROADMAP.md`, including the platforms actually
tested. A CI matrix configuration alone does not prove either remote job ran.
