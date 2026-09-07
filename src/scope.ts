const STATIC_SCOPE_LIMITS = [
  "Static repo scans cannot reliably prove BOLA/IDOR object-level authorization is safe.",
  "CSRF and CORS checks identify obvious static signals; they cannot prove every runtime origin, proxy, or authentication path is correctly enforced.",
  "RLS presence is not proof that policies restrict access correctly; static scans do not perform live database probes.",
  "Known-vulnerability scanners cannot prove that every hallucinated or typo-squatted dependency is malicious.",
  "Legal/compliance findings are risk signals, not legal advice and not an attorney-client relationship."
];

export function scopeLimits(buildRequested: boolean): string[] {
  const buildLimit = buildRequested
    ? "Built-bundle scanning covers recognized local .next/static, dist, build/static, and out text assets; it does not inspect deployed assets or prove every bundler output is covered."
    : "Secrets injected only into a built frontend bundle may be missed unless you run audit or launch with --build.";
  return [...STATIC_SCOPE_LIMITS.slice(0, 3), buildLimit, ...STATIC_SCOPE_LIMITS.slice(3)];
}

export const LEGAL_BANNER =
  "Legal/compliance checks are not legal advice, do not create an attorney-client relationship, and should be reviewed by a qualified professional.";
