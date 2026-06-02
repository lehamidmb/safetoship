# Changelog

## 0.1.0

- Added the `safetoship audit`, `safetoship quick`, and `safetoship fix` CLI commands.
- Added local-first checks for exposed frontend secrets, Supabase `service_role` exposure, missing RLS, broad RLS policies, browser-only quota limits, paid endpoints without rate limits, missing privacy policies, missing Terms of Use, provider under-declaration, pre-consent analytics, missing security contacts, source maps, and Next.js security headers.
- Added optional Gitleaks, Semgrep CE, and OSV-Scanner wrappers that degrade gracefully when not installed.
- Added JSON, SARIF, Markdown, and terminal reports with plain-English findings and agent-ready fix prompts.
- Added deterministic safe fixes for source maps and starter privacy, terms, security, and hardening-plan documents.
- Added a GitHub Action entrypoint and an intentionally insecure demo fixture.
