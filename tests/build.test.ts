import { execFile, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { buildAndCollectFrontendAssets, runBuild } from "../src/build.js";
import { scan } from "../src/scan.js";
import { renderJson } from "../src/reporters/json.js";
import { renderMarkdown } from "../src/reporters/markdown.js";
import { renderTerminal } from "../src/reporters/terminal.js";

const cli = path.resolve("dist/cli.js");
const exec = promisify(execFile);
const fixtureValue = ["sk", "proj", "testfixture0123456789abcdef"].join("-");

describe("Build scan boundaries", () => {
  it("rejects missing, malformed, and non-object manifests before executing a build", async () => {
    await withProject(async (root) => {
      await expect(buildAndCollectFrontendAssets(root)).rejects.toThrow("requires a package.json");
      for (const manifest of ["{broken", "null", "[]", "42", "{}", '{"scripts":{"build":false}}']) {
        await writeFile(path.join(root, "package.json"), manifest);
        await expect(buildAndCollectFrontendAssets(root)).rejects.toThrow(/--build/);
      }
    });
  });

  it("honors a declared package manager and rejects conflicting or unsupported selection", async () => {
    await withProject(async (root) => {
      await writeBuild(root, "");
      await writeFile(path.join(root, "package-lock.json"), "{}");
      await writeFile(path.join(root, "pnpm-lock.yaml"), "");
      await expect(buildAndCollectFrontendAssets(root)).rejects.toThrow("multiple package managers");
      await writeBuild(root, "", { packageManager: "npm@10.0.0" });
      expect((await buildAndCollectFrontendAssets(root)).command).toBe("npm run build");
      await writeBuild(root, "", { packageManager: "unsupported@1.0.0" });
      await expect(buildAndCollectFrontendAssets(root)).rejects.toThrow("supports only npm");
      await expect(runBuild(path.join(root, "missing-manager"), [], root)).rejects.toThrow("Could not run");
    });
  });

  it("skips output symlinks and their ancestors, while keeping the report inside the target", async () => {
    await withProject(async (root) => {
      const target = path.join(root, "target");
      const outside = path.join(root, "outside");
      await mkdir(target);
      await mkdir(path.join(outside, "static"), { recursive: true });
      await writeFile(path.join(outside, "static", "private.js"), fixtureValue);
      await writeBuild(target, "");
      await symlink(outside, path.join(target, ".next"), "dir");
      await symlink(outside, path.join(target, "dist"), "dir");
      await mkdir(path.join(target, "out"));
      await symlink(path.join(outside, "static", "private.js"), path.join(target, "out", "linked.js"));
      await writeFile(path.join(target, "out", "index.html"), "<p>Public demo</p>");
      const result = await scan({ targetDir: target, mode: "audit", runEngines: false, build: true });
      expect(result.coverage.build.scannedFiles).toBe(1);
      expect(result.coverage.build.skippedSymlinks).toBe(3);
      expect(result.findings.some((finding) => finding.id === "STS-TECH-006")).toBe(false);
      expect(result.warnings.join(" ")).toContain("3 symbolic link(s)");
      for (const rendered of [renderJson(result), renderMarkdown(result), renderTerminal(result)]) {
        expect(rendered).not.toContain(fixtureValue);
        expect(rendered).not.toContain(outside);
        expect(rendered).toContain("symbolic link");
      }
    });
  });

  it("reports skipped large assets and an empty build scan in human-readable reports", async () => {
    await withProject(async (root) => {
      await writeBuild(root, "");
      await mkdir(path.join(root, "dist"));
      await writeFile(path.join(root, "dist", "large.js"), "x".repeat(20_000_001));
      const result = await scan({ targetDir: root, mode: "audit", runEngines: false, build: true });
      expect(result.coverage.build.status).toBe("no-supported-output");
      expect(result.coverage.build.skippedLargeFiles).toBe(1);
      expect(renderMarkdown(result)).toContain("larger than 20 MB");
      expect(renderMarkdown(result)).toContain("no supported frontend assets");
    });
  });

  it("does not accept generated suppression strings but honors reasoned repository overrides", async () => {
    await withProject(async (root) => {
      await writeBuild(root, "");
      await mkdir(path.join(root, "dist", "assets"), { recursive: true });
      const marker = ["safetoship", "ignore"].join("-");
      await writeFile(path.join(root, "dist", "assets", "demo.js"),
        `// ${marker} STS-TECH-006 reason="bundled documentation example"\nconst demo = "${fixtureValue}";`);
      const active = await scan({ targetDir: root, mode: "audit", runEngines: false, build: true });
      expect(active.verdict).toBe("DO-NOT-SHIP");
      expect(active.acceptedRisks).toHaveLength(0);
      await writeFile(path.join(root, ".safetoshiprc.json"), JSON.stringify({
        rules: { "STS-TECH-006": { enabled: false, reason: "reviewed inert fixture value" } }
      }));
      const accepted = await scan({ targetDir: root, mode: "audit", runEngines: false, build: true });
      expect(accepted.acceptedRisks[0]?.id).toBe("STS-TECH-006");
      expect(accepted.acceptedRisks[0]?.suppressionReason).toBe("reviewed inert fixture value");
    });
  });

  it("keeps CLI build logs and generated credentials out of all report formats and launch packets", async () => {
    await withProject(async (root) => {
      await cp(path.resolve("fixtures/built-secret"), root, { recursive: true });
      // Build logs can contain sensitive values even when the scanner redacts its findings.
      const script = await readFile(path.join(root, "build.mjs"), "utf8");
      await writeFile(path.join(root, "build.mjs"), `${script}\nconsole.log(fixtureValue); console.error(fixtureValue);\n`);
      const outputDir = path.join(root, ".safetoship", "test-reports");
      const args = [cli, "audit", root, "--build", "--no-engines", "--fail-on", "never", "--json",
        "--markdown", path.join(outputDir, "report.md"),
        "--sarif", path.join(outputDir, "findings.sarif"),
        "--github-comment", path.join(outputDir, "comment.md")];
      const audit = await exec(process.execPath, args);
      const json = JSON.parse(audit.stdout);
      expect(json.verdict).toBe("DO-NOT-SHIP");
      expect(json.findings[0].file).toBe(".next/static/chunks/demo.js");
      expect(audit.stderr).toBe("");
      expect(audit.stdout).not.toContain(fixtureValue);
      for (const name of ["report.md", "findings.sarif", "comment.md"]) {
        const text = await readFile(path.join(outputDir, name), "utf8");
        expect(text).not.toContain(fixtureValue);
        expect(text).not.toContain(root);
      }
      const launch = await exec(process.execPath, [cli, "launch", root, "--build", "--no-engines", "--fail-on", "never"]);
      expect(launch.stdout).not.toContain(fixtureValue);
      expect(launch.stderr).toBe("");
      for (const name of ["report.md", "findings.json", "coverage.json", "manifest.json"]) {
        const text = await readFile(path.join(root, ".safetoship", "latest", name), "utf8");
        expect(text).not.toContain(fixtureValue);
        expect(text).not.toContain(root);
      }
    });
  });

  it("fails the CLI without a verdict after a failed build or invalid pre-build option", async () => {
    await withProject(async (root) => {
      await writeBuild(root, `console.log("private build output"); process.exit(7);`);
      const failed = await exec(process.execPath, [cli, "audit", root, "--build", "--no-engines", "--json"])
        .catch((error) => error);
      expect(failed.code).toBe(3);
      expect(failed.stdout).toBe("");
      expect(failed.stderr).toContain("Build failed with exit code 7");
      expect(failed.stderr).not.toContain("private build output");

      await writeBuild(root, `await import("node:fs/promises").then(fs => fs.writeFile("ran", "yes"));`);
      const invalid = await exec(process.execPath, [cli, "audit", root, "--build", "--fail-on", "typo"])
        .catch((error) => error);
      expect(invalid.code).toBe(3);
      await expect(readFile(path.join(root, "ran"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  it("terminates the compiler subprocess as well as its parent when a build times out", async () => {
    await withProject(async (root) => {
      const heartbeat = path.join(root, "heartbeat");
      const worker = `const fs = require("node:fs"); setInterval(() => fs.appendFileSync("heartbeat", "x"), 20); setTimeout(() => process.exit(), 2500);`;
      const parent = `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(worker)}], {stdio:"ignore"}); setTimeout(() => process.exit(), 2500);`;
      await expect(runBuild(process.execPath, ["-e", parent], root, 600)).rejects.toThrow("Build timed out");
      const before = await readFile(heartbeat, "utf8");
      expect(before.length).toBeGreaterThan(0);
      await delay(100);
      expect(await readFile(heartbeat, "utf8")).toBe(before);
    });
  });

  it("terminates a running build when the CLI receives SIGTERM", async () => {
    await withProject(async (root) => {
      await writeBuild(root, `
        import { appendFileSync } from "node:fs";
        setInterval(() => appendFileSync("heartbeat", "x"), 20);
        setTimeout(() => process.exit(), 2500);
      `);
      const child = spawn(process.execPath, [cli, "audit", root, "--build", "--no-engines"], { stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      child.stdout.on("data", (data) => { output += data; });
      child.stderr.on("data", (data) => { output += data; });
      const closed = new Promise<number | null>((resolve) => child.once("close", resolve));
      try {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          try { await readFile(path.join(root, "heartbeat")); break; } catch { await delay(20); }
        }
        await readFile(path.join(root, "heartbeat"));
        child.kill("SIGTERM");
        expect(await closed).toBe(3);
        expect(output).toContain("Build interrupted by SIGTERM");
        const before = await readFile(path.join(root, "heartbeat"), "utf8");
        await delay(100);
        expect(await readFile(path.join(root, "heartbeat"), "utf8")).toBe(before);
      } finally {
        if (child.exitCode === null) child.kill("SIGTERM");
        await closed;
      }
    });
  });
});

async function withProject(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "safetoship-build-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

async function writeBuild(root: string, script: string, extra: Record<string, unknown> = {}): Promise<void> {
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { build: "node build.mjs" }, ...extra }));
  await writeFile(path.join(root, "build.mjs"), script);
}
