import { LEGAL_BANNER } from "../scope.js";
import type { ScanResult } from "../types.js";

export function renderMarkdown(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`# SafeToShip Report`);
  lines.push("");
  lines.push(`**Verdict:** ${result.verdict}`);
  lines.push(`**Target:** \`${result.targetDir}\``);
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
  lines.push("");

  if (result.findings.length > 0) {
    lines.push("## Findings");
    lines.push("");
    for (const finding of result.findings) {
      const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""}` : "project";
      lines.push(`### ${finding.severity}: ${finding.title}`);
      lines.push("");
      lines.push(`- Rule: \`${finding.id}\``);
      lines.push(`- Location: \`${location}\``);
      lines.push(`- Why: ${finding.why}`);
      lines.push("");
      lines.push("```text");
      lines.push(finding.fixPrompt);
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("## What This Does NOT Check Yet");
  lines.push("");
  for (const limit of result.limits) {
    lines.push(`- ${limit}`);
  }
  lines.push("");

  return lines.join("\n");
}
