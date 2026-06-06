# Changelog

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
