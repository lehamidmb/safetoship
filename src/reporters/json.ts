import type { Finding, FindingSnapshot, ScanResult } from "../types.js";
import { reportTarget } from "../reportTarget.js";

export function renderJson(result: ScanResult): string {
  return JSON.stringify(
    {
      schemaVersion: 2,
      tool: { name: "safetoship", version: result.version },
      target: { path: reportTarget(result.targetDir), scannedAt: result.generatedAt },
      mode: result.mode,
      verdict: result.verdict,
      counts: {
        blocker: result.summary.blockers,
        high: result.summary.high,
        medium: result.summary.medium,
        low: result.summary.low,
        total: result.summary.total,
        suppressed: result.summary.suppressed,
        needsReview: result.summary.needsReview
      },
      findings: result.findings.map(jsonFinding),
      acceptedRisks: result.acceptedRisks.map(jsonFinding),
      engines: result.engineStatuses,
      coverage: result.coverage,
      warnings: result.warnings,
      limits: result.limits,
      delta: result.delta ? {
        baseline: result.delta.baseline,
        counts: result.delta.counts,
        newFindings: result.delta.newFindings.map(jsonSnapshot),
        resolvedFindings: result.delta.resolvedFindings.map(jsonSnapshot),
        unchangedFingerprints: result.delta.unchangedFingerprints
      } : null
    },
    null,
    2
  );
}

function jsonSnapshot(finding: FindingSnapshot) {
  return {
    id: finding.id,
    fingerprint: finding.fingerprint,
    title: finding.title,
    severity: finding.severity.toLowerCase(),
    file: finding.file ?? null,
    line: finding.line ?? null
  };
}

function jsonFinding(finding: Finding) {
  return {
    id: finding.id,
    fingerprint: finding.fingerprint,
    title: finding.title,
    severity: finding.severity.toLowerCase(),
    confidence: finding.confidence,
    confidenceRationale: finding.confidenceRationale,
    needsReview: finding.needsReview ?? false,
    file: finding.file ?? null,
    line: finding.line ?? null,
    provenance: finding.provenance ?? "source",
    why: finding.why,
    fixPrompt: finding.fixPrompt,
    suppressionReason: finding.suppressionReason ?? null
  };
}
