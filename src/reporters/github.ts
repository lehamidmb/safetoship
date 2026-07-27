import type { Finding, RuleFamily, ScanResult, Verdict } from "../types.js";

export const GITHUB_COMMENT_MARKER = "<!-- safetoship-report -->";

const MAX_PRIORITY_FINDINGS = 12;
const MAX_REPAIR_PROMPTS = 3;

const FAMILY_LABELS: Record<RuleFamily, string> = {
  "abuse-cost": "Cost and abuse controls",
  technical: "Technical controls",
  "legal-compliance": "Legal and launch requirements",
  engine: "External scanner findings",
  quick: "Quick-scan findings"
};

const VERDICT_GUIDANCE: Record<Verdict, string> = {
  SHIP: "No active launch findings were detected by the checks that ran.",
  "SHIP-WITH-WARNINGS": "Review the warnings before launch and record any accepted risk.",
  "DO-NOT-SHIP": "Resolve the launch blockers before merging or deploying."
};

export function renderGitHubComment(result: ScanResult): string {
  const lines = [
    GITHUB_COMMENT_MARKER,
    "",
    `## SafeToShip: ${result.verdict}`,
    "",
    VERDICT_GUIDANCE[result.verdict],
    "",
    "| Blockers | High | Medium | Low | Accepted risks |",
    "| ---: | ---: | ---: | ---: | ---: |",
    `| ${result.summary.blockers} | ${result.summary.high} | ${result.summary.medium} | ${result.summary.low} | ${result.summary.suppressed} |`,
    ""
  ];

  const allPriority = result.findings
    .filter((finding) => finding.severity === "BLOCKER" || finding.severity === "HIGH")
    .sort((left, right) => severityRank(left) - severityRank(right));
  const priority = allPriority.slice(0, MAX_PRIORITY_FINDINGS);

  if (priority.length > 0) {
    lines.push("### Priority fixes by area", "");
    for (const [family, findings] of groupByFamily(priority)) {
      lines.push(`#### ${FAMILY_LABELS[family]} (${findings.length})`, "");
      for (const finding of findings) {
        const review = finding.needsReview ? " — **NEEDS REVIEW**" : "";
        lines.push(
          `- **${finding.severity}** · ${finding.title} — \`${locationFor(finding)}\` (\`${finding.id}\`)${review}`
        );
      }
      lines.push("");
    }

    const omitted = allPriority.length - priority.length;
    if (omitted > 0) {
      lines.push(`_${omitted} additional priority ${pluralize("finding", omitted)} in the full report._`, "");
    }

    lines.push("### Agent-ready repairs", "");
    for (const [index, finding] of priority.slice(0, MAX_REPAIR_PROMPTS).entries()) {
      lines.push(
        "<details>",
        `<summary>${index + 1}. ${finding.id}: ${finding.title}</summary>`,
        "",
        "```text",
        safeCodeFence(finding.fixPrompt),
        "```",
        "",
        "</details>",
        ""
      );
    }
  } else if (result.findings.length > 0) {
    lines.push("No blocker or high-severity findings. Review the remaining warnings in the full report.", "");
  }

  if (result.summary.suppressed > 0) {
    lines.push(
      `> ${result.summary.suppressed} accepted ${pluralize("risk", result.summary.suppressed)} remain visible in the full report.`,
      ""
    );
  }

  lines.push(
    "---",
    "The full Markdown report remains available as the `safetoship-report` workflow artifact; SARIF remains available in code scanning."
  );

  return lines.join("\n");
}

function groupByFamily(findings: Finding[]): Array<[RuleFamily, Finding[]]> {
  const groups = new Map<RuleFamily, Finding[]>();
  for (const finding of findings) {
    const group = groups.get(finding.family) ?? [];
    group.push(finding);
    groups.set(finding.family, group);
  }
  return [...groups.entries()];
}

function locationFor(finding: Finding): string {
  if (!finding.file) return "project";
  const location = `${finding.file}${finding.line ? `:${finding.line}` : ""}`;
  return location.replaceAll("`", "'");
}

function safeCodeFence(value: string): string {
  return value.replaceAll("```", "` ` `");
}

function severityRank(finding: Finding): number {
  return finding.severity === "BLOCKER" ? 0 : 1;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
