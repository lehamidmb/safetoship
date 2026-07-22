import path from "node:path";
import { loadConfig } from "./config.js";
import { applyFindingPolicy } from "./findings.js";
import { collectProjectFiles, defaultExcludes } from "./project.js";
import { runEngines } from "./engines.js";
import { runTechnicalRules } from "./rules/technical.js";
import { runAbuseCostRules } from "./rules/abuseCost.js";
import { runLegalRules } from "./rules/legal.js";
import { runQuickRules } from "./rules/quick.js";
import { HONEST_SCOPE_LIMITS } from "./scope.js";
import type { EngineStatus, Finding, ScanOptions, ScanResult } from "./types.js";
import { decideVerdict, summarize } from "./verdict.js";

export const VERSION = "0.2.0";

export async function scan(options: Partial<ScanOptions> & { targetDir: string; mode: "audit" | "quick" }): Promise<ScanResult> {
  const targetDir = path.resolve(options.targetDir);
  const { config, warnings: configWarnings } = await loadConfig(targetDir);
  const excludes = [...defaultExcludes(), ...config.exclude, ...(options.excludes ?? [])];
  const files = await collectProjectFiles(targetDir, excludes);
  const engineStatuses: EngineStatus[] = [];
  const findings: Finding[] = [];

  if (options.mode === "quick") {
    findings.push(...runQuickRules(files));
  } else {
    findings.push(...runAbuseCostRules(files));
    findings.push(...runLegalRules(files));
    findings.push(...runTechnicalRules(files));

    if (options.runEngines !== false) {
      const engineResult = runEngines(targetDir);
      findings.push(...engineResult.findings);
      engineStatuses.push(...engineResult.statuses);
    }
  }

  const policy = applyFindingPolicy(findings, files, config);
  const sortedFindings = sortFindings(policy.findings);
  const acceptedRisks = sortFindings(policy.acceptedRisks);
  const summary = summarize(sortedFindings);
  summary.suppressed = acceptedRisks.length;

  return {
    tool: "safetoship",
    version: VERSION,
    generatedAt: new Date().toISOString(),
    targetDir,
    mode: options.mode,
    verdict: decideVerdict(sortedFindings),
    summary,
    findings: sortedFindings,
    acceptedRisks,
    engineStatuses,
    limits: HONEST_SCOPE_LIMITS,
    warnings: [...new Set([...configWarnings, ...policy.warnings])]
  };
}

function sortFindings(findings: Finding[]): Finding[] {
  const severityRank = new Map([
    ["BLOCKER", 0],
    ["HIGH", 1],
    ["MEDIUM", 2],
    ["LOW", 3]
  ]);
  const confidenceRank = new Map([
    ["high", 0],
    ["medium", 1],
    ["low", 2]
  ]);

  return [...findings].sort((a, b) => {
    const severity = (severityRank.get(a.severity) ?? 9) - (severityRank.get(b.severity) ?? 9);
    if (severity !== 0) {
      return severity;
    }

    const confidence = (confidenceRank.get(a.confidence ?? "medium") ?? 9) -
      (confidenceRank.get(b.confidence ?? "medium") ?? 9);
    if (confidence !== 0) {
      return confidence;
    }

    return `${a.file ?? ""}:${a.line ?? 0}:${a.id}`.localeCompare(`${b.file ?? ""}:${b.line ?? 0}:${b.id}`);
  });
}
