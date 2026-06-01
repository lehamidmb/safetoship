import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scan } from "../src/scan.js";

describe("ShipVerdict heuristics", () => {
  it("flags frontend secrets and Supabase service_role exposure", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
        const serviceRole = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("SV-COST-001");
      expect(ids(result)).toContain("SV-COST-003");
      expect(result.verdict).toBe("DO-NOT-SHIP");
    });
  });

  it("flags Supabase tables without RLS and broad policies", async () => {
    await withProject(async (root) => {
      await write(root, "supabase/migrations/0001.sql", `
        create table public.todos (id uuid primary key, user_id uuid);
        create policy "everyone" on public.todos for select using (true);
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("SV-COST-004");
      expect(ids(result)).toContain("SV-COST-005");
    });
  });

  it("flags client-side-only paid usage limits and missing server rate limits", async () => {
    await withProject(async (root) => {
      await write(root, "app/page.tsx", `
        "use client";
        export function Page() {
          localStorage.setItem("quota", "1");
          fetch("/api/generate");
          return null;
        }
      `);
      await write(root, "app/api/generate/route.ts", `
        import OpenAI from "openai";
        export async function POST() {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          return Response.json(await openai.responses.create({ model: "gpt-5-mini", input: "hi" }));
        }
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("SV-COST-006");
      expect(ids(result)).toContain("SV-COST-007");
    });
  });

  it("flags missing privacy policy and payment terms", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({ name: "paid-demo", dependencies: { stripe: "latest" } }));
      await write(root, "app/page.tsx", `
        export default function Page() {
          return <input type="email" name="email" />;
        }
      `);
      await write(root, "app/api/checkout/route.ts", `
        import Stripe from "stripe";
        export async function POST() {
          return Response.json({ ok: true });
        }
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("SV-LEGAL-001");
      expect(ids(result)).toContain("SV-LEGAL-002");
      expect(ids(result)).toContain("SV-LEGAL-005");
    });
  });

  it("flags Next.js source maps and missing security headers", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({ dependencies: { next: "latest" } }));
      await write(root, "next.config.js", "module.exports = { productionBrowserSourceMaps: true };");

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("SV-TECH-001");
      expect(ids(result)).toContain("SV-TECH-002");
    });
  });

  it("quick mode flags secret-shaped values and unsafe SQL interpolation", async () => {
    await withProject(async (root) => {
      await write(root, "app/api/search/route.ts", `
        const demo = "sk-fake-demo-key";
        export async function GET(request) {
          const q = new URL(request.url).searchParams.get("q");
          return db.query(\`select * from users where email = '\${q}'\`);
        }
      `);

      const result = await scan({ targetDir: root, mode: "quick", runEngines: false });
      expect(ids(result)).toContain("SV-QUICK-001");
      expect(ids(result)).toContain("SV-QUICK-003");
      expect(result.verdict).toBe("DO-NOT-SHIP");
    });
  });
});

async function withProject(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "shipverdict-"));
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

function ids(result: { findings: Array<{ id: string }> }): string[] {
  return result.findings.map((finding) => finding.id);
}
