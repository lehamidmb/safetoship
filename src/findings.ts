import { createHash } from "node:crypto";
import { metadataFor, RULE_METADATA } from "./ruleMetadata.js";
import type { Confidence, Finding, ProjectFile, SafeToShipConfig, Severity } from "./types.js";

const severityRank: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, BLOCKER: 3 };
const confidenceRank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function applyFindingPolicy(
  rawFindings: Finding[],
  files: ProjectFile[],
  config: SafeToShipConfig,
  suppressionFiles: ProjectFile[] = files
): { findings: Finding[]; acceptedRisks: Finding[]; warnings: string[] } {
  const warnings: string[] = [];
  const findings: Finding[] = [];
  const acceptedRisks: Finding[] = [];
  const fileMap = new Map(files.map((file) => [file.relativePath, file]));
  const suppressionFileMap = new Map(suppressionFiles.map((file) => [file.relativePath, file]));
  const matchedAcceptedRiskFingerprints = new Set<string>();

  const all = [...rawFindings, ...invalidSuppressionFindings(suppressionFiles)];
  for (const raw of all) {
    const metadata = metadataFor(raw.id);
    const finding: Finding = {
      ...raw,
      confidence: raw.confidence ?? metadata.confidence,
      confidenceRationale: raw.confidenceRationale ?? metadata.confidenceRationale,
      provenance: raw.provenance ?? (raw.family === "engine" ? "engine" : "source")
    };
    finding.fingerprint = fingerprintFor(finding, fileMap);

    const override = config.rules[finding.id];
    const overrideReason = validReason(override?.reason);
    const hasRiskOverride = override?.enabled === false || Boolean(override?.severity) || Boolean(override?.confidence);
    const canApplyOverride = !hasRiskOverride || Boolean(overrideReason);

    if (hasRiskOverride && !overrideReason) {
      warnings.push(`Ignored risk override for ${finding.id}: add a reason of at least 10 characters.`);
    }

    if (canApplyOverride && override?.severity) {
      if (severityRank[override.severity] <= severityRank[finding.severity]) {
        finding.severity = override.severity;
      } else {
        warnings.push(`Ignored upward severity override for ${finding.id}.`);
      }
    }
    if (canApplyOverride && override?.confidence && finding.confidence) {
      if (confidenceRank[override.confidence] <= confidenceRank[finding.confidence]) {
        finding.confidence = override.confidence;
      } else {
        warnings.push(`Ignored upward confidence override for ${finding.id}.`);
      }
    }

    const inlineReason = inlineSuppressionReason(finding, suppressionFileMap);
    const fingerprintReason = finding.fingerprint
      ? config.acceptedRisks[finding.fingerprint]
      : undefined;
    if (fingerprintReason && finding.fingerprint) {
      matchedAcceptedRiskFingerprints.add(finding.fingerprint);
    }
    const configDisabled = canApplyOverride && override?.enabled === false;
    if (inlineReason || fingerprintReason || configDisabled) {
      finding.suppressionReason = inlineReason ?? fingerprintReason ?? overrideReason;
      acceptedRisks.push(finding);
      continue;
    }

    finding.needsReview = finding.confidence === "medium" && finding.severity === "BLOCKER";
    findings.push(finding);
  }

  for (const fingerprint of Object.keys(config.acceptedRisks)) {
    if (!matchedAcceptedRiskFingerprints.has(fingerprint)) {
      warnings.push(`Accepted-risk fingerprint ${fingerprint} did not match a finding in this scan.`);
    }
  }

  return { findings, acceptedRisks, warnings };
}

export function fingerprintFor(finding: Finding, files?: Map<string, ProjectFile>): string {
  const sourceLine = finding.file && finding.line
    ? files?.get(finding.file)?.lines[finding.line - 1]?.trim().replace(/\s+/g, " ")
    : undefined;
  const identity = [finding.id, finding.file ?? "project", sourceLine || finding.title].join("\u0000");
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

function inlineSuppressionReason(finding: Finding, files: Map<string, ProjectFile>): string | undefined {
  if (!finding.file || !finding.line) return undefined;
  const file = files.get(finding.file);
  if (!file) return undefined;
  for (const lineNumber of [finding.line, finding.line - 1]) {
    if (lineNumber < 1) continue;
    const line = file.lines[lineNumber - 1] ?? "";
    const match = line.match(new RegExp(`safetoship-ignore\\s+${escapeRegex(finding.id)}\\s+reason=(?:"([^"]+)"|'([^']+)')`));
    const reason = validReason(match?.[1] ?? match?.[2]);
    if (reason) return reason;
  }
  return undefined;
}

function invalidSuppressionFindings(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    file.lines.forEach((line, index) => {
      if (!line.includes("safetoship-ignore")) return;
      const match = line.match(/safetoship-ignore\s+([A-Z0-9-]+)/);
      if (!match) return;
      const reasonMatch = line.match(/reason=(?:"([^"]+)"|'([^']+)')/);
      const reason = validReason(reasonMatch?.[1] ?? reasonMatch?.[2]);
      if (reason && RULE_METADATA.has(match[1])) return;
      const problem = RULE_METADATA.has(match[1])
        ? `has no reason of at least 10 characters`
        : `names unknown rule ${match[1]}`;
      findings.push({
        id: "STS-META-001",
        title: "SafeToShip suppression is invalid",
        severity: "MEDIUM",
        family: "technical",
        file: file.relativePath,
        line: index + 1,
        why: `This suppression ${problem}, so SafeToShip did not use it to accept a risk.`,
        fixPrompt: `Use a documented SafeToShip rule ID, add reason="a concrete justification of at least 10 characters", or remove this suppression.`
      });
    });
  }
  return findings;
}

function validReason(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length >= 10 ? trimmed : undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
