# Built Secret Fixture

This dependency-free build simulates a credential-shaped value injected into a browser bundle at build time. The value is deliberately fake. The build runs locally and makes no network requests.

From the SafeToShip repository after `npm run build`:

```bash
node dist/cli.js audit fixtures/built-secret --no-engines
node dist/cli.js audit fixtures/built-secret --build --no-engines
```

The source scan reports `SHIP`; the explicit build scan reports `DO-NOT-SHIP` for `STS-TECH-006` in `.next/static/chunks/demo.js`. Generated output is ignored by Git and excluded from ordinary source scans. No dependency installation is needed in this fixture.
