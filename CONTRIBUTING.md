# Contributing

Thanks for helping make AI-built apps safer to launch.

## Development

```bash
npm install
npm run check
npm run demo
```

## Rule Guidelines

- Prefer precise, explainable heuristics over broad pattern matching.
- Every new heuristic needs a unit test.
- Every finding needs a plain-English `why` and a copy-paste fix prompt.
- Every finding needs confidence metadata and a deterministic fingerprint.
- Legal/compliance rules must stay framed as risk signals, not legal advice.
- If a static scan cannot prove something, say so in the output.
- Rule suppressions and downward overrides require a concrete reason and must remain visible as accepted risks.

## Codex Plugin

Keep the plugin pinned to the matching SafeToShip release and validate it before opening a pull request:

```bash
python3 /path/to/plugin-creator/scripts/validate_plugin.py plugins/safetoship
```

The plugin may prepare repairs, but it must preserve explicit approval boundaries for commits, pushes, publishing, and deployment.

## Security

Please report security issues privately before opening a public issue. Until a dedicated security contact is published, open a minimal issue asking for a maintainer contact without including exploit details.
