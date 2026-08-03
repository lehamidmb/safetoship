# Changelog

## Unreleased

- Fixed paid-endpoint rate-limit detection so TODO comments, quoted examples, and unused imports cannot hide an unprotected provider call.

## 0.2.0

- Added confidence-aware verdicts so direct evidence can block while heuristic blockers are labeled for review.
- Added reasoned inline suppressions and `.safetoshiprc.json` overrides with visible accepted-risk reporting.
- Added stable finding fingerprints, a versioned JSON schema, and `safetoship explain` for agent integrations.
- Added an installable Codex plugin and SafeToShip skill for audit, reviewed repair, and re-audit workflows.
- Replaced Semgrep registry auto-configuration with SafeToShip-authored Apache-2.0 local rules and disabled metrics.
- Redesigned Markdown and PR output around the verdict, top three fixes, and collapsible technical detail.
- Removed machine-specific home paths and discovered secret values from shareable report output.
- Added a one-command demo and expanded the test suite for the v0.2 trust contract.

## 0.1.2

- Replaced the abbreviated license text with the complete official Apache License 2.0.
- Refreshed the compatible TypeScript test toolchain and restored fast, deterministic local test runs.
- Updated vulnerable transitive development tooling so `npm audit` reports zero known vulnerabilities.

## 0.1.1

- Added high-signal CSRF checks for cookie/session-authenticated state-changing Next.js App Router and Pages Router API routes.
- Added permissive CORS detection for state-changing Next.js API routes.
- Added protected and vulnerable fixture coverage while preserving exact launch verdict contracts.
- Brought all four React fixture apps to React Doctor 100/100 and made their production builds deterministic.
- Moved paid-provider client construction into request handlers so fixture production builds do not require credentials during module evaluation.

## 0.1.0

- Added the `safetoship audit`, `safetoship quick`, and `safetoship fix` CLI commands.
- Added local-first checks for exposed frontend secrets, Supabase `service_role` exposure, missing RLS, broad RLS policies, browser-only quota limits, paid endpoints without rate limits, missing privacy policies, missing Terms of Use, provider under-declaration, pre-consent analytics, missing security contacts, source maps, and Next.js security headers.
- Added optional Gitleaks, Semgrep CE, and OSV-Scanner wrappers that degrade gracefully when not installed.
- Added JSON, SARIF, Markdown, and terminal reports with plain-English findings and agent-ready fix prompts.
- Added deterministic safe fixes for source maps and starter privacy, terms, security, and hardening-plan documents.
- Added a GitHub Action entrypoint and an intentionally insecure demo fixture.
