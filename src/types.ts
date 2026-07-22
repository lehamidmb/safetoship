export type Severity = "LOW" | "MEDIUM" | "HIGH" | "BLOCKER";

export type Confidence = "low" | "medium" | "high";

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
  confidence?: Confidence;
  confidenceRationale?: string;
  fingerprint?: string;
  provenance?: "source" | "engine";
  needsReview?: boolean;
  suppressionReason?: string;
}

export interface RuleOverride {
  enabled?: boolean;
  severity?: Severity;
  confidence?: Confidence;
  reason?: string;
}

export interface SafeToShipConfig {
  exclude: string[];
  rules: Record<string, RuleOverride>;
  deployGate?: boolean;
}

export interface EngineStatus {
  name: "gitleaks" | "semgrep" | "osv-scanner";
  status: "ran" | "skipped" | "error";
  message: string;
}

export interface ScanResult {
  tool: "safetoship";
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
    suppressed: number;
    needsReview: number;
  };
  findings: Finding[];
  acceptedRisks: Finding[];
  engineStatuses: EngineStatus[];
  limits: string[];
  warnings: string[];
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
