import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/reporters/markdown.js";
import { renderTerminal } from "../src/reporters/terminal.js";
import { scan } from "../src/scan.js";

describe("fingerprint-scoped accepted risks", () => {
  it("accepts one reviewed finding without hiding a new finding from the same rule", async () => {
    await withProject(async (root) => {
      await write(root, "components/Reviewed.tsx", `
        "use client";
        const reviewedKey = "sk-review-fixture";
      `);
      await write(root, "components/NewRisk.tsx", `
        "use client";
        const unexpectedKey = "sk-new-fixture";
      `);

      const before = await scan({ targetDir: root, mode: "audit", runEngines: false });
      const secretFindings = before.findings.filter((finding) => finding.id === "STS-COST-002");
      expect(secretFindings).toHaveLength(2);
      const reviewed = secretFindings.find((finding) => finding.file === "components/Reviewed.tsx");
      expect(reviewed?.fingerprint).toMatch(/^[a-f0-9]{16}$/);

      await write(root, ".safetoshiprc.json", JSON.stringify({
        acceptedRisks: {
          [reviewed!.fingerprint!]: "reviewed inert credential fixture"
        }
      }));

      const after = await scan({ targetDir: root, mode: "audit", runEngines: false });
      const activeSecrets = after.findings.filter((finding) => finding.id === "STS-COST-002");
      expect(activeSecrets.map((finding) => finding.file)).toEqual(["components/NewRisk.tsx"]);
      expect(after.acceptedRisks).toHaveLength(1);
      expect(after.acceptedRisks[0]?.fingerprint).toBe(reviewed?.fingerprint);
      expect(after.acceptedRisks[0]?.suppressionReason).toBe("reviewed inert credential fixture");
      expect(after.verdict).toBe("DO-NOT-SHIP");
      expect(renderTerminal(after)).toContain(`STS-COST-002 (${reviewed?.fingerprint})`);
      expect(renderMarkdown(after)).toContain(`\`${reviewed?.fingerprint}\``);
    });
  });

  it("warns about invalid reasons and fingerprints that do not match this scan", async () => {
    await withProject(async (root) => {
      await write(root, "app/page.tsx", "export default function Page() { return null; }");
      await write(root, ".safetoshiprc.json", JSON.stringify({
        acceptedRisks: {
          invalid: "reviewed exception with enough detail",
          "0123456789abcdef": "too short",
          "abcdef0123456789": "reviewed exception no longer present"
        }
      }));

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(result.acceptedRisks).toHaveLength(0);
      expect(result.warnings).toContain(
        ".safetoshiprc.json: ignored invalid accepted-risk fingerprint invalid."
      );
      expect(result.warnings).toContain(
        ".safetoshiprc.json: ignored accepted risk 0123456789abcdef; add a reason of at least 10 characters."
      );
      expect(result.warnings).toContain(
        "Accepted-risk fingerprint abcdef0123456789 did not match a finding in this scan."
      );
    });
  });
});

async function withProject(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "safetoship-accepted-risk-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function write(root: string, relativePath: string, content: string): Promise<void> {
  const destination = path.join(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}
