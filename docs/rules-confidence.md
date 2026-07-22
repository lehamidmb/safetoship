# Rule Confidence

SafeToShip treats severity as potential impact and confidence as certainty in the static evidence. The source of truth is `src/ruleMetadata.ts`; run `safetoship explain <RULE-ID>` for a rule's rationale and known false-positive causes.

## Verdict Contract

- High-confidence `BLOCKER` -> `DO-NOT-SHIP`.
- Medium-confidence `BLOCKER` -> `SHIP-WITH-WARNINGS` plus `NEEDS-REVIEW`.
- High or medium-confidence `HIGH` -> `SHIP-WITH-WARNINGS`.
- Low-confidence findings are informational.
- Reasoned accepted risks remain visible but are excluded from verdict math.

## Default Assignments

| Confidence | Rules |
| --- | --- |
| High | `STS-COST-001`, `002`, `003`, `005`; `STS-TECH-001`, `004`; `STS-QUICK-001`, `003`; Gitleaks; OSV |
| Medium | `STS-COST-004`, `006`, `007`; legal presence/provider/consent rules; `STS-TECH-002`, `003`; Semgrep |
| Low | Trademark/IP attestation |

Confidence does not prove safety. Missing evidence can still exist outside the repository, and direct-looking evidence can be intentional. Use accepted risks only after human review.
