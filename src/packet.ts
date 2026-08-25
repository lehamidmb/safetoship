import { promises as fs } from "node:fs";
import path from "node:path";
import { reportTarget } from "./reportTarget.js";
import { renderJson } from "./reporters/json.js";
import { renderMarkdown } from "./reporters/markdown.js";
import type { ScanResult } from "./types.js";

export const PACKET_FILES = ["report.md", "findings.json", "coverage.json", "manifest.json"] as const;

export async function writeLaunchPacket(result: ScanResult, outputDir: string): Promise<string[]> {
  const resolved = path.resolve(outputDir);
  await fs.mkdir(resolved, { recursive: true });

  const coverage = {
    schemaVersion: 1,
    tool: { name: "safetoship", version: result.version },
    target: { path: reportTarget(result.targetDir), scannedAt: result.generatedAt },
    mode: result.mode,
    coverage: result.coverage,
    warnings: result.warnings,
    limits: result.limits
  };
  const manifest = {
    packetVersion: 1,
    tool: { name: "safetoship", version: result.version },
    target: reportTarget(result.targetDir),
    generatedAt: result.generatedAt,
    verdict: result.verdict,
    baseline: result.delta?.baseline ?? null,
    artifacts: [...PACKET_FILES]
  };
  const files = new Map<string, string>([
    ["report.md", renderMarkdown(result)],
    ["findings.json", renderJson(result)],
    ["coverage.json", JSON.stringify(coverage, null, 2)],
    ["manifest.json", JSON.stringify(manifest, null, 2)]
  ]);

  await Promise.all([...files].map(async ([name, content]) => {
    await fs.writeFile(path.join(resolved, name), `${content.trimEnd()}\n`, "utf8");
  }));

  return [...PACKET_FILES].map((name) => path.join(resolved, name));
}
