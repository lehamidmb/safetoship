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

export function runTechnicalRules(files: ProjectFile[]): Finding[] {
  return [
    ...findProductionSourceMaps(files),
    ...findMissingNextSecurityHeaders(files),
    ...findCookieAuthenticatedRoutesWithoutCsrf(files),
    ...findPermissiveCorsOnStateChangingRoutes(files)
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

function isNextApiRoute(relativePath: string): boolean {
  return (
    /(^|\/)app\/api(?:\/.*)?\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(relativePath) ||
    /(^|\/)pages\/api\/.+\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(relativePath)
  );
}
