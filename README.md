# SafeToShip

Vibe code with peace of mind.

SafeToShip is a local pre-launch gate and Codex plugin for AI-built apps. Before you publish, it gives Codex deterministic evidence and gives you one plain-English verdict:

- `SHIP`
- `SHIP-WITH-WARNINGS`
- `DO-NOT-SHIP`

It looks for the mistakes AI coding tools and first-time builders often miss: private API keys in the frontend, Supabase RLS gaps, `service_role` exposure, browser-only usage limits, paid API routes with no rate limit, missing CSRF/origin checks, permissive CORS, missing privacy policies, missing Terms of Use, and other launch risks.

SafeToShip is not another wall of scanner output. Codex can run the audit, repair high-confidence blockers, and re-audit the result. You remain in control of commits, publishing, and deployment.

## Why This Exists

AI can build a working app fast. That does not mean the app is safe to launch.

A vibe-coded app can look finished while quietly shipping with:

- an OpenAI, Anthropic, Stripe, or email key exposed to the browser
- a Supabase `service_role` key that bypasses user permissions
- public database tables without Row Level Security
- a "5 free generations per day" limit stored in `localStorage`
- a paid AI endpoint anyone can hammer until the bill explodes
- analytics, email capture, auth, or payments with no privacy policy
- accounts, uploads, payments, or user content with no Terms of Use

SafeToShip is the friend who stops you at the door and says: "This works, but do not launch it yet. Here is exactly what to fix."

## Quick Start

### Install In Codex

```bash
codex plugin marketplace add lehamidmb/safetoship --ref v0.2.0
codex plugin add safetoship@safetoship
```

Then ask Codex:

```text
Use SafeToShip to audit and harden this app before I launch it.
```

The plugin runs the pinned SafeToShip release, handles the findings in the current Codex task, and re-audits after reviewed repairs. Codex never commits, pushes, publishes, or deploys without your explicit approval.

### Use The CLI

```bash
npx safetoship audit
```

For a fast beginner check:

```bash
npx safetoship quick
```

To generate a repair plan:

```bash
npx safetoship fix
```

To apply deterministic safe fixes and write the remaining repair plan:

```bash
npx safetoship fix --apply-safe
```

To understand a rule or document an accepted risk:

```bash
npx safetoship explain STS-COST-006
```

To run the repository source locally:

```bash
npm install
npm run build
node dist/cli.js audit fixtures/insecure-next-supabase --no-engines
```

## What Makes It Different

Most security tools assume you already know what a CVE, SARIF report, CSP header, or RLS policy means.

SafeToShip assumes you are trying to launch an app and need a clear answer.

- Verdict first: `SHIP`, `SHIP-WITH-WARNINGS`, or `DO-NOT-SHIP`.
- Confidence-aware: direct evidence can block; heuristic evidence is marked `NEEDS-REVIEW` instead of pretending certainty.
- Reviewable exceptions: inline and repository suppressions require a reason and remain visible as accepted risks.
- Agent-ready: versioned JSON, stable finding fingerprints, and an installable Codex skill.
- Built for the AI-builder stack: Next.js, Supabase, Node, serverless, paid AI APIs.
- Catches cost-abuse patterns ordinary scanners miss, like client-side quota limits.
- Includes launch compliance basics: privacy policy, Terms of Use, provider disclosure, consent signals, and trademark attestation.
- Turns findings into copy-paste repair tasks for Claude Code, Codex, and Cursor.
- Applies safe hardening fixes for deterministic issues like source maps and missing policy starter docs.
- Runs locally by default. No API key required.
- Produces share-safe reports without machine-specific home paths or discovered secret values.

The goal is simple: keep the speed of vibe coding, but add a real launch hardening pass before users, attackers, app stores, lawyers, or cloud bills get involved.

## Example Output

```text
SafeToShip 0.2.0  /app
 DO-NOT-SHIP   16 finding(s): 8 blocker, 6 high, 2 medium, 0 low

[BLOCKER] Paid usage limit appears enforced only in the browser [STS-COST-006]
  Confidence: medium - NEEDS REVIEW
  components/DemoLaunchClient.tsx:13
  Why: This file stores a usage limit in browser-controlled storage while a paid API path appears reachable from the same client flow. Users can edit browser storage and bypass the limit.

  Claude Code / Codex / Cursor fix prompt:
  I am preparing this app for launch. A paid usage or quota limit appears to be enforced only in frontend code.
  Move quota enforcement to the server. Store usage by user/IP/account in a server-side store, check it before every paid provider call, and make the frontend display the server's remaining quota instead of deciding locally.
  Make the smallest safe change, show the full diff, and add or update tests where practical.
```

## What It Checks

### Secret And Frontend Exposure

- Secret-shaped values exposed through `NEXT_PUBLIC_`.
- Private-looking tokens in browser-reachable code.
- Optional Gitleaks wrapper for committed secrets.
- Production source maps in Next.js.

### Supabase Safety

- `service_role` keys reachable from client code.
- Public tables without obvious RLS.
- Broad policies like `USING (true)` or all-authenticated-user access.

### Abuse And Cost Protection

- Usage limits enforced only in frontend code.
- Paid provider endpoints without obvious server-side rate limits.
- Client flows that can lead to runaway OpenAI, Anthropic, email, SMS, or payment-provider bills.

### App Security Basics

- Missing Next.js security headers.
- Cookie/session-authenticated state-changing Next.js routes without an obvious CSRF or same-origin check.
- State-changing Next.js routes with permissive wildcard CORS.
- Optional Semgrep CE wrapper for first-party code vulnerabilities.
- Optional OSV-Scanner wrapper for known vulnerable dependencies.

### Launch Compliance Basics

- Missing privacy policy when the app appears to collect data.
- Missing Terms of Use when accounts, payments, or user-generated content are present.
- Privacy policy under-declaring third-party providers used in code.
- Analytics loaded before an obvious consent gate.
- Product-name trademark/IP attestation reminder.
- Missing security contact or disclosure policy for user-data apps.

Legal/compliance checks are not legal advice, do not create an attorney-client relationship, and should be reviewed by a qualified professional.

## Launch Hardening

`safetoship fix` creates `SAFETOSHIP_HARDENING_PLAN.md` inside the target app. The plan groups every finding into one of three buckets:

- `safe-autofix`: deterministic fixes SafeToShip can apply with `--apply-safe`.
- `agent-repair`: changes that touch auth, data access, billing, privacy, or app behavior and should be handled by Codex, Claude Code, Cursor, or a maintainer.
- `manual-review`: human checks like trademark/IP attestation or legal review.

Safe autofixes in v0.2:

- disable simple `productionBrowserSourceMaps: true` Next.js configs.
- create a review-required `PRIVACY.md` starter when data collection is detected.
- create a review-required `TERMS.md` starter when accounts, payments, or user content are detected.
- create a starter `SECURITY.md` disclosure policy when user-data apps have no private reporting path.

SafeToShip intentionally does not blindly move API keys, rewrite RLS policies, or change billing/auth flows. For those, it gives an exact repair prompt with the file path, risk, and acceptance criteria.

## CLI

```bash
safetoship audit [target]
safetoship quick [target]
safetoship fix [target]
safetoship explain <rule-id>
```

Options:

- `--json` prints structured JSON.
- `--sarif <file>` writes SARIF for code scanning upload.
- `--markdown <file>` writes a plain-English report.
- `--github-comment <file>` writes a concise, verdict-first PR summary.
- `--fail-on do-not-ship|warnings|never` controls CI failure behavior.
- `--no-engines` skips Gitleaks, Semgrep, and OSV-Scanner wrappers.
- `--exclude <paths>` adds comma-separated exclusions.
- `fix --apply-safe` applies deterministic safe fixes and writes the remaining hardening plan.

## Confidence And Accepted Risks

SafeToShip separates impact from certainty. A `BLOCKER` with high-confidence direct evidence produces `DO-NOT-SHIP`. A medium-confidence blocker produces `SHIP-WITH-WARNINGS` and a `NEEDS-REVIEW` marker. Low-confidence advisories do not affect the verdict.

To accept a reviewed risk on the finding line or immediately above it:

```ts
// safetoship-ignore STS-COST-006 reason="server middleware enforces the real quota"
```

Repository-level policy lives in `.safetoshiprc.json`:

```json
{
  "exclude": ["examples"],
  "rules": {
    "STS-COST-006": {
      "enabled": false,
      "reason": "server middleware enforces the real quota"
    }
  }
}
```

Accepted risks are excluded from verdict math but remain visible in terminal, JSON, Markdown, and PR output. Overrides can reduce severity or confidence; they cannot silently make a rule stricter or erase its audit trail.

The versioned agent contract is documented in [`docs/schema/v1.json`](docs/schema/v1.json).

## Optional Engines

SafeToShip degrades gracefully if these are missing:

```bash
brew install gitleaks
brew install osv-scanner
python3 -m pip install semgrep
```

The core Supabase, cost-abuse, and launch-compliance checks run without external tools or API keys. Semgrep uses SafeToShip-authored Apache-2.0 rules from the package with metrics disabled; it does not fetch registry rules.

## GitHub Action

The repository workflow uses `--github-comment` to create one sticky PR comment. Each run updates the same bot-authored comment with blockers and highs grouped by fix area plus the top three agent-ready repair prompts. The complete Markdown report and SARIF output remain separate and unchanged.

```yaml
name: SafeToShip

on: [pull_request]

permissions:
  contents: read
  security-events: write

jobs:
  safetoship:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lehamidmb/safetoship@v0.2.0
        with:
          target: "."
          fail-on: do-not-ship
      - uses: github/codeql-action/upload-sarif@v4
        if: always()
        with:
          sarif_file: safetoship.sarif
```

## Demo Fixture

This repo includes an intentionally unsafe demo app:

```bash
npm run demo
```

It demonstrates the core launch-blocker story: exposed frontend key, Supabase `service_role` in client code, RLS-off tables, a client-side quota limit, a paid AI route with no rate limit, a cookie-authenticated route without CSRF protection, wildcard CORS, analytics before consent, and no privacy policy.

## What This Does NOT Check Yet

SafeToShip is a launch gate, not proof that an app is secure or legally compliant.

A static repo scan cannot reliably prove:

- BOLA/IDOR object-level authorization is safe.
- every runtime CSRF, CORS, proxy, and origin enforcement path is safe.
- Supabase RLS policies are correct, only that obvious RLS setup exists.
- secrets injected only into a built frontend bundle are absent.
- every dependency is legitimate or not typo-squatted.
- your app satisfies every privacy, consumer protection, or industry-specific legal obligation.

The product is honest on purpose: it catches high-signal mistakes, explains them clearly, and helps you fix them before you publish.

## Roadmap

- Build-then-scan for `.next`, `dist`, and deployed frontend bundles.
- Carefully scoped Supabase exposure probes that report observed access without claiming RLS is proven safe.
- Dependency existence and slopsquat similarity checks.
- Optional BYOK explanation mode that never becomes required for core scans.

## License

Apache-2.0
