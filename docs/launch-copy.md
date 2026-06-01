# SafeToShip Launch Copy

## One-Liner

Vibe code with peace of mind.

## Short Pitch

SafeToShip is a local launch hardening agent for AI-built apps. It checks the launch risks vibe coders usually do not see until too late: exposed frontend keys, Supabase `service_role` leaks, missing RLS, browser-only usage limits, unthrottled paid API routes, missing privacy policies, missing Terms of Use, and undeclared third-party providers.

It returns a plain-English verdict: `SHIP`, `SHIP-WITH-WARNINGS`, or `DO-NOT-SHIP`, then turns the findings into a hardening plan with safe autofixes and copy-paste repair tasks for Claude Code, Codex, and Cursor.

## Stronger Framing

Do not launch your vibe-coded app just because it works.

Launch it after SafeToShip hardens the things your AI coding agent may have skipped: secrets, Supabase permissions, paid API abuse, privacy basics, terms basics, and launch hygiene.

## Social Post Draft

Vibe coding makes apps feel finished before they are launch-ready.

So I built SafeToShip: a local launch hardening agent for AI-built apps.

Run one command and get:

- SHIP
- SHIP-WITH-WARNINGS
- DO-NOT-SHIP

It checks exposed API keys, Supabase RLS gaps, `service_role` leaks, browser-only usage limits, unthrottled paid AI routes, missing privacy policies, missing Terms of Use, missing security contacts, and undeclared third-party providers.

The best part: it turns findings into a hardening plan with safe autofixes where possible and paste-ready repair tasks for Claude Code, Codex, or Cursor.

Keep the speed. Add the launch checkpoint.

## Demo Script

1. Show a small Next.js/Supabase app that appears to work.
2. Run `safetoship audit fixtures/insecure-next-supabase --no-engines`.
3. Highlight the verdict: `DO-NOT-SHIP`.
4. Show three findings:
   - frontend-exposed OpenAI key
   - Supabase `service_role` in client code
   - paid usage limit stored in `localStorage`
5. Run `safetoship fix --apply-safe`.
6. Show the generated `SAFETOSHIP_HARDENING_PLAN.md`.
7. Paste one repair task into Codex or Claude Code.
8. End on: "Vibe code with peace of mind."

## Grant/Application Angle

SafeToShip is an open-source launch hardening layer for the new class of AI builders. It does not slow down vibe coding; it adds the missing launch checkpoint and repair plan. The project is local-first and API-key-free by default, wraps established scanners where appropriate, and adds new OSS heuristics around Supabase safety, client-side cost abuse, and basic launch compliance. The output is designed for non-experts: one verdict, safe autofixes where deterministic, clear explanations, and agent-ready repair prompts.
