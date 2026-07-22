import type { Finding, ScanResult, Verdict } from "./types.js";

export function summarize(findings: Finding[]): ScanResult["summary"] {
  return {
    blockers: findings.filter((finding) => finding.severity === "BLOCKER").length,
    high: findings.filter((finding) => finding.severity === "HIGH").length,
    medium: findings.filter((finding) => finding.severity === "MEDIUM").length,
    low: findings.filter((finding) => finding.severity === "LOW").length,
    total: findings.length,
    suppressed: 0,
    needsReview: findings.filter((finding) => finding.needsReview).length
  };
}

export function decideVerdict(findings: Finding[]): Verdict {
  if (findings.some((finding) => finding.severity === "BLOCKER" && finding.confidence === "high")) {
    return "DO-NOT-SHIP";
  }

  if (findings.some((finding) =>
    (finding.severity === "BLOCKER" && finding.confidence === "medium") ||
    (finding.severity === "HIGH" && finding.confidence !== "low")
  )) {
    return "SHIP-WITH-WARNINGS";
  }

  return "SHIP";
}
