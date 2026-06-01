export type Severity = "LOW" | "MEDIUM" | "HIGH" | "BLOCKER";

export type Verdict = "SHIP" | "SHIP-WITH-WARNINGS" | "DO-NOT-SHIP";

export type RuleFamily = "engine" | "technical" | "abuse-cost" | "legal-compliance" | "quick";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  family: RuleFamily;
  file?: string;
  line?: number;
  why: string;
  fixPrompt: string;
  source?: string;
}

export interface EngineStatus {
  name: "gitleaks" | "semgrep" | "osv-scanner";
  status: "ran" | "skipped" | "error";
  message: string;
}

export interface ScanResult {
  tool: "shipverdict";
  version: string;
  generatedAt: string;
  targetDir: string;
  mode: "audit" | "quick";
  verdict: Verdict;
  summary: {
    blockers: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  findings: Finding[];
  engineStatuses: EngineStatus[];
  limits: string[];
}

export interface ProjectFile {
  absolutePath: string;
  relativePath: string;
  content: string;
  lines: string[];
}

export interface ScanOptions {
  targetDir: string;
  mode: "audit" | "quick";
  runEngines: boolean;
  excludes: string[];
}
