import { spawnSync } from "node:child_process";
import path from "node:path";
import type { EngineStatus, Finding } from "./types.js";
import { fixPrompt } from "./fixPrompt.js";

export interface EngineRunResult {
  findings: Finding[];
  statuses: EngineStatus[];
}

export function runEngines(targetDir: string): EngineRunResult {
  const statuses: EngineStatus[] = [];
  const findings: Finding[] = [];

  const gitleaks = runGitleaks(targetDir);
  statuses.push(gitleaks.status);
  findings.push(...gitleaks.findings);

  const semgrep = runSemgrep(targetDir);
  statuses.push(semgrep.status);
  findings.push(...semgrep.findings);

  const osv = runOsvScanner(targetDir);
  statuses.push(osv.status);
  findings.push(...osv.findings);

  return { findings, statuses };
}

function runGitleaks(targetDir: string): { findings: Finding[]; status: EngineStatus } {
  if (!hasCommand("gitleaks")) {
    return {
      findings: [],
      status: {
        name: "gitleaks",
        status: "skipped",
        message: "gitleaks not found on PATH. Install hint: brew install gitleaks"
      }
    };
  }

  const result = spawnSync(
    "gitleaks",
    ["detect", "--source", targetDir, "--report-format", "json", "--no-banner", "--exit-code", "0"],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );

  if (result.error) {
    return {
      findings: [],
      status: { name: "gitleaks", status: "error", message: result.error.message }
    };
  }

  const findings = parseJsonArray(result.stdout).map((item: Record<string, unknown>) => ({
    id: "SV-ENG-GITLEAKS",
    title: "Gitleaks detected a committed secret",
    severity: "BLOCKER" as const,
    family: "engine" as const,
    file: toRelative(targetDir, String(item.File ?? "")),
    line: typeof item.StartLine === "number" ? item.StartLine : undefined,
    why: `Gitleaks detected ${String(item.RuleID ?? "a secret")} in the repository. Treat this as leaked if it was ever committed.`,
    fixPrompt: fixPrompt(
      "Gitleaks detected a committed secret.",
      "Remove the secret from code, rotate it with the provider, scrub history only if appropriate for this repo, and add a prevention check so it cannot be committed again."
    ),
    source: "gitleaks"
  }));

  return {
    findings,
    status: {
      name: "gitleaks",
      status: "ran",
      message: findings.length === 0 ? "No gitleaks findings parsed." : `Parsed ${findings.length} gitleaks finding(s).`
    }
  };
}

function runSemgrep(targetDir: string): { findings: Finding[]; status: EngineStatus } {
  if (!hasCommand("semgrep")) {
    return {
      findings: [],
      status: {
        name: "semgrep",
        status: "skipped",
        message: "semgrep not found on PATH. Install hint: python3 -m pip install semgrep"
      }
    };
  }

  const result = spawnSync("semgrep", ["--config", "auto", "--json", "--quiet", targetDir], {
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024
  });

  if (result.error) {
    return {
      findings: [],
      status: { name: "semgrep", status: "error", message: result.error.message }
    };
  }

  const parsed = parseJsonObject(result.stdout);
  const results = Array.isArray(parsed.results) ? parsed.results : [];
  const findings = results.map((item: Record<string, unknown>) => {
    const extra = (item.extra ?? {}) as Record<string, unknown>;
    const start = (item.start ?? {}) as Record<string, unknown>;
    const severity = String(extra.severity ?? "WARNING").toUpperCase();

    return {
      id: "SV-ENG-SEMGREP",
      title: String(extra.message ?? "Semgrep found a code security issue"),
      severity: severity === "ERROR" ? ("HIGH" as const) : ("MEDIUM" as const),
      family: "engine" as const,
      file: toRelative(targetDir, String(item.path ?? "")),
      line: typeof start.line === "number" ? start.line : undefined,
      why: String(extra.message ?? "Semgrep flagged this code path as security-relevant."),
      fixPrompt: fixPrompt(
        "Semgrep flagged a security issue in first-party code.",
        "Review the exact finding, remove the vulnerable pattern, and add a focused regression test for the vulnerable input or flow."
      ),
      source: "semgrep"
    };
  });

  return {
    findings,
    status: {
      name: "semgrep",
      status: "ran",
      message: findings.length === 0 ? "No semgrep findings parsed." : `Parsed ${findings.length} semgrep finding(s).`
    }
  };
}

function runOsvScanner(targetDir: string): { findings: Finding[]; status: EngineStatus } {
  if (!hasCommand("osv-scanner")) {
    return {
      findings: [],
      status: {
        name: "osv-scanner",
        status: "skipped",
        message: "osv-scanner not found on PATH. Install hint: brew install osv-scanner"
      }
    };
  }

  const result = spawnSync("osv-scanner", ["scan", "source", "--format", "json", targetDir], {
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024
  });

  if (result.error) {
    return {
      findings: [],
      status: { name: "osv-scanner", status: "error", message: result.error.message }
    };
  }

  const parsed = parseJsonObject(result.stdout);
  const findings: Finding[] = [];
  const results = Array.isArray(parsed.results) ? parsed.results : [];

  for (const source of results as Array<Record<string, unknown>>) {
    const packages = Array.isArray(source.packages) ? source.packages : [];
    for (const packageResult of packages as Array<Record<string, unknown>>) {
      const vulnerabilities = Array.isArray(packageResult.vulnerabilities) ? packageResult.vulnerabilities : [];
      for (const vulnerability of vulnerabilities as Array<Record<string, unknown>>) {
        const severity = mapOsvSeverity(vulnerability);
        findings.push({
          id: "SV-ENG-OSV",
          title: `Known vulnerable dependency: ${String(vulnerability.id ?? "OSV finding")}`,
          severity,
          family: "engine",
          file: toRelative(targetDir, String((source.source as Record<string, unknown> | undefined)?.path ?? "")),
          why: `OSV-Scanner reported ${String(vulnerability.id ?? "a known vulnerability")} in a dependency. Known vulnerable dependencies can be exploited even if your own code looks clean.`,
          fixPrompt: fixPrompt(
            "OSV-Scanner reported a known vulnerable dependency.",
            "Upgrade the vulnerable package to a fixed version, run the test suite, and document any temporary exception with the CVE/OSV ID and removal date."
          ),
          source: "osv-scanner"
        });
      }
    }
  }

  return {
    findings,
    status: {
      name: "osv-scanner",
      status: "ran",
      message: findings.length === 0 ? "No OSV findings parsed." : `Parsed ${findings.length} OSV finding(s).`
    }
  };
}

function hasCommand(command: string): boolean {
  const result = spawnSync("command", ["-v", command], { shell: true, encoding: "utf8" });
  return result.status === 0;
}

function parseJsonArray(output: string): Array<Record<string, unknown>> {
  if (!output.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(output) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(output: string): Record<string, unknown> {
  if (!output.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(output) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toRelative(root: string, candidate: string): string | undefined {
  if (!candidate) {
    return undefined;
  }

  return path.isAbsolute(candidate) ? path.relative(root, candidate).split(path.sep).join("/") : candidate;
}

function mapOsvSeverity(vulnerability: Record<string, unknown>): "MEDIUM" | "HIGH" {
  const severity = JSON.stringify(vulnerability.severity ?? vulnerability.database_specific ?? "").toLowerCase();
  return /critical|high|9\./.test(severity) ? "HIGH" : "MEDIUM";
}
