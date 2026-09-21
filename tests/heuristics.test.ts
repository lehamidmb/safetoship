import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scan } from "../src/scan.js";
import { createHardeningPlan } from "../src/hardening.js";
import { decideVerdict } from "../src/verdict.js";

describe("SafeToShip heuristics", () => {
  it.each([
    {
      fixture: "fixtures/clean-next-supabase",
      verdict: "SHIP",
      ids: []
    },
    {
      fixture: "fixtures/legal-gaps",
      verdict: "SHIP-WITH-WARNINGS",
      ids: ["STS-LEGAL-001", "STS-LEGAL-002", "STS-LEGAL-003", "STS-LEGAL-004"]
    },
    {
      fixture: "fixtures/cost-abuse",
      verdict: "SHIP-WITH-WARNINGS",
      ids: ["STS-COST-006", "STS-COST-007"]
    },
    {
      fixture: "fixtures/insecure-next-supabase",
      verdict: "DO-NOT-SHIP",
      ids: [
        "STS-COST-001",
        "STS-COST-003",
        "STS-COST-004",
        "STS-COST-005",
        "STS-COST-006",
        "STS-COST-007",
        "STS-LEGAL-001",
        "STS-LEGAL-002",
        "STS-LEGAL-004",
        "STS-LEGAL-005",
        "STS-LEGAL-006",
        "STS-TECH-001",
        "STS-TECH-002",
        "STS-TECH-003",
        "STS-TECH-004"
      ]
    }
  ])("scans $fixture with the expected verdict and rule set", async ({ fixture, verdict, ids: expectedIds }) => {
    const result = await scan({ targetDir: path.resolve(fixture), mode: "audit", runEngines: false });

    expect(result.verdict).toBe(verdict);
    expect(uniqueIds(result)).toEqual([...expectedIds].sort());
    if (fixture === "fixtures/clean-next-supabase") {
      expect(result.findings.filter((finding) => finding.severity === "BLOCKER")).toHaveLength(0);
    }
  });

  it("flags frontend secrets and Supabase service_role exposure", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        const key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
        const serviceRole = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("STS-COST-001");
      expect(ids(result)).toContain("STS-COST-003");
      expect(result.verdict).toBe("DO-NOT-SHIP");
    });
  });

  it("flags direct frontend secrets without duplicating overlapping public-env findings", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        const directSecret = "sk-fake-demo-key-do-not-use";
        const publicSecret = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "sk-fake-demo-key-do-not-use";
        const serviceRole = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("STS-COST-001");
      expect(ids(result)).toContain("STS-COST-002");
      expect(ids(result)).toContain("STS-COST-003");

      const overlappingSecretFindings = result.findings.filter(
        (finding) =>
          finding.file === "components/Client.tsx" &&
          finding.line === 4 &&
          ["STS-COST-001", "STS-COST-002", "STS-COST-003"].includes(finding.id)
      );
      expect(overlappingSecretFindings.map((finding) => finding.id)).toEqual(["STS-COST-001"]);

      const serviceRoleFindings = result.findings.filter(
        (finding) =>
          finding.file === "components/Client.tsx" &&
          finding.line === 5 &&
          ["STS-COST-001", "STS-COST-002", "STS-COST-003"].includes(finding.id)
      );
      expect(serviceRoleFindings.map((finding) => finding.id)).toEqual(["STS-COST-003"]);
    });
  });

  it("flags Supabase tables without RLS and broad policies", async () => {
    await withProject(async (root) => {
      await write(root, "supabase/migrations/0001.sql", `
        create table public.todos (id uuid primary key, user_id uuid);
        create policy "everyone" on public.todos for select using (true);
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("STS-COST-004");
      expect(ids(result)).toContain("STS-COST-005");
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
      expect(ids(result)).toContain("STS-COST-006");
      expect(ids(result)).toContain("STS-COST-007");
    });
  });

  it("does not mistake rate-limit TODOs or examples for implemented protection", async () => {
    await withProject(async (root) => {
      await write(root, "app/api/commented/route.ts", `
        import OpenAI from "openai";
        import { Ratelimit } from "@upstash/ratelimit";
        // TODO: call rateLimit(request) before launch.
        const example = "limiter.limit(userId)";
        export async function POST() {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          return Response.json(await openai.responses.create({ model: "gpt-5-mini", input: "hi" }));
        }
      `);
      await write(root, "app/api/protected/route.ts", `
        import OpenAI from "openai";
        const rateLimiter = {
          async limit(_key: string) {
            return { success: true };
          }
        };
        export async function POST(request: Request) {
          const decision = await rateLimiter.limit(request.headers.get("x-forwarded-for") ?? "anonymous");
          if (!decision.success) return new Response("Too many requests", { status: 429 });
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          return Response.json(await openai.responses.create({ model: "gpt-5-mini", input: "hi" }));
        }
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      const rateLimitFindings = result.findings.filter((finding) => finding.id === "STS-COST-007");

      expect(rateLimitFindings.map((finding) => finding.file)).toEqual(["app/api/commented/route.ts"]);
    });
  });

  it("does not mistake unused rate-limiter setup for enforced protection", async () => {
    await withProject(async (root) => {
      await write(root, "app/api/constructed-only/route.ts", `
        import OpenAI from "openai";
        import { Ratelimit } from "@upstash/ratelimit";
        const limiter = new Ratelimit({ redis: {} as never, limiter: {} as never });
        function rateLimit(_request: Request) {
          return { success: true };
        }
        export async function POST() {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          return Response.json(await openai.responses.create({ model: "gpt-5-mini", input: "hi" }));
        }
      `);
      await write(root, "app/api/enforced/route.ts", `
        import OpenAI from "openai";
        import { Ratelimit } from "@upstash/ratelimit";
        const limiter = new Ratelimit({ redis: {} as never, limiter: {} as never });
        export async function POST(request: Request) {
          const decision = await limiter.limit(request.headers.get("x-forwarded-for") ?? "anonymous");
          if (!decision.success) return new Response("Too many requests", { status: 429 });
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          return Response.json(await openai.responses.create({ model: "gpt-5-mini", input: "hi" }));
        }
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      const rateLimitFindings = result.findings.filter((finding) => finding.id === "STS-COST-007");

      expect(rateLimitFindings.map((finding) => finding.file)).toEqual(["app/api/constructed-only/route.ts"]);
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
      expect(ids(result)).toContain("STS-LEGAL-001");
      expect(ids(result)).toContain("STS-LEGAL-002");
      expect(ids(result)).toContain("STS-LEGAL-005");
      expect(ids(result)).toContain("STS-LEGAL-006");
    });
  });

  it("flags Next.js source maps and missing security headers", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({ dependencies: { next: "latest" } }));
      await write(root, "next.config.js", "module.exports = { productionBrowserSourceMaps: true };");

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("STS-TECH-001");
      expect(ids(result)).toContain("STS-TECH-002");
    });
  });

  it("runs an explicit production build and flags credential-shaped literals in generated assets", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({
        name: "bundle-secret-demo",
        scripts: { build: "node build.mjs" }
      }));
      await write(root, "build.mjs", `
        import { mkdir, writeFile } from "node:fs/promises";
        await mkdir("dist/assets", { recursive: true });
        await writeFile("dist/assets/app.js", 'globalThis.providerKey="sk-proj-' + 'testfixture0123456789abcdef";');
      `);

      const withoutBuild = await scan({ targetDir: root, mode: "audit", runEngines: false });
      const withBuild = await scan({ targetDir: root, mode: "audit", runEngines: false, build: true });

      expect(ids(withoutBuild)).not.toContain("STS-TECH-006");
      expect(withoutBuild.coverage.evaluatedRules).not.toContain("STS-TECH-006");
      expect(ids(withBuild)).toContain("STS-TECH-006");
      expect(withBuild.coverage.evaluatedRules).toContain("STS-TECH-006");
      expect(withBuild.verdict).toBe("DO-NOT-SHIP");
      expect(withBuild.findings.find((finding) => finding.id === "STS-TECH-006")?.file)
        .toBe("dist/assets/app.js");
      expect(withBuild.coverage.build).toEqual({
        requested: true,
        status: "completed",
        command: "npm run build",
        scannedFiles: 1,
        outputPaths: ["dist"],
        skippedLargeFiles: 0,
        skippedSymlinks: 0
      });

      const excluded = await scan({
        targetDir: root,
        mode: "audit",
        runEngines: false,
        build: true,
        excludes: ["dist/assets"]
      });
      expect(ids(excluded)).not.toContain("STS-TECH-006");
      expect(excluded.coverage.build.status).toBe("no-supported-output");
    });
  });

  it("does not flag a generated asset without a credential-shaped literal", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({
        name: "clean-bundle-demo",
        scripts: { build: "node build.mjs" }
      }));
      await write(root, "build.mjs", `
        import { mkdir, writeFile } from "node:fs/promises";
        await mkdir("dist/assets", { recursive: true });
        await writeFile("dist/assets/app.js", 'globalThis.publicKey="pk_live_public_demo";');
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false, build: true });

      expect(ids(result)).not.toContain("STS-TECH-006");
      expect(result.coverage.build.status).toBe("completed");
    });
  });

  it("marks ambiguous dist output for review instead of claiming it is browser-served", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({
        name: "server-dist-demo",
        scripts: { build: "node build.mjs" }
      }));
      await write(root, "build.mjs", `
        import { mkdir, writeFile } from "node:fs/promises";
        await mkdir("dist", { recursive: true });
        await writeFile("dist/server.js", 'globalThis.providerKey="sk-proj-' + 'testfixture0123456789abcdef";');
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false, build: true });
      const finding = result.findings.find((item) => item.id === "STS-TECH-006");

      expect(result.verdict).toBe("SHIP-WITH-WARNINGS");
      expect(finding?.confidence).toBe("medium");
      expect(finding?.needsReview).toBe(true);
    });
  });

  it("flags cookie-authenticated state changes without CSRF protection and permissive CORS", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({ dependencies: { next: "latest" } }));
      await write(root, "app/api/account/route.ts", `
        import { cookies } from "next/headers";
        export async function DELETE() {
          const session = (await cookies()).get("session");
          return Response.json(
            { deleted: Boolean(session) },
            { headers: { "Access-Control-Allow-Origin": "*" } }
          );
        }
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("STS-TECH-003");
      expect(ids(result)).toContain("STS-TECH-004");
    });
  });

  it("does not flag origin-protected cookie routes or public webhook routes", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({ dependencies: { next: "latest" } }));
      await write(root, "app/api/account/route.ts", `
        import { cookies } from "next/headers";
        export async function PATCH(request: Request) {
          const origin = request.headers.get("origin");
          if (origin !== process.env.APP_ORIGIN) {
            return new Response("Forbidden", { status: 403 });
          }
          const session = (await cookies()).get("session");
          return Response.json({ updated: Boolean(session) });
        }
      `);
      await write(root, "app/api/webhook/route.ts", `
        export async function POST(request: Request) {
          const signature = request.headers.get("stripe-signature");
          return Response.json({ accepted: Boolean(signature) });
        }
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).not.toContain("STS-TECH-003");
      expect(ids(result)).not.toContain("STS-TECH-004");
    });
  });

  it("flags dependency names one edit from common provider packages as low-confidence hints", async () => {
    const result = await scan({
      targetDir: path.resolve("fixtures/dependency-name-hints"),
      mode: "audit",
      runEngines: false
    });
    const dependencyHints = result.findings.filter((finding) => finding.id === "STS-TECH-005");

    expect(dependencyHints.map((finding) => finding.title)).toEqual([
      "Dependency name closely resembles openai",
      "Dependency name closely resembles @supabase/supabase-js"
    ]);
    expect(dependencyHints.every((finding) => finding.severity === "LOW" && finding.confidence === "low")).toBe(true);
    expect(dependencyHints.every((finding) => finding.why.includes("not a malware verdict"))).toBe(true);
    expect(decideVerdict(dependencyHints)).toBe("SHIP");
  });

  it("ignores unrelated package names and invalid manifests for dependency similarity hints", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({ dependencies: { commander: "latest", picocolors: "latest" } }));
      const unrelated = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(unrelated)).not.toContain("STS-TECH-005");

      await write(root, "package.json", "{ invalid json");
      const invalid = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(invalid)).not.toContain("STS-TECH-005");

      await write(root, "package.json", "null");
      const nonObject = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(nonObject)).not.toContain("STS-TECH-005");
    });
  });

  it("checks legacy Next.js pages API routes for cookie-authenticated state changes", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({ dependencies: { next: "latest" } }));
      await write(root, "pages/api/profile.ts", `
        export default async function handler(req, res) {
          if (req.method === "PUT") {
            const session = req.cookies.session;
            res.setHeader("Access-Control-Allow-Origin", "*");
            return res.json({ updated: Boolean(session) });
          }
          return res.status(405).end();
        }
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      expect(ids(result)).toContain("STS-TECH-003");
      expect(ids(result)).toContain("STS-TECH-004");
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
      expect(ids(result)).toContain("STS-QUICK-001");
      expect(ids(result)).toContain("STS-QUICK-003");
      expect(result.verdict).toBe("DO-NOT-SHIP");
    });
  });

  it("creates a hardening plan and applies deterministic safe fixes", async () => {
    await withProject(async (root) => {
      await write(root, "package.json", JSON.stringify({ name: "launch-demo", dependencies: { next: "latest" } }));
      await write(root, "next.config.js", "module.exports = { productionBrowserSourceMaps: true };");
      await write(root, "app/page.tsx", `
        export default function Page() {
          return <input type="email" name="email" />;
        }
      `);

      const result = await scan({ targetDir: root, mode: "audit", runEngines: false });
      const hardening = await createHardeningPlan(result, true);
      const nextConfig = await readFile(path.join(root, "next.config.js"), "utf8");
      const plan = await readFile(path.join(root, "SAFETOSHIP_HARDENING_PLAN.md"), "utf8");

      expect(nextConfig).toContain("productionBrowserSourceMaps: false");
      expect(hardening.changedFiles).toContain("PRIVACY.md");
      expect(hardening.changedFiles).toContain("SAFETOSHIP_HARDENING_PLAN.md");
      expect(hardening.changedFiles).toContain("SECURITY.md");
      expect(plan).toContain("SafeToShip Hardening Plan");
    });
  });

  it("has true-positive and true-negative coverage for every legal and cost rule", async () => {
    await withProject(async (root) => {
      await write(root, "components/Client.tsx", `
        "use client";
        const directSecret = "sk-fake-demo-key-do-not-use";
      `);

      const directSecretResult = await scan({ targetDir: root, mode: "audit", runEngines: false });
      const fixtureResults = await Promise.all(
        ["fixtures/insecure-next-supabase", "fixtures/legal-gaps", "fixtures/cost-abuse", "fixtures/clean-next-supabase"].map(
          async (fixture) => scan({ targetDir: path.resolve(fixture), mode: "audit", runEngines: false })
        )
      );
      const positiveIds = new Set([...fixtureResults.flatMap((result) => ids(result)), ...ids(directSecretResult)]);
      const cleanResult = fixtureResults[3];

      for (const ruleId of [
        "STS-COST-001",
        "STS-COST-002",
        "STS-COST-003",
        "STS-COST-004",
        "STS-COST-005",
        "STS-COST-006",
        "STS-COST-007",
        "STS-LEGAL-001",
        "STS-LEGAL-002",
        "STS-LEGAL-003",
        "STS-LEGAL-004",
        "STS-LEGAL-005",
        "STS-LEGAL-006"
      ]) {
        expect(positiveIds.has(ruleId), `${ruleId} should have a true-positive fixture`).toBe(true);
        expect(ids(cleanResult).includes(ruleId), `${ruleId} should not fire in the clean fixture`).toBe(false);
      }
    });
  });
});

async function withProject(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "safetoship-"));
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

function uniqueIds(result: { findings: Array<{ id: string }> }): string[] {
  return [...new Set(ids(result))].sort();
}
