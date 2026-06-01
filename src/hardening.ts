import { promises as fs } from "node:fs";
import path from "node:path";
import type { Finding, ScanResult } from "./types.js";

export interface HardeningAction {
  id: string;
  title: string;
  kind: "safe-autofix" | "agent-repair" | "manual-review";
  status: "planned" | "applied" | "skipped";
  file?: string;
  details: string;
  prompt?: string;
}

export interface HardeningResult {
  targetDir: string;
  appliedSafeFixes: boolean;
  generatedAt: string;
  changedFiles: string[];
  actions: HardeningAction[];
  planPath?: string;
}

const PLAN_FILE = "SAFETOSHIP_HARDENING_PLAN.md";

export async function createHardeningPlan(scanResult: ScanResult, applySafeFixes: boolean): Promise<HardeningResult> {
  const targetDir = scanResult.targetDir;
  const actions = scanResult.findings.map(actionFromFinding);
  const changedFiles: string[] = [];

  if (applySafeFixes) {
    for (const action of actions) {
      const changed = await applyAction(targetDir, action);
      if (changed) {
        action.status = "applied";
        changedFiles.push(changed);
      }
    }
  }

  const plan = renderHardeningPlan(scanResult, actions, applySafeFixes);
  const planPath = path.join(targetDir, PLAN_FILE);
  await fs.writeFile(planPath, plan, "utf8");
  changedFiles.push(PLAN_FILE);

  return {
    targetDir,
    appliedSafeFixes: applySafeFixes,
    generatedAt: new Date().toISOString(),
    changedFiles: unique(changedFiles),
    actions,
    planPath
  };
}

export function renderHardeningResult(result: HardeningResult): string {
  const lines: string[] = [];
  lines.push(`SafeToShip hardening plan written to ${result.planPath ?? PLAN_FILE}`);
  lines.push(`Safe fixes: ${result.appliedSafeFixes ? "applied where deterministic" : "not applied"}`);

  if (result.changedFiles.length > 0) {
    lines.push("");
    lines.push("Changed files:");
    for (const file of result.changedFiles) {
      lines.push(`- ${file}`);
    }
  }

  lines.push("");
  lines.push("Actions:");
  for (const action of result.actions) {
    lines.push(`- ${action.status.toUpperCase()} ${action.kind}: ${action.title}`);
  }

  return `${lines.join("\n")}\n`;
}

function actionFromFinding(finding: Finding): HardeningAction {
  switch (finding.id) {
    case "STS-TECH-001":
      return {
        id: finding.id,
        title: "Disable production browser source maps",
        kind: "safe-autofix",
        status: "planned",
        file: finding.file,
        details: "SafeToShip can replace productionBrowserSourceMaps: true with false in a simple Next.js config."
      };
    case "STS-LEGAL-001":
      return {
        id: finding.id,
        title: "Create a starter privacy policy",
        kind: "safe-autofix",
        status: "planned",
        details: "SafeToShip can create PRIVACY.md with a review-required starter policy so the project has a concrete launch artifact."
      };
    case "STS-LEGAL-002":
      return {
        id: finding.id,
        title: "Create starter Terms of Use",
        kind: "safe-autofix",
        status: "planned",
        details: "SafeToShip can create TERMS.md with review-required starter terms covering accounts, payments, acceptable use, disclaimers, and liability."
      };
    case "STS-COST-001":
    case "STS-COST-002":
    case "STS-COST-003":
    case "STS-COST-004":
    case "STS-COST-005":
    case "STS-COST-006":
    case "STS-COST-007":
    case "STS-LEGAL-003":
    case "STS-LEGAL-004":
    case "STS-TECH-002":
      return {
        id: finding.id,
        title: finding.title,
        kind: "agent-repair",
        status: "planned",
        file: finding.file,
        details: "This change can affect auth, data access, billing, or privacy behavior, so SafeToShip generates an agent-ready repair task instead of editing blindly.",
        prompt: finding.fixPrompt
      };
    case "STS-LEGAL-005":
      return {
        id: finding.id,
        title: "Complete product-name IP/trademark attestation",
        kind: "manual-review",
        status: "planned",
        file: finding.file,
        details: "A human needs to search USPTO, web, domains, and relevant app marketplaces before launch.",
        prompt: finding.fixPrompt
      };
    default:
      return {
        id: finding.id,
        title: finding.title,
        kind: "agent-repair",
        status: "planned",
        file: finding.file,
        details: "Review this finding and use the generated prompt to repair the app safely.",
        prompt: finding.fixPrompt
      };
  }
}

async function applyAction(targetDir: string, action: HardeningAction): Promise<string | undefined> {
  if (action.kind !== "safe-autofix") {
    action.status = "skipped";
    return undefined;
  }

  if (action.id === "STS-TECH-001" && action.file) {
    const filePath = path.join(targetDir, action.file);
    const content = await fs.readFile(filePath, "utf8");
    if (!/productionBrowserSourceMaps\s*:\s*true/.test(content)) {
      action.status = "skipped";
      return undefined;
    }

    await fs.writeFile(filePath, content.replace(/productionBrowserSourceMaps\s*:\s*true/g, "productionBrowserSourceMaps: false"), "utf8");
    return action.file;
  }

  if (action.id === "STS-LEGAL-001") {
    return writeIfMissing(targetDir, "PRIVACY.md", privacyTemplate());
  }

  if (action.id === "STS-LEGAL-002") {
    return writeIfMissing(targetDir, "TERMS.md", termsTemplate());
  }

  action.status = "skipped";
  return undefined;
}

async function writeIfMissing(targetDir: string, relativePath: string, content: string): Promise<string | undefined> {
  const filePath = path.join(targetDir, relativePath);

  try {
    await fs.access(filePath);
    return undefined;
  } catch {
    await fs.writeFile(filePath, content, "utf8");
    return relativePath;
  }
}

function renderHardeningPlan(scanResult: ScanResult, actions: HardeningAction[], applySafeFixes: boolean): string {
  const lines: string[] = [];
  lines.push("# SafeToShip Hardening Plan");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Verdict: ${scanResult.verdict}`);
  lines.push(`Safe autofixes ${applySafeFixes ? "were applied where deterministic" : "were not applied"}.`);
  lines.push("");
  lines.push("This plan is meant to be handed to Codex, Claude Code, Cursor, or a human maintainer. It does not replace security review or legal advice.");
  lines.push("");

  for (const action of actions) {
    lines.push(`## ${action.kind}: ${action.title}`);
    lines.push("");
    lines.push(`- Rule: \`${action.id}\``);
    lines.push(`- Status: ${action.status}`);
    if (action.file) {
      lines.push(`- File: \`${action.file}\``);
    }
    lines.push(`- Details: ${action.details}`);

    if (action.prompt) {
      lines.push("");
      lines.push("```text");
      lines.push(action.prompt);
      lines.push("```");
    }

    lines.push("");
  }

  if (actions.length === 0) {
    lines.push("No hardening actions were generated. Keep the launch checklist current as the app changes.");
    lines.push("");
  }

  return lines.join("\n");
}

function privacyTemplate(): string {
  return `# Privacy Policy

Review this policy before launch and adapt it to the actual app, data flows, providers, and jurisdictions.

## Data We Collect

Describe account data, contact details, usage data, analytics events, payment metadata, uploaded content, and any other personal data the app processes.

## How We Use Data

Describe product operation, security, support, analytics, billing, abuse prevention, and user communication.

## Third-Party Providers

List hosting, database, analytics, payments, email, AI providers, authentication, and error-monitoring services that process user data.

## Retention

Describe how long data is kept and how users can request deletion.

## User Rights

Describe access, correction, deletion, export, opt-out, and consent withdrawal paths where applicable.

## Contact

Provide a working privacy or support contact before launch.
`;
}

function termsTemplate(): string {
  return `# Terms of Use

Review these terms before launch and adapt them to the actual product, pricing, support model, and jurisdiction.

## Accounts

Users are responsible for their account activity and for keeping credentials secure.

## Acceptable Use

Users may not abuse, disrupt, reverse engineer, scrape, attack, or use the service for unlawful activity.

## Payments And Refunds

Describe pricing, renewals, refunds, cancellations, trials, usage limits, and billing support.

## User Content

Describe who owns uploaded or generated content, what license is needed to operate the service, and what content is prohibited.

## Disclaimers

The service is provided as is and as available, subject to applicable law.

## Limitation Of Liability

Describe liability limits appropriate for the product and jurisdiction.

## Governing Law

Specify governing law after legal review.

## Contact

Provide a working support contact before launch.
`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
