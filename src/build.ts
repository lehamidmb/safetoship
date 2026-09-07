import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProjectFile } from "./types.js";

const BUILD_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_BUILT_ASSET_BYTES = 20_000_000;
const BUILT_ASSET_ROOTS = [".next/static", "dist", "build/static", "out"];
const BUILT_ASSET_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map", ".mjs", ".txt"]);

export interface BuildResult {
  command: string;
  files: ProjectFile[];
  outputPaths: string[];
  skippedLargeFiles: number;
}

export async function buildAndCollectFrontendAssets(targetDir: string, excludes: string[] = []): Promise<BuildResult> {
  const target = path.resolve(targetDir);
  const packagePath = path.join(target, "package.json");
  let packageJson: { packageManager?: unknown; scripts?: Record<string, unknown> };

  try {
    packageJson = JSON.parse(await fs.readFile(packagePath, "utf8")) as typeof packageJson;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("--build requires a package.json in the target directory.");
    }
    throw new Error("--build could not read a valid package.json in the target directory.");
  }

  if (typeof packageJson.scripts?.build !== "string" || packageJson.scripts.build.trim().length === 0) {
    throw new Error("--build requires a non-empty package.json scripts.build command.");
  }

  const runner = await detectPackageRunner(target, packageJson.packageManager);
  const args = runner === "yarn" ? ["build"] : ["run", "build"];
  await runBuild(runner, args, target);

  const collected = await collectBuiltFrontendAssets(target, excludes);
  return {
    command: [runner, ...args].join(" "),
    ...collected
  };
}

async function detectPackageRunner(targetDir: string, packageManager: unknown): Promise<"npm" | "pnpm" | "yarn" | "bun"> {
  if (typeof packageManager === "string") {
    const declared = packageManager.split("@")[0];
    if (declared === "npm" || declared === "pnpm" || declared === "yarn" || declared === "bun") {
      return declared;
    }
  }

  for (const [lockfile, runner] of [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"]
  ] as const) {
    try {
      await fs.access(path.join(targetDir, lockfile));
      return runner;
    } catch {
      // Keep checking lockfiles before falling back to npm.
    }
  }

  return "npm";
}

async function runBuild(command: string, args: string[], targetDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: targetDir,
      shell: false,
      stdio: "ignore"
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Build timed out after 10 minutes (${command} ${args.join(" ")}).`));
    }, BUILD_TIMEOUT_MS);

    child.once("error", (error) => {
      clearTimeout(timer);
      const code = (error as NodeJS.ErrnoException).code;
      reject(new Error(code === "ENOENT"
        ? `Could not run ${command}; install the package manager declared by this project.`
        : `Could not start ${command} ${args.join(" ")}.`));
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      const outcome = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      reject(new Error(`Build failed with ${outcome} (${command} ${args.join(" ")}). Run the build directly for its full output.`));
    });
  });
}

async function collectBuiltFrontendAssets(
  targetDir: string,
  excludes: string[]
): Promise<{ files: ProjectFile[]; outputPaths: string[]; skippedLargeFiles: number }> {
  const files: ProjectFile[] = [];
  const outputPaths: string[] = [];
  let skippedLargeFiles = 0;

  for (const outputRoot of BUILT_ASSET_ROOTS) {
    if (isExcluded(outputRoot, excludes)) continue;
    const absoluteRoot = path.join(targetDir, outputRoot);
    try {
      const stat = await fs.stat(absoluteRoot);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    outputPaths.push(outputRoot);
    await walk(absoluteRoot);
  }

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(targetDir, absolutePath).split(path.sep).join("/");
      if (isExcluded(relativePath, excludes)) continue;
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !BUILT_ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

      const stat = await fs.stat(absolutePath);
      if (stat.size > MAX_BUILT_ASSET_BYTES) {
        skippedLargeFiles += 1;
        continue;
      }
      const content = await fs.readFile(absolutePath, "utf8");
      if (content.includes("\u0000")) continue;
      files.push({
        absolutePath,
        relativePath,
        content,
        lines: content.split(/\r?\n/)
      });
    }
  }

  return { files, outputPaths, skippedLargeFiles };
}

function isExcluded(relativePath: string, excludes: string[]): boolean {
  return excludes.some((exclude) => {
    const cleaned = exclude.replace(/^\/+|\/+$/g, "");
    return relativePath === cleaned || relativePath.startsWith(`${cleaned}/`) || relativePath.includes(`/${cleaned}/`);
  });
}
