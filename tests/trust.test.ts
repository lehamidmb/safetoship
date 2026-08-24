import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scan } from "../src/scan.js";
import { renderJson } from "../src/reporters/json.js";
import { renderMarkdown } from "../src/reporters/markdown.js";

describe("SafeToShip trust contract", () => {
  it("enriches every finding with confidence and a stable fingerprint", async () => {
    const result = await scan({
      targetDir: path.resolve("fixtures/insecure-next-supabase"),
      mode: "audit",
      runEngines: false
    });

    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(["low", "medium", "high"]).toContain(finding.confidence);
      expect(finding.confidenceRationale?.length).toBeGreaterThan(10);
      expect(finding.fingerprint).toMatch(/^[a-f0-9]{16}$/);
    }
  });

  it("keeps a finding fingerprint stable when its source line moves", async () => {
    await withProject(async (root) => {
      const vulnerableLine = 'const key = "sk-fake-demo-key-do-not-use";';
      await write(root, "components/Client.tsx", `"use client";\n${vulnerableLine}\n`);
      const before = await scan({ targetDir: root, mode: "audit", runEngines: false });

      await write(root, "components/Client.tsx", `\n\n"use client";\n${vulnerableLine}\n`);
      const after = await scan({ targetDir: root, mode: "audit", runEngines: false });

      const beforeFinding = before.findings.find((finding) => finding.id === "STS-COST-002");
      const afterFinding = after.findings.find((finding) => finding.id === "STS-COST-002");
      expect(afterFinding?.line).not.toBe(beforeFinding?.line);
      expect(afterFinding?.fingerprint).toBe(beforeFinding?.fingerprint);
    });
  });

  it("moves a reasoned inline suppression into accepted risks", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        // safetoship-ignore STS-COST-002 reason="documented fake credential used in a test"
        const key = "sk-fake-demo-key-do-not-use";
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(result.findings.some((finding) => finding.id === "STS-COST-002")).toBe(false);
      expect(result.acceptedRisks.some((finding) => finding.id === "STS-COST-002")).toBe(true);
      expect(result.summary.suppressed).toBe(1);
    });
  });

  it("reports an unjustified suppression instead of silently honoring it", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        // safetoship-ignore STS-COST-002
        const key = "sk-fake-demo-key-do-not-use";
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(result.findings.some((finding) => finding.id === "STS-COST-002")).toBe(true);
      expect(result.findings.some((finding) => finding.id === "STS-META-001")).toBe(true);
    });
  });

  it("reports an unknown inline suppression rule", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        // safetoship-ignore STS-NOT-A-RULE reason="reviewed exception for a real control"
        const key = "sk-fake-demo-key-do-not-use";
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(result.findings.some((finding) => finding.id === "STS-COST-002")).toBe(true);
      expect(result.findings.some((finding) => finding.id === "STS-META-001")).toBe(true);
    });
  });

  it("supports visible repository-level accepted risks and downward overrides", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        const key = "sk-fake-demo-key-do-not-use";
      `);
      await write(root, ".safetoshiprc.json", JSON.stringify({
        rules: {
          "STS-COST-002": {
            enabled: false,
            reason: "provider confirms this documented key is not live"
          }
        }
      }));

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(result.verdict).not.toBe("DO-NOT-SHIP");
      expect(result.acceptedRisks[0]?.suppressionReason).toContain("not live");
    });
  });

  it("does not honor unexplained repository risk overrides", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        const key = "sk-fake-demo-key-do-not-use";
      `);
      await write(root, ".safetoshiprc.json", JSON.stringify({
        rules: {
          "STS-COST-002": { enabled: false }
        }
      }));

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(result.findings.some((finding) => finding.id === "STS-COST-002")).toBe(true);
      expect(result.acceptedRisks).toHaveLength(0);
      expect(result.warnings).toContain(
        "Ignored risk override for STS-COST-002: add a reason of at least 10 characters."
      );
    });
  });

  it("warns about unknown or malformed repository overrides", async () => {
    await withProject(async (root) => {
      await write(root, ".safetoshiprc.json", JSON.stringify({
        rules: {
          "STS-NOT-A-RULE": { enabled: false, reason: "reviewed exception" },
          "STS-COST-002": { severity: "urgent", confidence: "certain" }
        }
      }));

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(result.warnings).toContain(".safetoshiprc.json: ignored unknown rule STS-NOT-A-RULE.");
      expect(result.warnings).toContain(".safetoshiprc.json: ignored invalid severity for STS-COST-002.");
      expect(result.warnings).toContain(".safetoshiprc.json: ignored invalid confidence for STS-COST-002.");
    });
  });

  it("keeps release versions and plugin surfaces aligned", async () => {
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
    const plugin = JSON.parse(await readFile(path.resolve("plugins/safetoship/.codex-plugin/plugin.json"), "utf8"));
    const marketplace = JSON.parse(await readFile(path.resolve(".agents/plugins/marketplace.json"), "utf8"));
    const action = await readFile(path.resolve("action.yml"), "utf8");
    const skill = await readFile(path.resolve("plugins/safetoship/skills/safetoship/SKILL.md"), "utf8");
    const schema = JSON.parse(await readFile(path.resolve("docs/schema/v1.json"), "utf8"));

    expect(packageJson.version).toBe("0.2.0");
    expect(plugin.version).toBe(packageJson.version);
    expect(marketplace.plugins[0].source.path).toBe("./plugins/safetoship");
    expect(action).toContain(`safetoship@${packageJson.version}`);
    expect(skill).toContain(`safetoship@${packageJson.version}`);
    expect(schema.properties.schemaVersion.const).toBe(1);
  });

  it("publishes versioned JSON and concise Markdown contracts", async () => {
    const result = await scan({
      targetDir: path.resolve("fixtures/insecure-next-supabase"),
      mode: "audit",
      runEngines: false
    });
    const json = JSON.parse(renderJson(result));
    const markdown = renderMarkdown(result);

    expect(json.schemaVersion).toBe(1);
    expect(json.tool).toEqual({ name: "safetoship", version: "0.2.0" });
    expect(json.target.path).toBe("fixtures/insecure-next-supabase");
    expect(markdown).not.toContain(os.homedir());
    expect(json.findings[0].fingerprint).toMatch(/^[a-f0-9]{16}$/);
    expect(markdown).toContain("## What To Fix First");
    expect(markdown).toContain("<details>");
  });

  it("uses only local Semgrep rules with metrics disabled", async () => {
    const source = await readFile(path.resolve("src/engines.ts"), "utf8");
    expect(source).not.toContain('["--config", "auto"');
    expect(source).toContain('"--metrics", "off"');
    expect(source).toContain("rules/semgrep/safetoship.yml");
  });

  it("pins third-party GitHub Actions to immutable commit SHAs", async () => {
    const workflow = await readFile(path.resolve(".github/workflows/safetoship.yml"), "utf8");
    const actionLines = workflow.split("\n").filter((line) => line.includes("uses:"));

    expect(actionLines.length).toBeGreaterThan(0);
    for (const line of actionLines) {
      const action = line.match(/uses:\s+([^\s#]+)/)?.[1];
      const versionComment = line.match(/#\s+(v\d+\.\d+\.\d+)\s*$/)?.[1];
      expect(action).toMatch(/^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)?@[a-f0-9]{40}$/);
      expect(versionComment).toBeDefined();
    }
  });
});

async function withProject(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "safetoship-trust-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function write(root: string, relativePath: string, content: string): Promise<void> {
  const destination = path.join(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}
