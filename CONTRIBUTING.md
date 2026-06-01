# Contributing

Thanks for helping make AI-built apps safer to launch.

## Development

```bash
npm install
npm run build
npm test
node dist/cli.js audit fixtures/insecure-next-supabase --no-engines
```

## Rule Guidelines

- Prefer precise, explainable heuristics over broad pattern matching.
- Every new heuristic needs a unit test.
- Every finding needs a plain-English `why` and a copy-paste fix prompt.
- Legal/compliance rules must stay framed as risk signals, not legal advice.
- If a static scan cannot prove something, say so in the output.

## Security

Please report security issues privately before opening a public issue. Until a dedicated security contact is published, open a minimal issue asking for a maintainer contact without including exploit details.
