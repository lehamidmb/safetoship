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
  skippedSymlinks: number;
}

export async function buildAndCollectFrontendAssets(targetDir: string, excludes: string[] = []): Promise<BuildResult> {
  const target = path.resolve(targetDir);
  const packagePath = path.join(target, "package.json");
  let packageJson: unknown;

  try {
    packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("--build requires a package.json in the target directory.");
    }
    throw new Error("--build could not read a valid package.json in the target directory.");
  }

  if (!isObject(packageJson) || !isObject(packageJson.scripts) ||
      typeof packageJson.scripts.build !== "string" || packageJson.scripts.build.trim().length === 0) {
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
  if (packageManager !== undefined) {
    const declared = typeof packageManager === "string" ? packageManager.split("@")[0] : undefined;
    if (declared === "npm" || declared === "pnpm" || declared === "yarn" || declared === "bun") {
      return declared;
    }
    throw new Error("--build supports only npm, pnpm, yarn, or bun in packageManager.");
  }

  const runners = new Set<"npm" | "pnpm" | "yarn" | "bun">();
  for (const [lockfile, runner] of [
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"]
  ] as const) {
    try {
      await fs.access(path.join(targetDir, lockfile));
      runners.add(runner);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  if (runners.size > 1) {
    throw new Error("--build found lockfiles for multiple package managers; set packageManager in package.json.");
  }
  return [...runners][0] ?? "npm";
}

export async function runBuild(command: string, args: string[], targetDir: string, timeoutMs = BUILD_TIMEOUT_MS): Promise<void> {
  if (process.platform === "win32") {
    throw new Error("--build currently requires macOS, Linux, or WSL for package-manager process cleanup.");
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: targetDir,
      shell: false,
      detached: true,
      stdio: "ignore"
    });
    let failure: Error | undefined;
    const stop = (error: Error) => {
      failure ??= error;
      if (child.pid) {
        // npm launches a shell and a compiler: terminate their process group too.
        try { process.kill(-child.pid, "SIGKILL"); } catch (killError) {
          if ((killError as NodeJS.ErrnoException).code !== "ESRCH") child.kill("SIGKILL");
        }
      }
    };
    const onInterrupt = () => stop(new Error("Build interrupted by SIGINT."));
    const onTerminate = () => stop(new Error("Build interrupted by SIGTERM."));
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
    const timer = setTimeout(() => stop(new Error(
      `Build timed out after ${timeoutMs / 1000} seconds (${command} ${args.join(" ")}).`
    )), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      process.removeListener("SIGINT", onInterrupt);
      process.removeListener("SIGTERM", onTerminate);
    };

    child.once("error", (error) => {
      cleanup();
      const code = (error as NodeJS.ErrnoException).code;
      reject(new Error(code === "ENOENT"
        ? `Could not run ${command}; install the package manager declared by this project.`
        : `Could not start ${command} ${args.join(" ")}.`));
    });
    child.once("close", (code, signal) => {
      cleanup();
      if (failure) {
        reject(failure);
        return;
      }
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
): Promise<Pick<BuildResult, "files" | "outputPaths" | "skippedLargeFiles" | "skippedSymlinks">> {
  const files: ProjectFile[] = [];
  const outputPaths: string[] = [];
  let skippedLargeFiles = 0;
  let skippedSymlinks = 0;

  for (const outputRoot of BUILT_ASSET_ROOTS) {
    if (isExcluded(outputRoot, excludes)) continue;
    const absoluteRoot = path.join(targetDir, outputRoot);
    let current = targetDir;
    let available = true;
    // Check every component: .next itself may be a symlink, not just static.
    for (const component of outputRoot.split("/")) {
      current = path.join(current, component);
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink()) skippedSymlinks += 1;
        if (!stat.isDirectory()) { available = false; break; }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw new Error("Could not inspect a supported build output directory.");
        }
        available = false;
        break;
      }
    }
    if (!available) continue;

    outputPaths.push(outputRoot);
    await walk(absoluteRoot);
  }

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(targetDir, absolutePath).split(path.sep).join("/");
      if (isExcluded(relativePath, excludes)) continue;
      if (entry.isSymbolicLink()) { skippedSymlinks += 1; continue; }
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

  return { files, outputPaths, skippedLargeFiles, skippedSymlinks };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isExcluded(relativePath: string, excludes: string[]): boolean {
  return excludes.some((exclude) => {
    const cleaned = exclude.replace(/^\/+|\/+$/g, "");
    return relativePath === cleaned || relativePath.startsWith(`${cleaned}/`) || relativePath.includes(`/${cleaned}/`);
  });
}
