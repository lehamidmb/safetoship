import type { FindingSnapshot, ScanDelta, ScanResult, Severity } from "./types.js";

interface BaselineDocument {
  schemaVersion: 1 | 2;
  findings: FindingSnapshot[];
}

export function applyBaseline(result: ScanResult, rawBaseline: string, source: string): ScanResult {
  const baseline = parseBaseline(rawBaseline);
  const previous = new Map(baseline.findings.map((finding) => [finding.fingerprint, finding]));
  const current = new Map(result.findings.map((finding) => {
    if (!finding.fingerprint) {
      throw new Error(`Finding ${finding.id} is missing a fingerprint.`);
    }
    return [finding.fingerprint, snapshot(finding)];
  }));

  const newFindings = [...current.entries()]
    .filter(([fingerprint]) => !previous.has(fingerprint))
    .map(([, finding]) => finding);
  const resolvedFindings = [...previous.entries()]
    .filter(([fingerprint]) => !current.has(fingerprint))
    .map(([, finding]) => finding);
  const unchangedFingerprints = [...current.keys()].filter((fingerprint) => previous.has(fingerprint)).sort();

  const delta: ScanDelta = {
    baseline: { schemaVersion: baseline.schemaVersion, source },
    counts: {
      new: newFindings.length,
      resolved: resolvedFindings.length,
      unchanged: unchangedFingerprints.length
    },
    newFindings,
    resolvedFindings,
    unchangedFingerprints
  };

  return { ...result, delta };
}

function parseBaseline(raw: string): BaselineDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Baseline is not valid JSON.");
  }

  if (!isRecord(parsed) || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2)) {
    throw new Error("Baseline must be SafeToShip JSON with schemaVersion 1 or 2.");
  }
  if (!Array.isArray(parsed.findings)) {
    throw new Error("Baseline is missing its findings array.");
  }

  return {
    schemaVersion: parsed.schemaVersion,
    findings: parsed.findings.map((finding, index) => parseFinding(finding, index))
  };
}

function parseFinding(value: unknown, index: number): FindingSnapshot {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.fingerprint !== "string" ||
      typeof value.title !== "string" || typeof value.severity !== "string") {
    throw new Error(`Baseline finding ${index + 1} is malformed.`);
  }
  if (!/^[a-f0-9]{16}$/.test(value.fingerprint)) {
    throw new Error(`Baseline finding ${index + 1} has an invalid fingerprint.`);
  }

  const severity = value.severity.toUpperCase();
  if (!isSeverity(severity)) {
    throw new Error(`Baseline finding ${index + 1} has an invalid severity.`);
  }

  return {
    id: value.id,
    fingerprint: value.fingerprint,
    title: value.title,
    severity,
    file: typeof value.file === "string" ? value.file : undefined,
    line: typeof value.line === "number" ? value.line : undefined
  };
}

function snapshot(finding: ScanResult["findings"][number]): FindingSnapshot {
  return {
    id: finding.id,
    fingerprint: finding.fingerprint!,
    title: finding.title,
    severity: finding.severity,
    file: finding.file,
    line: finding.line
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSeverity(value: string): value is Severity {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "BLOCKER";
}
