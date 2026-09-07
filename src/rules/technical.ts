import type { Finding, ProjectFile } from "../types.js";
import { fixPrompt } from "../fixPrompt.js";
import { lineForIndex } from "../project.js";

const STATE_CHANGING_METHOD =
  /\b(?:export\s+(?:async\s+)?function|export\s+const)\s+(POST|PUT|PATCH|DELETE)\b|(?:req|request)\.method\s*(?:===|==)\s*["'](POST|PUT|PATCH|DELETE)["']/i;
const COOKIE_AUTH_SIGNAL =
  /\bcookies\s*\(|(?:req|request)\.cookies\b|getServerSession\s*\(|\bauth\s*\(\s*\)|supabase\.auth\.(?:getUser|getSession)\s*\(|getToken\s*\(|getAuth\s*\(/i;
const CSRF_ORIGIN_PROTECTION_SIGNAL =
  /\b(?:csrf|xsrf|same[-_ ]?origin|verifyOrigin|validateOrigin|allowedOrigins?|trustedOrigins?)\b|origin\s*(?:===|!==)|(?:includes|has)\s*\(\s*origin\b/i;
const PERMISSIVE_CORS_SIGNAL =
  /["']Access-Control-Allow-Origin["']\s*[:,]\s*["']\*["']|(?:set|setHeader)\s*\(\s*["']Access-Control-Allow-Origin["']\s*,\s*["']\*["']|cors\s*\(\s*\{[\s\S]{0,300}?origin\s*:\s*(?:true|["']\*["'])/i;
const BUILT_SECRET_LITERAL =
  /(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const DEPENDENCY_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
const COMMON_PROVIDER_PACKAGES = [
  "@anthropic-ai/sdk",
  "@supabase/supabase-js",
  "@vercel/postgres",
  "firebase-admin",
  "jsonwebtoken",
  "nodemailer",
  "openai",
  "prisma",
  "resend",
  "stripe",
  "twilio"
] as const;
const COMMON_PROVIDER_PACKAGE_SET = new Set<string>(COMMON_PROVIDER_PACKAGES);
const KNOWN_DISTINCT_PACKAGES = new Set(["openapi", "prism", "strip"]);

export function runTechnicalRules(files: ProjectFile[]): Finding[] {
  return [
    ...findProductionSourceMaps(files),
    ...findMissingNextSecurityHeaders(files),
    ...findCookieAuthenticatedRoutesWithoutCsrf(files),
    ...findPermissiveCorsOnStateChangingRoutes(files),
    ...findSuspiciousDependencyNames(files)
  ];
}

export function runBuiltAssetRules(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const match = BUILT_SECRET_LITERAL.exec(file.content);
    if (!match) continue;
    const clearlyBrowserServed = /^(?:\.next\/static\/|build\/static\/|out\/|dist\/assets\/)/.test(file.relativePath);
    findings.push({
      id: "STS-TECH-006",
      title: "Generated frontend asset contains a credential-shaped literal",
      severity: "BLOCKER",
      family: "technical",
      file: file.relativePath,
      line: lineForIndex(file.content, match.index),
      confidence: clearlyBrowserServed ? "high" : "medium",
      confidenceRationale: clearlyBrowserServed
        ? "A credential-shaped literal appears directly in a conventional browser-served build path."
        : "The dist output contains a credential-shaped literal, but SafeToShip cannot prove this particular file is browser-served.",
      why: clearlyBrowserServed
        ? "A credential-shaped literal is present in a conventional browser-served build path. SafeToShip does not print the value, but a browser user may be able to recover it from the bundle."
        : "A credential-shaped literal is present in dist output that may be deployed. SafeToShip does not print the value; confirm whether this file is browser-served or restricted to a trusted server runtime.",
      fixPrompt: fixPrompt(
        "A generated frontend asset contains a credential-shaped literal.",
        "Remove the credential from public build-time variables and client code, move privileged provider calls behind a protected server endpoint, rotate the credential if it was real, delete stale build output, rebuild, and rerun SafeToShip with --build."
      )
    });
  }
  return findings;
}

function findProductionSourceMaps(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files.filter((candidate) => /next\.config\.(js|mjs|ts)$/.test(candidate.relativePath))) {
    const match = /productionBrowserSourceMaps\s*:\s*true/.exec(file.content);
    if (!match) {
      continue;
    }

    findings.push({
      id: "STS-TECH-001",
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
      id: "STS-TECH-002",
      title: "Next.js security headers are missing or incomplete",
      severity: "MEDIUM",
      family: "technical",
      file: nextConfig?.relativePath ?? packageFile?.relativePath,
      line: 1,
      why: "This looks like a Next.js app, but SafeToShip could not find a solid security headers setup. Missing CSP, HSTS, X-Content-Type-Options, or frame protections makes common browser attacks easier.",
      fixPrompt: fixPrompt(
        "This Next.js app appears to be missing core security headers.",
        "Add a headers() config or middleware that sets Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, and X-Frame-Options. Keep the policy compatible with the current app."
      )
    }
  ];
}

function findCookieAuthenticatedRoutesWithoutCsrf(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files.filter((candidate) => isNextApiRoute(candidate.relativePath))) {
    const method = STATE_CHANGING_METHOD.exec(file.content);
    if (!method || !COOKIE_AUTH_SIGNAL.test(file.content) || CSRF_ORIGIN_PROTECTION_SIGNAL.test(file.content)) {
      continue;
    }

    findings.push({
      id: "STS-TECH-003",
      title: "Cookie-authenticated state-changing route has no obvious CSRF or origin check",
      severity: "HIGH",
      family: "technical",
      file: file.relativePath,
      line: lineForIndex(file.content, method.index),
      why: "This Next.js route changes state and appears to trust cookie or session authentication, but SafeToShip could not find a CSRF token or same-origin validation. A malicious site may be able to trigger the route using the victim's browser session.",
      fixPrompt: fixPrompt(
        "A cookie-authenticated state-changing Next.js route has no obvious CSRF or origin validation.",
        "Add a server-side CSRF defense appropriate to this route: validate a CSRF token or compare the Origin header against a strict allowlist before changing state. Keep public webhooks on a separate signature-verified path and add tests for rejected cross-origin requests."
      )
    });
  }

  return findings;
}

function findPermissiveCorsOnStateChangingRoutes(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files.filter((candidate) => isNextApiRoute(candidate.relativePath))) {
    if (!STATE_CHANGING_METHOD.test(file.content)) {
      continue;
    }

    const cors = PERMISSIVE_CORS_SIGNAL.exec(file.content);
    if (!cors) {
      continue;
    }

    findings.push({
      id: "STS-TECH-004",
      title: "State-changing route allows permissive cross-origin requests",
      severity: "HIGH",
      family: "technical",
      file: file.relativePath,
      line: lineForIndex(file.content, cors.index),
      why: "This Next.js route changes state while allowing any origin through CORS. That expands who can call the endpoint from a browser and can turn missing auth, CSRF, or abuse controls into a launch incident.",
      fixPrompt: fixPrompt(
        "A state-changing Next.js route uses permissive wildcard CORS.",
        "Remove wildcard CORS from the route or replace it with a strict allowlist of trusted application origins. Validate the Origin server-side, keep credentials disabled for untrusted origins, and add tests showing an unknown origin is rejected."
      )
    });
  }

  return findings;
}

function findSuspiciousDependencyNames(files: ProjectFile[]): Finding[] {
  const packageFile = files.find((file) => file.relativePath === "package.json");
  if (!packageFile) {
    return [];
  }

  let manifest: Record<string, unknown>;
  try {
    const parsed = JSON.parse(packageFile.content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    manifest = parsed as Record<string, unknown>;
  } catch {
    return [];
  }

  const dependencyNames = new Set<string>();
  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = manifest[section];
    if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      continue;
    }
    for (const name of Object.keys(dependencies)) {
      dependencyNames.add(name.toLowerCase());
    }
  }

  const findings: Finding[] = [];
  for (const dependencyName of [...dependencyNames].sort()) {
    if (
      KNOWN_DISTINCT_PACKAGES.has(dependencyName) ||
      COMMON_PROVIDER_PACKAGE_SET.has(dependencyName)
    ) {
      continue;
    }

    const expectedName = COMMON_PROVIDER_PACKAGES.find((knownName) => isSingleEditAway(dependencyName, knownName));
    if (!expectedName) {
      continue;
    }

    const matchIndex = packageFile.content.indexOf(`"${dependencyName}"`);
    findings.push({
      id: "STS-TECH-005",
      title: `Dependency name closely resembles ${expectedName}`,
      severity: "LOW",
      family: "technical",
      file: packageFile.relativePath,
      line: lineForIndex(packageFile.content, matchIndex),
      why: `The declared dependency ${dependencyName} is one edit away from the common package ${expectedName}. This may be an intentional package, a typo, a slopsquat, or an AI-hallucinated name; similarity alone is not a malware verdict.`,
      fixPrompt: fixPrompt(
        `The dependency ${dependencyName} closely resembles the common package ${expectedName}.`,
        `Before installing or deploying it, compare the intended package name with the provider's official documentation and inspect the package's registry publisher, repository, age, and provenance. If the name is a typo, replace it with ${expectedName}; if it is intentional, document the review with a reasoned SafeToShip suppression.`
      )
    });
  }

  return findings;
}

function isSingleEditAway(candidate: string, expected: string): boolean {
  if (candidate === expected || Math.abs(candidate.length - expected.length) > 1) {
    return false;
  }

  if (candidate.length === expected.length) {
    const mismatches: number[] = [];
    for (let index = 0; index < candidate.length; index += 1) {
      if (candidate[index] !== expected[index]) {
        mismatches.push(index);
      }
    }
    if (mismatches.length === 1) {
      return true;
    }
    return mismatches.length === 2 &&
      mismatches[1] === mismatches[0] + 1 &&
      candidate[mismatches[0]] === expected[mismatches[1]] &&
      candidate[mismatches[1]] === expected[mismatches[0]];
  }

  const longer = candidate.length > expected.length ? candidate : expected;
  const shorter = candidate.length > expected.length ? expected : candidate;
  for (let index = 0; index < longer.length; index += 1) {
    if (`${longer.slice(0, index)}${longer.slice(index + 1)}` === shorter) {
      return true;
    }
  }
  return false;
}

function isNextApiRoute(relativePath: string): boolean {
  return (
    /(^|\/)app\/api(?:\/.*)?\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(relativePath) ||
    /(^|\/)pages\/api\/.+\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(relativePath)
  );
}
