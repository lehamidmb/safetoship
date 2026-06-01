import type { Finding, ProjectFile } from "../types.js";
import { fixPrompt } from "../fixPrompt.js";
import { lineForIndex } from "../project.js";

export function runTechnicalRules(files: ProjectFile[]): Finding[] {
  return [
    ...findProductionSourceMaps(files),
    ...findMissingNextSecurityHeaders(files)
  ];
}

function findProductionSourceMaps(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files.filter((candidate) => /next\.config\.(js|mjs|ts)$/.test(candidate.relativePath))) {
    const match = /productionBrowserSourceMaps\s*:\s*true/.exec(file.content);
    if (!match) {
      continue;
    }

    findings.push({
      id: "SV-TECH-001",
      title: "Production browser source maps are enabled",
      severity: "HIGH",
      family: "technical",
      file: file.relativePath,
      line: lineForIndex(file.content, match.index),
      why: "Next.js will publish readable browser source maps in production. That can expose implementation details, hidden routes, comments, and sometimes secrets accidentally bundled into client code.",
      fixPrompt: fixPrompt(
        "Production browser source maps are enabled in Next.js.",
        "Turn off productionBrowserSourceMaps for production builds, confirm no source maps are publicly served, and explain any debugging alternative you recommend."
      )
    });
  }

  return findings;
}

function findMissingNextSecurityHeaders(files: ProjectFile[]): Finding[] {
  const packageFile = files.find((file) => file.relativePath === "package.json");
  const nextConfig = files.find((file) => /next\.config\.(js|mjs|ts)$/.test(file.relativePath));
  const looksLikeNext = Boolean(nextConfig) || Boolean(packageFile && /"next"\s*:/.test(packageFile.content));

  if (!looksLikeNext) {
    return [];
  }

  const headerSources = files.filter((file) =>
    /next\.config\.(js|mjs|ts)$/.test(file.relativePath) ||
    /(^|\/)middleware\.(ts|js)$/.test(file.relativePath)
  );
  const joined = headerSources.map((file) => file.content.toLowerCase()).join("\n");
  const requiredSignals = [
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options"
  ];
  const presentCount = requiredSignals.filter((signal) => joined.includes(signal)).length;

  if (presentCount >= 3) {
    return [];
  }

  return [
    {
      id: "SV-TECH-002",
      title: "Next.js security headers are missing or incomplete",
      severity: "MEDIUM",
      family: "technical",
      file: nextConfig?.relativePath ?? packageFile?.relativePath,
      line: 1,
      why: "This looks like a Next.js app, but ShipVerdict could not find a solid security headers setup. Missing CSP, HSTS, X-Content-Type-Options, or frame protections makes common browser attacks easier.",
      fixPrompt: fixPrompt(
        "This Next.js app appears to be missing core security headers.",
        "Add a headers() config or middleware that sets Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, and X-Frame-Options. Keep the policy compatible with the current app."
      )
    }
  ];
}
