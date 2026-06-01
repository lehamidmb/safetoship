import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProjectFile } from "./types.js";

const DEFAULT_EXCLUDES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".vercel",
  "coverage",
  "tmp"
];

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".env",
  ".example",
  ".fixture",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

export function defaultExcludes(): string[] {
  return [...DEFAULT_EXCLUDES];
}

export async function collectProjectFiles(rootDir: string, extraExcludes: string[] = []): Promise<ProjectFile[]> {
  const root = path.resolve(rootDir);
  const excludes = [...DEFAULT_EXCLUDES, ...extraExcludes].filter(Boolean);
  const files: ProjectFile[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");

      if (isExcluded(relativePath, excludes)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile() || !looksTextual(absolutePath)) {
        continue;
      }

      const stat = await fs.stat(absolutePath);
      if (stat.size > 1_500_000) {
        continue;
      }

      const content = await fs.readFile(absolutePath, "utf8");
      if (content.includes("\u0000")) {
        continue;
      }

      files.push({
        absolutePath,
        relativePath,
        content,
        lines: content.split(/\r?\n/)
      });
    }
  }

  await walk(root);
  return files;
}

export function lineForIndex(content: string, index: number): number {
  return content.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

export function hasUseClient(file: ProjectFile): boolean {
  return /^["']use client["'];?/m.test(file.content.slice(0, 300));
}

export function isLikelyClientPath(relativePath: string): boolean {
  if (/(^|\/)(app\/api|pages\/api)\//.test(relativePath)) {
    return false;
  }

  return /(^|\/)(app|pages|components|src\/components)\//.test(relativePath) && /\.(tsx|jsx|ts|js)$/.test(relativePath);
}

export function isServerEndpointPath(relativePath: string): boolean {
  return /(^|\/)(app\/api|pages\/api|server|functions|api)\//.test(relativePath) && /\.(tsx|jsx|ts|js|mjs|cjs)$/.test(relativePath);
}

export function isSqlFile(relativePath: string): boolean {
  return /\.sql$/i.test(relativePath);
}

function isExcluded(relativePath: string, excludes: string[]): boolean {
  return excludes.some((exclude) => {
    const cleaned = exclude.replace(/^\/+|\/+$/g, "");
    return relativePath === cleaned || relativePath.startsWith(`${cleaned}/`) || relativePath.includes(`/${cleaned}/`);
  });
}

function looksTextual(absolutePath: string): boolean {
  const basename = path.basename(absolutePath);
  if (basename.startsWith(".env")) {
    return true;
  }

  const extension = path.extname(absolutePath).toLowerCase();
  return TEXT_EXTENSIONS.has(extension);
}
