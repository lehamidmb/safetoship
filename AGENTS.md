# Agent Instructions

ShipVerdict is a local-first OSS launch gate for AI-generated apps. Keep the product honest: prefer exact file/line evidence, plain-English risk explanations, and fix prompts a non-expert can paste into Claude Code, Codex, or Cursor.

Rules:

- Do not claim the tool proves an app is secure or legally compliant.
- Keep all core checks offline and API-key-free.
- Family 2 abuse/cost and Family 3 legal/compliance rules are the differentiation; preserve their clarity.
- Every legal/compliance report must include the not-legal-advice banner.
- Add tests for every new heuristic and a fixture when the behavior is user-visible.
- Do not publish the repo or package until Hamid explicitly approves.
