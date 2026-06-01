import type { Finding, ScanResult, Verdict } from "./types.js";

export function summarize(findings: Finding[]): ScanResult["summary"] {
  return {
    blockers: findings.filter((finding) => finding.severity === "BLOCKER").length,
    high: findings.filter((finding) => finding.severity === "HIGH").length,
    medium: findings.filter((finding) => finding.severity === "MEDIUM").length,
    low: findings.filter((finding) => finding.severity === "LOW").length,
    total: findings.length
  };
}

export function decideVerdict(findings: Finding[]): Verdict {
  if (findings.some((finding) => finding.severity === "BLOCKER")) {
    return "DO-NOT-SHIP";
  }

  if (findings.some((finding) => finding.severity === "HIGH")) {
    return "SHIP-WITH-WARNINGS";
  }

  return "SHIP";
}
