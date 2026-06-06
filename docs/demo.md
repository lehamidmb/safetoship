# SafeToShip Demo

This demo shows the core story: a vibe-coded app can work locally while still being unsafe to launch.

## Run The Audit

```bash
npm install
npm run build
node dist/cli.js audit fixtures/insecure-next-supabase --no-engines
```

Expected verdict:

```text
DO-NOT-SHIP
```

High-signal findings to show:

- frontend-exposed paid API key
- Supabase `service_role` reachable from client code
- public Supabase tables without obvious RLS
- paid AI endpoint without server-side rate limiting
- browser-only quota in `localStorage`
- cookie-authenticated state change without an obvious CSRF/origin check
- wildcard CORS on a state-changing API route
- missing privacy policy
- analytics loaded before consent

## Run The Hardening Pass

Use a copy so the fixture stays intentionally unsafe:

```bash
rm -rf tmp/demo-fix
mkdir -p tmp
cp -R fixtures/insecure-next-supabase tmp/demo-fix
node dist/cli.js fix tmp/demo-fix --no-engines --apply-safe
```

Expected safe changes:

- `next.config.js` turns off production browser source maps.
- `PRIVACY.md` starter is created.
- `TERMS.md` starter is created.
- `SECURITY.md` starter is created.
- `SAFETOSHIP_HARDENING_PLAN.md` is created with agent-ready repair tasks.

## Demo Close

SafeToShip does not pretend to magically rewrite auth, billing, RLS, or legal terms. It applies boring safe hardening where deterministic, then hands the risky parts to Codex, Claude Code, Cursor, or a maintainer with exact repair prompts.
