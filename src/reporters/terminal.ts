import pc from "picocolors";
import { LEGAL_BANNER } from "../scope.js";
import type { Finding, ScanResult, Severity, Verdict } from "../types.js";

export function renderTerminal(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`${pc.bold("ShipVerdict")} ${pc.dim(result.version)}  ${pc.dim(result.targetDir)}`);
  lines.push(`${renderVerdict(result.verdict)}  ${summaryText(result)}`);
  lines.push("");
  lines.push(pc.yellow(`Legal/compliance banner: ${LEGAL_BANNER}`));

  if (result.engineStatuses.length > 0) {
    lines.push("");
    lines.push(pc.bold("Engine Status"));
    for (const status of result.engineStatuses) {
      const color = status.status === "ran" ? pc.green : status.status === "skipped" ? pc.yellow : pc.red;
      lines.push(`- ${status.name}: ${color(status.status)} - ${status.message}`);
    }
  }

  if (result.findings.length > 0) {
    lines.push("");
    lines.push(pc.bold("Findings"));
    for (const finding of result.findings) {
      lines.push(renderFinding(finding));
    }
  } else {
    lines.push("");
    lines.push(pc.green("No findings. Keep this boring and keep shipping carefully."));
  }

  lines.push("");
  lines.push(pc.bold("What This Does NOT Check Yet"));
  for (const limit of result.limits) {
    lines.push(`- ${limit}`);
  }

  return `${lines.join("\n")}\n`;
}

function renderFinding(finding: Finding): string {
  const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""}` : "project";
  return [
    `\n${severityLabel(finding.severity)} ${pc.bold(finding.title)} ${pc.dim(`[${finding.id}]`)}`,
    `  ${pc.dim(location)}`,
    `  Why: ${finding.why}`,
    indent(finding.fixPrompt, "  ")
  ].join("\n");
}

function renderVerdict(verdict: Verdict): string {
  if (verdict === "DO-NOT-SHIP") {
    return pc.bgRed(pc.white(pc.bold(" DO-NOT-SHIP ")));
  }

  if (verdict === "SHIP-WITH-WARNINGS") {
    return pc.bgYellow(pc.black(pc.bold(" SHIP-WITH-WARNINGS ")));
  }

  return pc.bgGreen(pc.black(pc.bold(" SHIP ")));
}

function severityLabel(severity: Severity): string {
  if (severity === "BLOCKER") {
    return pc.red(pc.bold("[BLOCKER]"));
  }
  if (severity === "HIGH") {
    return pc.yellow(pc.bold("[HIGH]"));
  }
  if (severity === "MEDIUM") {
    return pc.cyan(pc.bold("[MEDIUM]"));
  }
  return pc.dim("[LOW]");
}

function summaryText(result: ScanResult): string {
  const summary = result.summary;
  return `${summary.total} finding(s): ${summary.blockers} blocker, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`;
}

function indent(value: string, prefix: string): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}
