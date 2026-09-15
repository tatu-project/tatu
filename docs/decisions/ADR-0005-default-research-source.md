# ADR-0005: Initial default research source

- Status: accepted
- Date: 2026-09-15

## Context

Stage 5 needs a zero-cost, credential-free source for the first useful daily AI briefing. The research adapter already accepts a replaceable list of public HTTPS RSS feeds and validates destinations, article links, size, cancellation, ranking, and deduplication. Leaving the list absent makes the worker fail safely, but does not provide an immediately useful clean-clone path.

## Decision

When `TATU_RSS_FEEDS` is absent, the worker uses:

`https://techcrunch.com/category/artificial-intelligence/feed/`

An explicit `TATU_RSS_FEEDS=` remains a supported safe-disable operation. Any non-empty value replaces the default with a comma-separated list of public HTTPS feeds. The source choice is isolated to the worker configuration; the research package remains source-agnostic.

## Consequences

- A clean local installation can run the daily AI briefing without credentials or a paid search service.
- The selected feed is an operational starting point, not a permanent provider commitment; users can replace or disable it through configuration.
- The source is external and has no availability or content-shape guarantee. RSS failures remain visible as `research_failed`, and the scheduler never fabricates a successful result.
- The default feed is validated by the same public-destination, bounded-read, citation, and deduplication controls as every configured feed.

## Alternatives considered

- Google News RSS: rejected as the initial default because it is an aggregator endpoint with tokenized links and no documented source-level SLA.
- MIT News topic RSS: rejected for the initial default because the live feed exceeded Tatu's bounded feed-read limit during verification.
- Multiple default feeds: deferred until reliability data shows that one source is insufficient; users can configure multiple feeds today.
