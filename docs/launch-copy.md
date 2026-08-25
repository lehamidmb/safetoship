# SafeToShip Launch Copy

## One-Liner

The deterministic launch gate for AI-built apps.

## Headline

Your AI can write the app. SafeToShip tells you whether it is ready to launch.

## Short Pitch

SafeToShip is a local launch-readiness gate for AI-built apps. Deep security agents can hunt subtle exploit paths; SafeToShip catches the wider launch failures vibe coders usually do not see until too late: exposed frontend keys, Supabase `service_role` leaks, missing RLS, browser-only usage limits, unthrottled paid API routes, missing privacy policies, missing Terms of Use, and undeclared third-party providers.

It returns `SHIP`, `SHIP-WITH-WARNINGS`, or `DO-NOT-SHIP`, then creates a portable packet showing what ran, what was skipped, what changed, and exactly what to fix. It can complement Codex Security or Claude Security without requiring either one for its deterministic core.

## Stronger Framing

Working is not the same as launch-ready.

Run the deep security review. Then run the launch review. SafeToShip turns exposed secrets, Supabase permissions, paid API abuse, privacy basics, terms basics, skipped checks, and accepted risks into one accountable release decision.

## Social Post Draft

AI coding agents are getting better at finding deep security bugs. Launch readiness is still bigger than a vulnerability scan.

So I built SafeToShip: the deterministic launch gate for AI-built apps.

Run one command and get:

- SHIP
- SHIP-WITH-WARNINGS
- DO-NOT-SHIP

It checks exposed API keys, Supabase RLS gaps, `service_role` leaks, browser-only usage limits, unthrottled paid AI routes, missing privacy policies, missing Terms of Use, missing security contacts, and undeclared third-party providers.

It also writes a portable launch packet with coverage, skipped engines, accepted risks, and new/resolved findings. Pair it with Codex Security or Claude Security for deeper semantic review, or run the local core on its own without an API key.

Keep the speed. Add the launch checkpoint.

## Demo Script

1. Show a small Next.js/Supabase app that appears to work.
2. Run `safetoship launch fixtures/insecure-next-supabase --no-engines --fail-on never`.
3. Highlight the verdict: `DO-NOT-SHIP`.
4. Show three findings:
   - frontend-exposed OpenAI key
   - Supabase `service_role` in client code
   - paid usage limit stored in `localStorage`
5. Run `safetoship fix --apply-safe`.
6. Show the generated `SAFETOSHIP_HARDENING_PLAN.md`.
7. Paste one repair task into Codex or Claude Code.
8. End on: "Your AI wrote the app. SafeToShip decides whether it is ready to launch."

## Grant/Application Angle

SafeToShip is an open-source launch-readiness layer for the new class of AI builders. It complements deep model-backed security review with a deterministic, local, API-key-free gate for Supabase safety, client-side cost abuse, launch compliance, scan coverage, and risk deltas. The output is designed for builders and agents: one verdict, safe autofixes where deterministic, clear explanations, portable evidence, and agent-ready repair prompts.
