# Security Policy

SafeToShip is a security-adjacent tool, so responsible disclosure matters.

## Reporting A Vulnerability

Please do not open a public issue with exploit details.

Until a dedicated security contact is published, open a minimal GitHub issue asking for a maintainer security contact, without including sensitive details. A maintainer will provide a private channel for the report.

Helpful details include:

- affected SafeToShip version or commit
- command used
- target framework or stack
- whether the issue is a false negative, false positive, unsafe autofix, or package/security concern
- minimal reproduction if it can be shared safely

## Scope

In scope:

- unsafe autofixes
- secret leakage from SafeToShip reports
- incorrect handling of local files
- vulnerabilities in the CLI or GitHub Action
- high-impact false negatives in documented rules

Out of scope:

- requests for legal advice
- findings from intentionally insecure fixtures
- vulnerabilities in third-party apps scanned by SafeToShip
- issues in optional wrapped engines such as Gitleaks, Semgrep, or OSV-Scanner

## Legal And Compliance Note

SafeToShip legal/compliance checks are risk signals, not legal advice, and do not create an attorney-client relationship.
