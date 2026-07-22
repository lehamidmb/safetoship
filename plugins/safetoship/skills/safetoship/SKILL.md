---
name: safetoship
description: Audit and harden an app before launch, deploy, publish, or go-live. Use for Next.js, Supabase, paid API, privacy, terms, secret exposure, cost abuse, and launch-readiness requests.
---

# SafeToShip For Codex

Use SafeToShip as the deterministic pre-launch evidence layer. Codex operates the workflow; the human owns the launch decision.

## When To Run

Run this workflow when the user asks whether an app is ready to ship, says launch/deploy/publish/go-live, or adds Supabase, authentication, payments, analytics, email/SMS, or a paid AI provider.

## Audit

From the target repository, run the pinned release:

```bash
npx --yes safetoship@0.2.0 audit . --json
```

Use `--no-engines` only when optional Gitleaks, Semgrep, or OSV-Scanner availability is the reason the command cannot complete. Never describe skipped engines as passing checks.

Read `schemaVersion`, `verdict`, `findings`, `acceptedRisks`, `engines`, and `limits`. Do not invent findings that are absent from the JSON.

## Repair

1. Explain the verdict and group findings by root cause.
2. Handle high-confidence blockers first.
3. Make the smallest safe code change that addresses the evidence and fix prompt.
4. Show the diff before any consequential action.
5. Do not silently suppress findings. A suppression requires the user's stated reason and remains visible as an accepted risk.
6. Treat legal findings as risk signals and repeat the not-legal-advice limitation.
7. A committed secret is not fixed by moving it. Tell the user to rotate it with the provider and avoid printing the value.

For deterministic starter hardening, inspect the plan before applying it:

```bash
npx --yes safetoship@0.2.0 fix .
```

Use `fix --apply-safe` only after the user approves the listed file changes.

## Re-Audit

After repairs and relevant project tests, run the audit again. Call this a re-audit, not verification. Report:

- original verdict and new verdict
- resolved finding fingerprints
- remaining findings
- new findings
- accepted risks
- engines that were skipped or errored

Never claim SafeToShip proves the app secure, legally compliant, or safe at runtime. Never commit, push, merge, publish, or deploy without the user's explicit approval at action time.
