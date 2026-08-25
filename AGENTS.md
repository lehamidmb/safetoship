# Agent Instructions

SafeToShip is a local-first OSS launch hardening agent for AI-generated apps and an installable Codex plugin. Keep the product honest: prefer exact file/line evidence, plain-English risk explanations, safe autofixes where deterministic, and repair workflows Codex can execute under human review.

SafeToShip complements deep semantic security agents; it does not claim to replace Codex Security, Claude Security, SAST, or runtime testing. Keep their findings and SafeToShip verdict math separate.

Rules:

- Do not claim the tool proves an app is secure or legally compliant.
- Keep all core checks offline and API-key-free.
- Never send discovered credentials to a provider or third party to test whether they are live.
- Call a repeated static scan a re-audit, not verification.
- Codex may prepare repairs, but commit, push, publish, and deploy remain explicit human approval boundaries.
- Family 2 abuse/cost and Family 3 legal/compliance rules are the differentiation; preserve their clarity.
- Every legal/compliance report must include the not-legal-advice banner.
- Add tests for every new heuristic and a fixture when the behavior is user-visible.
- Run `npm run check`, the self-audit, plugin validation, and `npm pack --dry-run` before release.
- Keep launch packets portable: no absolute home paths, discovered secret values, or silent skipped checks.
