import type { Confidence, Severity } from "./types.js";

export interface RuleMetadata {
  id: string;
  defaultSeverity: Severity;
  confidence: Confidence;
  confidenceRationale: string;
  checks: string;
  knownFalsePositives: string;
}

const ruleChecks: Record<string, string> = {
  "STS-COST-001": "Finds private-looking environment variable names exposed through public frontend prefixes.",
  "STS-COST-002": "Finds secret-shaped literals in browser-reachable source files.",
  "STS-COST-003": "Finds Supabase service-role credentials or variables reachable from client code.",
  "STS-COST-004": "Compares public table creation in Supabase migrations with explicit RLS enable statements.",
  "STS-COST-005": "Finds Supabase policies with unrestricted row access or overly broad authenticated access.",
  "STS-COST-006": "Correlates browser-controlled quota state with a client path to a paid provider endpoint.",
  "STS-COST-007": "Finds paid provider endpoints without a recognized server-side rate-limit signal.",
  "STS-LEGAL-001": "Looks for data-collection signals and a usable local privacy-policy artifact.",
  "STS-LEGAL-002": "Looks for accounts, payments, or user content without a usable Terms of Use artifact.",
  "STS-LEGAL-003": "Compares third-party providers used in code with providers named in the privacy policy.",
  "STS-LEGAL-004": "Finds analytics loaded globally without a recognized consent gate.",
  "STS-LEGAL-005": "Extracts the product name and requests a human trademark and IP attestation.",
  "STS-LEGAL-006": "Looks for a private security contact or vulnerability-disclosure policy.",
  "STS-TECH-001": "Finds Next.js configurations that publish production browser source maps.",
  "STS-TECH-002": "Looks for core browser security headers in a Next.js config or middleware.",
  "STS-TECH-003": "Finds cookie-authenticated state-changing routes without a recognized CSRF or origin check.",
  "STS-TECH-004": "Finds state-changing routes that explicitly allow wildcard cross-origin browser requests.",
  "STS-TECH-005": "Compares declared dependency names with a curated set of common provider packages using a one-edit similarity check.",
  "STS-QUICK-001": "Searches scanned source for secret-shaped literal values.",
  "STS-QUICK-002": "Finds route access that appears to rely only on a browser-side authentication guard.",
  "STS-QUICK-003": "Finds request input interpolated directly into SQL-shaped query text.",
  "STS-ENG-GITLEAKS": "Reports secret matches returned by a locally installed Gitleaks scan.",
  "STS-ENG-SEMGREP": "Reports first-party code matches from SafeToShip's packaged local Semgrep rules.",
  "STS-ENG-OSV": "Reports known dependency advisories returned by a locally installed OSV-Scanner.",
  "STS-META-001": "Finds invalid, unknown, or unjustified inline SafeToShip suppression markers."
};

const rules: RuleMetadata[] = [
  rule("STS-COST-001", "BLOCKER", "high", "Direct public environment-variable evidence in client-reachable code.", "A deliberately public provider key whose name resembles a secret."),
  rule("STS-COST-002", "BLOCKER", "high", "A secret-shaped literal appears directly in client-reachable code.", "Documented fake credentials or provider-specific public identifiers."),
  rule("STS-COST-003", "BLOCKER", "high", "A Supabase service-role signal appears in client-reachable code.", "Documented fake fixtures or misleading variable names without a privileged value."),
  rule("STS-COST-004", "BLOCKER", "medium", "Migration text suggests a public table without an accompanying RLS enable statement.", "RLS configured outside checked migrations, including through the Supabase dashboard."),
  rule("STS-COST-005", "BLOCKER", "high", "A policy explicitly contains an unrestricted USING(true) or equivalent broad role condition.", "A table intentionally designed for public read access."),
  rule("STS-COST-006", "BLOCKER", "medium", "Client quota signals and a paid endpoint are correlated statically.", "The client display limit is decorative while an unseen server control enforces the real quota."),
  rule("STS-COST-007", "HIGH", "medium", "A paid-provider endpoint lacks a recognized rate-limit signal.", "Rate limiting enforced by infrastructure, middleware, or a provider not recognized by SafeToShip."),
  rule("STS-LEGAL-001", "BLOCKER", "medium", "Data-collection signals exist but no local privacy artifact was found.", "The policy is hosted externally or generated at deployment time."),
  rule("STS-LEGAL-002", "HIGH", "medium", "Account, payment, or user-content signals exist without a local terms artifact.", "Terms are hosted externally or the detected feature is not user-facing."),
  rule("STS-LEGAL-003", "BLOCKER", "medium", "Detected provider signals are absent from the policy text SafeToShip can see.", "The provider is disclosed by legal entity, category, or an externally hosted policy."),
  rule("STS-LEGAL-004", "BLOCKER", "medium", "Analytics code appears without a recognized consent-gating signal.", "Consent is enforced by a tag manager, hosting layer, or unsupported consent library."),
  rule("STS-LEGAL-005", "HIGH", "low", "Trademark review requires a human attestation and cannot be inferred from source code.", "The review was completed outside the repository."),
  rule("STS-LEGAL-006", "MEDIUM", "medium", "No local security-reporting artifact was found.", "A security contact is published externally."),
  rule("STS-TECH-001", "HIGH", "high", "Next.js production browser source maps are explicitly enabled.", "A controlled private deployment intentionally serves source maps."),
  rule("STS-TECH-002", "MEDIUM", "medium", "A Next.js project lacks recognized header configuration.", "Headers are supplied by a CDN, reverse proxy, or hosting platform."),
  rule("STS-TECH-003", "HIGH", "medium", "A cookie-authenticated state-changing route lacks a recognized origin or CSRF check.", "Protection exists in shared middleware or an unsupported framework helper."),
  rule("STS-TECH-004", "HIGH", "high", "A state-changing authenticated route explicitly returns a wildcard CORS origin.", "The route is intentionally public and does not use credentials or sensitive state."),
  rule("STS-TECH-005", "LOW", "low", "The package name is one insertion, deletion, substitution, or adjacent transposition from a curated common provider package.", "A distinct legitimate package can intentionally have a similar name; this rule is a review hint, not a malware verdict."),
  rule("STS-QUICK-001", "BLOCKER", "high", "A secret-shaped literal is present in scanned source.", "Documented fake values and examples."),
  rule("STS-QUICK-002", "HIGH", "medium", "A client-only authentication guard is inferred from route structure.", "A server or infrastructure guard exists outside the checked file."),
  rule("STS-QUICK-003", "BLOCKER", "high", "Untrusted input is interpolated directly into a SQL-shaped query.", "A query wrapper safely parameterizes templates internally."),
  rule("STS-ENG-GITLEAKS", "BLOCKER", "high", "Gitleaks matched a configured secret rule in repository content or history.", "Documented fake credentials or test vectors not allowlisted in Gitleaks."),
  rule("STS-ENG-SEMGREP", "HIGH", "medium", "A local SafeToShip Semgrep rule matched a security-sensitive code pattern.", "Sanitization or control flow outside the matched expression."),
  rule("STS-ENG-OSV", "HIGH", "high", "OSV reported a known advisory for a resolved dependency.", "The vulnerable code path is unreachable or mitigated by the application."),
  rule("STS-META-001", "MEDIUM", "high", "A SafeToShip suppression marker is present without a usable justification.", "None; this finding describes malformed SafeToShip configuration.")
];

export const RULE_METADATA = new Map(rules.map((item) => [item.id, item]));

export function metadataFor(ruleId: string): RuleMetadata {
  return RULE_METADATA.get(ruleId) ?? rule(
    ruleId,
    "MEDIUM",
    "medium",
    "This external or future rule has not declared a stronger confidence level.",
    "Review the originating engine or rule documentation."
  );
}

function rule(
  id: string,
  defaultSeverity: Severity,
  confidence: Confidence,
  confidenceRationale: string,
  knownFalsePositives: string
): RuleMetadata {
  return {
    id,
    defaultSeverity,
    confidence,
    confidenceRationale,
    checks: ruleChecks[id] ?? `Checks source or engine evidence for ${id}.`,
    knownFalsePositives
  };
}
