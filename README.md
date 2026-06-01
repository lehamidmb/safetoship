# ShipVerdict

ShipVerdict is a free, local-first pre-launch gate for AI-generated apps. It gives solo builders a plain-English verdict before launch:

- `SHIP`
- `SHIP-WITH-WARNINGS`
- `DO-NOT-SHIP`

It is not trying to be another raw scanner. It wraps established engines where they fit, then adds the parts vibe-coded apps most often miss: Supabase key/RLS mistakes, client-side cost-limit bypasses, missing rate limits on paid APIs, and privacy/terms/IP launch checks.

## Install

```bash
npx shipverdict audit
npx shipverdict quick
```

Until the package is published, run locally:

```bash
npm install
npm run build
node dist/src/cli.js audit fixtures/insecure-next-supabase --no-engines
```

## What It Checks

Family 1 technical security:

- Optional Gitleaks wrapper for committed secrets.
- Optional Semgrep CE wrapper for first-party code vulnerabilities.
- Optional OSV-Scanner wrapper for known vulnerable dependencies.
- Next.js source maps and missing security headers.

Family 2 abuse and cost:

- Secret-shaped values exposed through `NEXT_PUBLIC_`.
- Supabase `service_role` key reachable from client code.
- Supabase public tables without obvious RLS.
- Broad Supabase policies like `USING (true)`.
- Client-side-only quota/usage limits guarding paid API calls.
- Paid provider endpoints without obvious server-side rate limits.

Family 3 legal and compliance:

- Missing privacy policy when the app appears to collect data.
- Missing Terms of Use when accounts, payments, or UGC are present.
- Privacy policy under-declaring third-party providers used in code.
- Analytics loaded before an obvious consent gate.
- Product-name trademark/IP attestation reminder.

Legal/compliance checks are not legal advice, do not create an attorney-client relationship, and should be reviewed by a qualified professional.

## Sample Output

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

The core Family 2 and Family 3 checks run without any external tools or API keys.

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

## What This Does NOT Check Yet

- Static repo scans cannot reliably prove BOLA/IDOR object-level authorization is safe.
- RLS presence is not proof that policies restrict access correctly; live database probes are not in v0.1.
- Secrets injected only into a built frontend bundle may be missed unless you run a future build-then-scan step.
- Known-vulnerability scanners cannot prove that every hallucinated or typo-squatted dependency is malicious.
- Legal/compliance findings are risk signals, not legal advice and not an attorney-client relationship.

## Roadmap

- Build-then-scan for `.next`, `dist`, and deployed frontend bundles.
- Live Supabase anon-key probes for RLS behavior.
- Dependency existence and slopsquat similarity checks.
- CSRF and CORS framework-specific rules.
- PR comment bot with the plain-English report.
- Optional BYOK explanation mode that never becomes required for core scans.

## License

Apache-2.0
