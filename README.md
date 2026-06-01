# ShipVerdict

Vibe code with peace of mind.

ShipVerdict is a local pre-launch gate for AI-built apps. Run it before you publish and it tells you, in plain English, whether your app is ready to ship:

- `SHIP`
- `SHIP-WITH-WARNINGS`
- `DO-NOT-SHIP`

It looks for the mistakes AI coding tools and first-time builders often miss: private API keys in the frontend, Supabase RLS gaps, `service_role` exposure, browser-only usage limits, paid API routes with no rate limit, missing privacy policies, missing Terms of Use, and other launch risks.

ShipVerdict is not another wall of scanner output. It gives you a decision, explains the risk like a human, and hands you a copy-paste fix prompt for Claude Code, Codex, or Cursor.

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

ShipVerdict is the friend who stops you at the door and says: "This works, but do not launch it yet. Here is exactly what to fix."

## Quick Start

```bash
npx shipverdict audit
```

For a fast beginner check:

```bash
npx shipverdict quick
```

Until the package is published, run locally:

```bash
npm install
npm run build
node dist/cli.js audit fixtures/insecure-next-supabase --no-engines
```

## What Makes It Different

Most security tools assume you already know what a CVE, SARIF report, CSP header, or RLS policy means.

ShipVerdict assumes you are trying to launch an app and need a clear answer.

- Verdict first: `SHIP`, `SHIP-WITH-WARNINGS`, or `DO-NOT-SHIP`.
- Built for the AI-builder stack: Next.js, Supabase, Node, serverless, paid AI APIs.
- Catches cost-abuse patterns ordinary scanners miss, like client-side quota limits.
- Includes launch compliance basics: privacy policy, Terms of Use, provider disclosure, consent signals, and trademark attestation.
- Gives copy-paste fix prompts for Claude Code, Codex, and Cursor.
- Runs locally by default. No API key required.

The goal is simple: keep the speed of vibe coding, but add a real launch checkpoint before users, attackers, app stores, lawyers, or cloud bills get involved.

## Example Output

```text
ShipVerdict 0.1.0  /app
 DO-NOT-SHIP   7 finding(s): 4 blocker, 2 high, 1 medium, 0 low

[BLOCKER] Paid usage limit appears enforced only in the browser [SV-COST-006]
  app/page.tsx:9
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
- Optional Semgrep CE wrapper for first-party code vulnerabilities.
- Optional OSV-Scanner wrapper for known vulnerable dependencies.

### Launch Compliance Basics

- Missing privacy policy when the app appears to collect data.
- Missing Terms of Use when accounts, payments, or user-generated content are present.
- Privacy policy under-declaring third-party providers used in code.
- Analytics loaded before an obvious consent gate.
- Product-name trademark/IP attestation reminder.

Legal/compliance checks are not legal advice, do not create an attorney-client relationship, and should be reviewed by a qualified professional.

## CLI

```bash
shipverdict audit [target]
shipverdict quick [target]
```

Options:

- `--json` prints structured JSON.
- `--sarif <file>` writes SARIF for code scanning upload.
- `--markdown <file>` writes a plain-English report.
- `--fail-on do-not-ship|warnings` controls CI failure behavior.
- `--no-engines` skips Gitleaks, Semgrep, and OSV-Scanner wrappers.
- `--exclude <paths>` adds comma-separated exclusions.

## Optional Engines

ShipVerdict degrades gracefully if these are missing:

```bash
brew install gitleaks
brew install osv-scanner
python3 -m pip install semgrep
```

The core Supabase, cost-abuse, and launch-compliance checks run without external tools or API keys.

## GitHub Action

```yaml
name: ShipVerdict

on: [pull_request]

permissions:
  contents: read
  security-events: write

jobs:
  shipverdict:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: OWNER/shipverdict@v0.1.0
        with:
          target: "."
          fail-on: do-not-ship
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: shipverdict.sarif
```

## Demo Fixture

This repo includes an intentionally unsafe demo app:

```bash
node dist/cli.js audit fixtures/insecure-next-supabase --no-engines
```

It demonstrates the core launch-blocker story: exposed frontend key, Supabase `service_role` in client code, RLS-off tables, a client-side quota limit, a paid AI route with no rate limit, analytics before consent, and no privacy policy.

## What This Does NOT Check Yet

ShipVerdict is a launch gate, not proof that an app is secure or legally compliant.

A static repo scan cannot reliably prove:

- BOLA/IDOR object-level authorization is safe.
- Supabase RLS policies are correct, only that obvious RLS setup exists.
- secrets injected only into a built frontend bundle are absent.
- every dependency is legitimate or not typo-squatted.
- your app satisfies every privacy, consumer protection, or industry-specific legal obligation.

The product is honest on purpose: it catches high-signal mistakes, explains them clearly, and helps you fix them before you publish.

## Roadmap

- Build-then-scan for `.next`, `dist`, and deployed frontend bundles.
- Live Supabase anon-key probes for RLS behavior.
- Dependency existence and slopsquat similarity checks.
- CSRF and CORS framework-specific rules.
- PR comment bot with the plain-English report.
- Optional BYOK explanation mode that never becomes required for core scans.

## License

Apache-2.0
