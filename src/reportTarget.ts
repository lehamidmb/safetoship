import path from "node:path";

export function reportTarget(targetDir: string): string {
  const relative = path.relative(process.cwd(), targetDir);
  if (!relative) return ".";
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }
  return path.basename(targetDir);
}
