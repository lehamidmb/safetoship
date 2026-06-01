#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { scan, VERSION } from "./scan.js";
import { renderMarkdown } from "./reporters/markdown.js";
import { renderSarif } from "./reporters/sarif.js";
import { renderTerminal } from "./reporters/terminal.js";
import type { ScanResult, Verdict } from "./types.js";

interface CliOptions {
  json?: boolean;
  sarif?: string;
  markdown?: string;
  failOn?: string;
  engines?: boolean;
  exclude?: string[];
}

const program = new Command();

program
  .name("shipverdict")
  .description("Pre-launch security and compliance gate for AI-generated apps.")
  .version(VERSION);

program
  .command("audit")
  .argument("[target]", "repo or app directory to scan", ".")
  .option("--json", "print JSON instead of terminal output")
  .option("--sarif <file>", "write SARIF output to a file")
  .option("--markdown <file>", "write a Markdown report to a file")
  .option("--fail-on <level>", "exit non-zero on do-not-ship or warnings", "do-not-ship")
  .option("--no-engines", "skip optional gitleaks, semgrep, and osv-scanner wrappers")
  .option("--exclude <patterns>", "comma-separated paths to exclude in addition to defaults", splitCsv, [])
  .action(async (target: string, options: CliOptions) => {
    const result = await scan({
      targetDir: target,
      mode: "audit",
      runEngines: options.engines !== false,
      excludes: options.exclude ?? []
    });
    await writeOutputs(result, options);
    exitForVerdict(result.verdict, options.failOn);
  });

program
  .command("quick")
  .argument("[target]", "repo or app directory to scan", ".")
  .option("--json", "print JSON instead of terminal output")
  .option("--sarif <file>", "write SARIF output to a file")
  .option("--markdown <file>", "write a Markdown report to a file")
  .option("--fail-on <level>", "exit non-zero on do-not-ship or warnings", "do-not-ship")
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

await program.parseAsync();

async function writeOutputs(result: ScanResult, options: CliOptions): Promise<void> {
  if (options.sarif) {
    await writeFile(options.sarif, renderSarif(result));
  }

  if (options.markdown) {
    await writeFile(options.markdown, renderMarkdown(result));
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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
  const normalized = failOn.toLowerCase();
  const shouldFail =
    normalized === "warnings"
      ? verdict === "DO-NOT-SHIP" || verdict === "SHIP-WITH-WARNINGS"
      : normalized === "do-not-ship" && verdict === "DO-NOT-SHIP";

  if (shouldFail) {
    process.exitCode = 1;
  }
}

function splitCsv(value: string, previous: string[]): string[] {
  return [...previous, ...value.split(",").map((item) => item.trim()).filter(Boolean)];
}
