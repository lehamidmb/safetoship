---
name: launch-review
description: Combine a deterministic SafeToShip launch packet with an available Codex Security review before deploy, publish, or go-live. Use when the user asks for a full pre-launch security review, a release decision, or evidence that both launch risks and semantic vulnerabilities were considered.
---

# SafeToShip Launch Review

Create a release decision from separate, auditable evidence streams. SafeToShip is the deterministic launch gate. The official Codex Security plugin, when installed and requested, is the semantic vulnerability reviewer. Never imply one substituted for the other.

## 1. Create Deterministic Evidence

Run from the target repository:

```bash
npx --yes safetoship@0.3.0 launch . --fail-on never
```

Read `.safetoship/latest/findings.json`, `coverage.json`, and `manifest.json`. Preserve the SafeToShip verdict exactly. State every skipped or errored external engine.

When a prior approved packet exists, save it outside `latest` and compare it:

```bash
npx --yes safetoship@0.3.0 launch . \
  --baseline .safetoship/baseline.json \
  --fail-on never
```

## 2. Add Semantic Security Evidence

Inspect the skills available in the current Codex environment.

- For a change or pull request, use `$codex-security:security-diff-scan` only when that official skill is available.
- For a full codebase review, use the exact official Codex Security codebase workflow exposed in the current environment. Do not guess a skill name.
- If Codex Security is absent, say `Semantic security review: NOT RUN (Codex Security plugin unavailable)`. Do not install a plugin or spend model credits without the user's approval.
- Keep official Codex Security findings separate from SafeToShip finding IDs and verdict math.
- Use `$codex-security:fix-finding` only when available and only after the user reviews the proposed security change.

## 3. Repair And Re-Audit

1. Address high-confidence SafeToShip blockers and validated semantic findings first.
2. Make the smallest safe changes and run relevant project tests.
3. Re-run `safetoship launch` with the prior `findings.json` as the baseline.
4. Report new, resolved, and unchanged SafeToShip fingerprints.
5. Revalidate semantic findings with the official workflow when available. Do not call a static rerun verification.

## 4. Final Decision

Report these independently:

- SafeToShip verdict
- SafeToShip coverage and skipped engines
- Codex Security status and unresolved validated findings
- accepted risks and their stated reasons
- manual legal, trademark, privacy, or deployment decisions still open

`SHIP` means only that SafeToShip's configured deterministic gate passed. It is not proof that the app is secure, legally compliant, or safe at runtime. Never commit, push, publish, merge, or deploy without explicit human approval at action time.
