# Codex For OSS Submission Pack

Official pages to use:

- Application form: https://openai.com/form/codex-for-oss/
- Community page: https://developers.openai.com/community/codex-for-oss
- Terms: https://developers.openai.com/codex/codex-for-oss-terms

## Submission Strategy

Submit SafeToShip as a public-good OSS project for the new class of AI builders. The story is not "we made another scanner." The story is:

SafeToShip is a local launch hardening agent that helps vibe coders ship responsibly. It catches the missing safety/compliance layer AI coding agents often skip, then turns findings into safe autofixes and repair tasks for Codex, Claude Code, or Cursor.

Do not claim adoption we do not have yet. Lead with ecosystem importance:

- AI-built apps are becoming common.
- Non-expert builders are shipping real products.
- Existing scanners speak to security engineers.
- SafeToShip speaks to the builder at launch time.
- The project is local-first, API-key-free, Apache-2.0, and directly improves the safety of apps built with AI coding tools.

## Field Draft: Why Does This Repository Qualify?

SafeToShip is an Apache-2.0, local-first launch hardening agent for AI-built apps. It wraps Gitleaks, Semgrep, and OSV where useful, then adds OSS heuristics for gaps vibe coders hit: Supabase service_role/RLS mistakes, client-side cost-limit bypasses, unthrottled paid API routes, and missing privacy/terms/provider disclosures. It returns a go/no-go verdict, safe autofixes, and Codex/Claude/Cursor repair prompts so non-experts can harden apps before launch.

## Field Draft: How Will You Use API Credits?

Credits would support maintainer automation: Codex-based PR review, false-positive triage, issue reproduction, rule updates as Next.js/Supabase/payment/AI-provider patterns change, fix-prompt evaluation, release notes, and dogfooding SafeToShip against itself and fixture apps. The tool remains local-first and API-key-free for users; credits are for project maintenance, quality, and security review.

## Short Project Description

SafeToShip helps AI builders answer the question they actually have before launch: "Is this app safe to ship, and what do I fix?" It scans locally, gives a plain-English verdict, applies deterministic safe hardening where possible, and writes an agent-ready hardening plan for risky changes that need review.

## Before Submitting

- Create the public GitHub repo under the intended account.
- Push the local `main` branch.
- Confirm the README renders cleanly on GitHub.
- Add repository topics: `vibe-coding`, `ai-generated-code`, `security`, `supabase`, `nextjs`, `compliance`, `cli`.
- Run `npm run check`.
- Run `node dist/cli.js audit . --no-engines --exclude fixtures,tests --fail-on do-not-ship`.
- Confirm no personal email, private repo names, local paths, or secrets appear in public docs.
- Submit the GitHub repo URL through the official OpenAI form.
