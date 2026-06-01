import type { Finding, ScanResult } from "../types.js";

export function renderSarif(result: ScanResult): string {
  const rules = new Map(result.findings.map((finding) => [finding.id, finding]));

  return JSON.stringify(
    {
      version: "2.1.0",
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      runs: [
        {
          tool: {
            driver: {
              name: "ShipVerdict",
              informationUri: "https://github.com/OWNER/shipverdict",
              version: result.version,
              rules: [...rules.values()].map(ruleFromFinding)
            }
          },
          results: result.findings.map(resultFromFinding)
        }
      ]
    },
    null,
    2
  );
}

function ruleFromFinding(finding: Finding) {
  return {
    id: finding.id,
    name: finding.title,
    shortDescription: { text: finding.title },
    fullDescription: { text: finding.why },
    help: { text: finding.fixPrompt },
    defaultConfiguration: { level: sarifLevel(finding.severity) }
  };
}

function resultFromFinding(finding: Finding) {
  const result: Record<string, unknown> = {
    ruleId: finding.id,
    level: sarifLevel(finding.severity),
    message: { text: `${finding.title}: ${finding.why}` }
  };

  if (finding.file) {
    result.locations = [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.file },
          region: { startLine: finding.line ?? 1 }
        }
      }
    ];
  }

  return result;
}

function sarifLevel(severity: Finding["severity"]): "error" | "warning" | "note" {
  if (severity === "BLOCKER" || severity === "HIGH") {
    return "error";
  }
  if (severity === "MEDIUM") {
    return "warning";
  }
  return "note";
}
