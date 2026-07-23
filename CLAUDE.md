# Claude Instructions

When contributing to SafeToShip, optimize for trustworthy launch hardening:

- Findings should be actionable, beginner-readable, and grounded in a path and line number whenever possible.
- Heuristic findings must declare confidence, known false-positive causes, and wording such as "appears" or "may".
- Never add a cloud dependency to the default scan path.
- Do not add legal conclusions. Add legal risk signals and recommend professional review.
- Keep the CLI fast enough to run before every launch and in pull requests.
- Treat the Codex plugin as the first complete adapter while keeping the CLI agent-neutral.
- Keep model-backed semantic security findings separate from SafeToShip's deterministic launch verdict and coverage packet.
