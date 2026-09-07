import path from "node:path";
import { loadConfig } from "./config.js";
import { applyFindingPolicy } from "./findings.js";
import { buildAndCollectFrontendAssets } from "./build.js";
import { collectProjectFiles, defaultExcludes } from "./project.js";
import { runEngines } from "./engines.js";
import { runBuiltAssetRules, runTechnicalRules } from "./rules/technical.js";
import { runAbuseCostRules } from "./rules/abuseCost.js";
import { runLegalRules } from "./rules/legal.js";
import { runQuickRules } from "./rules/quick.js";
import { scopeLimits } from "./scope.js";
import { RULE_METADATA } from "./ruleMetadata.js";
import type { EngineStatus, Finding, ScanOptions, ScanResult } from "./types.js";
import { decideVerdict, summarize } from "./verdict.js";

export const VERSION = "0.3.0";

export async function scan(options: Partial<ScanOptions> & { targetDir: string; mode: "audit" | "quick" }): Promise<ScanResult> {
  const targetDir = path.resolve(options.targetDir);
  const buildRequested = options.mode === "audit" && options.build === true;
  const { config, warnings: configWarnings } = await loadConfig(targetDir);
  const requestedExcludes = [...config.exclude, ...(options.excludes ?? [])];
  const buildResult = buildRequested ? await buildAndCollectFrontendAssets(targetDir, requestedExcludes) : null;
  const excludes = [...defaultExcludes(), ...requestedExcludes];
  const files = await collectProjectFiles(targetDir, excludes);
  const engineStatuses: EngineStatus[] = [];
  const findings: Finding[] = [];
  const enginesRequested = options.mode === "audit" && options.runEngines !== false;

  if (options.mode === "quick") {
    findings.push(...runQuickRules(files));
  } else {
    findings.push(...runAbuseCostRules(files));
    findings.push(...runLegalRules(files));
    findings.push(...runTechnicalRules(files));
    if (buildResult) {
      findings.push(...runBuiltAssetRules(buildResult.files));
    }

    if (enginesRequested) {
      const engineResult = runEngines(targetDir);
      findings.push(...engineResult.findings);
      engineStatuses.push(...engineResult.statuses);
    }
  }

  const policy = applyFindingPolicy(findings, [...files, ...(buildResult?.files ?? [])], config);
  const warnings = [...configWarnings, ...policy.warnings];
  if (buildResult && buildResult.files.length === 0) {
    warnings.push("Build completed, but no supported frontend assets were found in .next/static, dist, build/static, or out.");
  }
  if (buildResult && buildResult.skippedLargeFiles > 0) {
    warnings.push(`Build scan skipped ${buildResult.skippedLargeFiles} asset(s) larger than 20 MB.`);
  }
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
    coverage: {
      scannedFiles: files.length,
      evaluatedRules: evaluatedRuleIds(options.mode, buildRequested),
      excludedPaths: [...new Set(excludes)].sort(),
      build: buildResult ? {
        requested: true,
        status: buildResult.files.length > 0 ? "completed" : "no-supported-output",
        command: buildResult.command,
        scannedFiles: buildResult.files.length,
        outputPaths: buildResult.outputPaths,
        skippedLargeFiles: buildResult.skippedLargeFiles
      } : {
        requested: false,
        status: "not-requested",
        command: null,
        scannedFiles: 0,
        outputPaths: [],
        skippedLargeFiles: 0
      },
      externalEngines: {
        requested: enginesRequested,
        statuses: engineStatuses
      }
    },
    delta: null,
    limits: scopeLimits(buildRequested),
    warnings: [...new Set(warnings)]
  };
}

function evaluatedRuleIds(mode: "audit" | "quick", buildRequested: boolean): string[] {
  const prefixes = mode === "quick" ? ["STS-QUICK-", "STS-META-"] : ["STS-COST-", "STS-LEGAL-", "STS-TECH-", "STS-META-"];
  return [...RULE_METADATA.keys()]
    .filter((id) => prefixes.some((prefix) => id.startsWith(prefix)))
    .filter((id) => buildRequested || id !== "STS-TECH-006")
    .sort();
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
