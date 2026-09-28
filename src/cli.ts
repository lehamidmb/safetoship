#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { scan, VERSION } from "./scan.js";
import { applyBaseline } from "./baseline.js";
import { writeLaunchPacket } from "./packet.js";
import { createHardeningPlan, renderHardeningResult } from "./hardening.js";
import { renderMarkdown } from "./reporters/markdown.js";
import { renderJson } from "./reporters/json.js";
import { renderGitHubComment } from "./reporters/github.js";
import { renderSarif } from "./reporters/sarif.js";
import { renderTerminal } from "./reporters/terminal.js";
import type { ScanResult, Verdict } from "./types.js";
import { metadataFor, RULE_METADATA } from "./ruleMetadata.js";

interface CliOptions {
  json?: boolean;
  sarif?: string;
  markdown?: string;
  githubComment?: string;
  failOn?: string;
  engines?: boolean;
  exclude?: string[];
  build?: boolean;
}

interface LaunchOptions extends CliOptions {
  output?: string;
  baseline?: string;
}

const program = new Command();

program
  .name("safetoship")
  .description("Deterministic launch-readiness gate for AI-generated apps.")
  .version(VERSION);

program
  .command("audit")
  .argument("[target]", "repo or app directory to scan", ".")
  .option("--json", "print JSON instead of terminal output")
  .option("--sarif <file>", "write SARIF output to a file")
  .option("--markdown <file>", "write a Markdown report to a file")
  .option("--github-comment <file>", "write a concise GitHub PR comment to a file")
  .option("--fail-on <level>", "exit non-zero on do-not-ship, warnings, or never", "do-not-ship")
  .option("--no-engines", "skip optional gitleaks, semgrep, and osv-scanner wrappers")
  .option("--build", "run the package build and scan recognized generated frontend assets")
  .option("--exclude <patterns>", "comma-separated paths to exclude in addition to defaults", splitCsv, [])
  .action(async (target: string, options: CliOptions) => {
    validateFailOn(options.failOn);
    const result = await scan({
      targetDir: target,
      mode: "audit",
      runEngines: options.engines !== false,
      excludes: options.exclude ?? [],
      build: options.build === true
    });
    await writeOutputs(result, options);
    exitForVerdict(result.verdict, options.failOn);
  });

program
  .command("explain")
  .argument("<rule-id>", "SafeToShip rule ID, for example STS-COST-006")
  .description("Explain a rule, its confidence, and how to accept a reviewed risk.")
  .action((ruleId: string) => {
    const normalized = ruleId.toUpperCase();
    if (!RULE_METADATA.has(normalized)) {
      throw new Error(`Unknown SafeToShip rule: ${normalized}`);
    }
    const metadata = metadataFor(normalized);
    process.stdout.write([
      `${metadata.id} - ${metadata.checks}`,
      `Default severity: ${metadata.defaultSeverity}`,
      `Confidence: ${metadata.confidence}`,
      `Why this confidence: ${metadata.confidenceRationale}`,
      `Known false positives: ${metadata.knownFalsePositives}`,
      "",
      `Inline suppression: // safetoship-ignore ${metadata.id} reason=\"explain the accepted risk here\"`,
      `Finding-scoped config: {\"acceptedRisks\":{\"<finding-fingerprint>\":\"explain the accepted risk here\"}}`,
      `Whole-rule config: {\"rules\":{\"${metadata.id}\":{\"enabled\":false,\"reason\":\"explain the accepted risk here\"}}}`
    ].join("\n") + "\n");
  });

program
  .command("launch")
  .argument("[target]", "repo or app directory to scan", ".")
  .description("Create a portable pre-launch evidence packet.")
  .option("--output <directory>", "write the packet to this directory")
  .option("--baseline <file>", "compare against a previous SafeToShip findings.json")
  .option("--fail-on <level>", "exit non-zero on do-not-ship, warnings, or never", "do-not-ship")
  .option("--no-engines", "skip optional gitleaks, semgrep, and osv-scanner wrappers")
  .option("--build", "run the package build and scan recognized generated frontend assets")
  .option("--exclude <patterns>", "comma-separated paths to exclude in addition to defaults", splitCsv, [])
  .action(async (target: string, options: LaunchOptions) => {
    validateFailOn(options.failOn);
    const targetDir = path.resolve(target);
    let result = await scan({
      targetDir,
      mode: "audit",
      runEngines: options.engines !== false,
      excludes: options.exclude ?? [],
      build: options.build === true
    });

    if (options.baseline) {
      const baselinePath = path.resolve(options.baseline);
      const baseline = await fs.readFile(baselinePath, "utf8");
      result = applyBaseline(result, baseline, portablePath(baselinePath));
    }

    const outputDir = options.output ? path.resolve(options.output) : path.join(targetDir, ".safetoship", "latest");
    await writeLaunchPacket(result, outputDir);
    process.stdout.write(renderTerminal(result));
    process.stdout.write(`\nLaunch packet: ${portablePath(outputDir)}\n`);
    exitForVerdict(result.verdict, options.failOn);
  });

program
  .command("fix")
  .argument("[target]", "repo or app directory to harden", ".")
  .description("Generate an agent-ready launch hardening plan, with optional safe autofixes.")
  .option("--apply-safe", "apply deterministic safe fixes and write the hardening plan")
  .option("--json", "print JSON instead of terminal output")
  .option("--no-engines", "skip optional gitleaks, semgrep, and osv-scanner wrappers")
  .option("--exclude <patterns>", "comma-separated paths to exclude in addition to defaults", splitCsv, [])
  .action(async (target: string, options: CliOptions & { applySafe?: boolean }) => {
    const result = await scan({
      targetDir: target,
      mode: "audit",
      runEngines: options.engines !== false,
      excludes: options.exclude ?? []
    });
    const hardening = await createHardeningPlan(result, Boolean(options.applySafe));

    if (options.json) {
      process.stdout.write(`${JSON.stringify({ scan: result, hardening }, null, 2)}\n`);
      return;
    }

    process.stdout.write(renderHardeningResult(hardening));
  });

program
  .command("quick")
  .argument("[target]", "repo or app directory to scan", ".")
  .option("--json", "print JSON instead of terminal output")
  .option("--sarif <file>", "write SARIF output to a file")
  .option("--markdown <file>", "write a Markdown report to a file")
  .option("--github-comment <file>", "write a concise GitHub PR comment to a file")
  .option("--fail-on <level>", "exit non-zero on do-not-ship, warnings, or never", "do-not-ship")
  .option("--exclude <patterns>", "comma-separated paths to exclude in addition to defaults", splitCsv, [])
  .action(async (target: string, options: CliOptions) => {
    const result = await scan({
      targetDir: target,
      mode: "quick",
      runEngines: false,
      excludes: options.exclude ?? []
    });
    await writeOutputs(result, options);
    exitForVerdict(result.verdict, options.failOn);
  });

try {
  await program.parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`SafeToShip error: ${message}\n`);
  process.exitCode = 3;
}

async function writeOutputs(result: ScanResult, options: CliOptions): Promise<void> {
  if (options.sarif) {
    await writeFile(options.sarif, renderSarif(result));
  }

  if (options.markdown) {
    await writeFile(options.markdown, renderMarkdown(result));
  }

  if (options.githubComment) {
    await writeFile(options.githubComment, renderGitHubComment(result));
  }

  if (options.json) {
    process.stdout.write(`${renderJson(result)}\n`);
    return;
  }

  process.stdout.write(renderTerminal(result));
}

async function writeFile(filePath: string, content: string): Promise<void> {
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, `${content.trimEnd()}\n`, "utf8");
}

function exitForVerdict(verdict: Verdict, failOn = "do-not-ship"): void {
  validateFailOn(failOn);
  const normalized = failOn.toLowerCase();
  const shouldFail =
    normalized === "warnings"
      ? verdict === "DO-NOT-SHIP" || verdict === "SHIP-WITH-WARNINGS"
      : normalized === "do-not-ship" && verdict === "DO-NOT-SHIP";

  if (shouldFail) {
    process.exitCode = 1;
  }
}

function validateFailOn(failOn = "do-not-ship"): void {
  if (!["do-not-ship", "warnings", "never"].includes(failOn.toLowerCase())) {
    throw new Error(`Invalid --fail-on value: ${failOn}. Use do-not-ship, warnings, or never.`);
  }
}

function splitCsv(value: string, previous: string[]): string[] {
  return [...previous, ...value.split(",").map((item) => item.trim()).filter(Boolean)];
}

function portablePath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }
  return path.basename(filePath);
}
