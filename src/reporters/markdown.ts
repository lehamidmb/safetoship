import { LEGAL_BANNER } from "../scope.js";
import { reportTarget } from "../reportTarget.js";
import type { ScanResult } from "../types.js";

export function renderMarkdown(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`# SafeToShip Report`);
  lines.push("");
  lines.push(`**Verdict:** ${result.verdict}`);
  lines.push(`**Target:** \`${reportTarget(result.targetDir)}\``);
  lines.push(`**Generated:** ${result.generatedAt}`);
  lines.push("");
  lines.push(`> ${LEGAL_BANNER}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Total: ${result.summary.total}`);
  lines.push(`- Blockers: ${result.summary.blockers}`);
  lines.push(`- High: ${result.summary.high}`);
  lines.push(`- Medium: ${result.summary.medium}`);
  lines.push(`- Low: ${result.summary.low}`);
  lines.push(`- Accepted risks: ${result.summary.suppressed}`);
  lines.push("");

  if (result.delta) {
    lines.push("## Since The Baseline");
    lines.push("");
    lines.push(`- Baseline: \`${result.delta.baseline.source}\` (schema v${result.delta.baseline.schemaVersion})`);
    lines.push(`- New: ${result.delta.counts.new}`);
    lines.push(`- Resolved: ${result.delta.counts.resolved}`);
    lines.push(`- Unchanged: ${result.delta.counts.unchanged}`);
    lines.push("");
  }

  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Files scanned: ${result.coverage.scannedFiles}`);
  lines.push(`- Deterministic rules evaluated: ${result.coverage.evaluatedRules.length}`);
  lines.push(`- Build scan requested: ${result.coverage.build.requested ? "yes" : "no"}`);
  if (result.coverage.build.requested) {
    lines.push(`- Build scan status: ${result.coverage.build.status}`);
    lines.push(`- Generated assets scanned: ${result.coverage.build.scannedFiles}`);
    lines.push(`- Build command: \`${result.coverage.build.command}\``);
  }
  lines.push(`- External engines requested: ${result.coverage.externalEngines.requested ? "yes" : "no"}`);
  if (result.coverage.externalEngines.statuses.length > 0) {
    for (const status of result.coverage.externalEngines.statuses) {
      lines.push(`- ${status.name}: ${status.status} - ${status.message}`);
    }
  }
  lines.push("");

  if (result.warnings.length > 0) {
    lines.push("## Scan Warnings", "");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  if (result.findings.length > 0) {
    lines.push("## What To Fix First");
    lines.push("");
    for (const finding of result.findings.slice(0, 3)) {
      const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""}` : "project";
      lines.push(`- **${finding.severity}: ${finding.title}** (\`${location}\`)`);
      lines.push(`  ${finding.why}`);
    }
    lines.push("");
    lines.push("<details>");
    lines.push(`<summary>All technical findings (${result.findings.length})</summary>`);
    lines.push("");
    for (const finding of result.findings) {
      const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""}` : "project";
      lines.push(`### ${finding.severity}: ${finding.title}`);
      lines.push("");
      lines.push(`- Rule: \`${finding.id}\``);
      lines.push(`- Confidence: ${finding.confidence ?? "medium"}${finding.needsReview ? " (needs review)" : ""}`);
      lines.push(`- Location: \`${location}\``);
      lines.push(`- Why: ${finding.why}`);
      lines.push("");
      lines.push("```text");
      lines.push(finding.fixPrompt);
      lines.push("```");
      lines.push("");
    }
    lines.push("</details>");
    lines.push("");
  }

  if (result.acceptedRisks.length > 0) {
    lines.push(`## Accepted Risks (${result.acceptedRisks.length})`);
    lines.push("");
    for (const finding of result.acceptedRisks) {
      lines.push(`- \`${finding.id}\`: ${finding.suppressionReason}`);
    }
    lines.push("");
  }

  lines.push("## What This Does NOT Check Yet");
  lines.push("");
  for (const limit of result.limits) {
    lines.push(`- ${limit}`);
  }
  lines.push("");

  return lines.join("\n");
}
