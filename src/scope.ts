export const HONEST_SCOPE_LIMITS = [
  "Static repo scans cannot reliably prove BOLA/IDOR object-level authorization is safe.",
  "CSRF and CORS checks identify obvious static signals; they cannot prove every runtime origin, proxy, or authentication path is correctly enforced.",
  "RLS presence is not proof that policies restrict access correctly; live database probes are not in v0.1.",
  "Secrets injected only into a built frontend bundle may be missed unless you run a future build-then-scan step.",
  "Known-vulnerability scanners cannot prove that every hallucinated or typo-squatted dependency is malicious.",
  "Legal/compliance findings are risk signals, not legal advice and not an attorney-client relationship."
];

export const LEGAL_BANNER =
  "Legal/compliance checks are not legal advice, do not create an attorney-client relationship, and should be reviewed by a qualified professional.";
