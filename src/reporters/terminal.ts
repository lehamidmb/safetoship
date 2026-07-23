import pc from "picocolors";
import { reportTarget } from "../reportTarget.js";
import { LEGAL_BANNER } from "../scope.js";
import type { Finding, ScanResult, Severity, Verdict } from "../types.js";

export function renderTerminal(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`${pc.bold("SafeToShip")} ${pc.dim(result.version)}  ${pc.dim(reportTarget(result.targetDir))}`);
  lines.push(`${renderVerdict(result.verdict)}  ${summaryText(result)}`);
  lines.push("");
  lines.push(pc.yellow(`Legal/compliance banner: ${LEGAL_BANNER}`));

  if (result.delta) {
    lines.push("");
    lines.push(pc.bold("Since Baseline"));
    lines.push(`- ${result.delta.counts.new} new, ${result.delta.counts.resolved} resolved, ${result.delta.counts.unchanged} unchanged`);
    lines.push(`- Source: ${result.delta.baseline.source}`);
  }

  if (result.engineStatuses.length > 0) {
    lines.push("");
    lines.push(pc.bold("Engine Status"));
    for (const status of result.engineStatuses) {
      const color = status.status === "ran" ? pc.green : status.status === "skipped" ? pc.yellow : pc.red;
      lines.push(`- ${status.name}: ${color(status.status)} - ${status.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push(pc.bold("Configuration Warnings"));
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }

  lines.push("");
  lines.push(pc.bold("Coverage"));
  lines.push(`- ${result.coverage.scannedFiles} file(s), ${result.coverage.evaluatedRules.length} deterministic rule(s)`);
  if (!result.coverage.externalEngines.requested) {
    lines.push("- External engines: not requested");
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


  if (result.acceptedRisks.length > 0) {
    lines.push("");
    lines.push(pc.bold(`Accepted Risks (${result.acceptedRisks.length})`));
    for (const finding of result.acceptedRisks) {
      const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""}` : "project";
      lines.push(`- ${finding.id} at ${location}: ${finding.suppressionReason}`);
    }
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
    `  Confidence: ${finding.confidence ?? "medium"}${finding.needsReview ? " - NEEDS REVIEW" : ""}`,
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
  const accepted = summary.suppressed > 0 ? `, ${summary.suppressed} accepted risk(s)` : "";
  return `${summary.total} finding(s): ${summary.blockers} blocker, ${summary.high} high, ${summary.medium} medium, ${summary.low} low${accepted}`;
}

function indent(value: string, prefix: string): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}
