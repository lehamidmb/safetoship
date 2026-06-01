import type { Finding, ProjectFile } from "../types.js";
import { fixPrompt } from "../fixPrompt.js";
import {
  hasUseClient,
  isLikelyClientPath,
  isServerEndpointPath,
  isSqlFile,
  lineForIndex
} from "../project.js";

const SECRETISH_PUBLIC_ENV =
  /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|OPENAI|ANTHROPIC|STRIPE|TWILIO|SENDGRID|RESEND)[A-Z0-9_]*\b/g;
const DIRECT_SECRET_VALUE = /(sk_live_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{8,}|service_role|SUPABASE_SERVICE_ROLE|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const PAID_API_SIGNAL = /(openai|@anthropic-ai|anthropic|stripe|resend|sendgrid|twilio|mailgun|postmark|elevenlabs|replicate)/i;
const RATE_LIMIT_SIGNAL = /(@upstash\/ratelimit|express-rate-limit|rateLimit|ratelimit|rate-limit|limiter|throttle|slowDown|token bucket|sliding window)/i;

export function runAbuseCostRules(files: ProjectFile[]): Finding[] {
  return [
    ...findFrontendSecrets(files),
    ...findSupabaseServiceRoleInClient(files),
    ...findSupabaseRlsProblems(files),
    ...findClientSideOnlyUsageLimits(files),
    ...findPaidEndpointsWithoutRateLimits(files)
  ];
}

export function findFrontendSecrets(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    const publicEnvMatches = [...file.content.matchAll(SECRETISH_PUBLIC_ENV)];
    for (const match of publicEnvMatches) {
      findings.push({
        id: "SV-COST-001",
        title: "Secret-shaped value is exposed through NEXT_PUBLIC_",
        severity: "BLOCKER",
        family: "abuse-cost",
        file: file.relativePath,
        line: lineForIndex(file.content, match.index ?? 0),
        why: `${match[0]} is named like a private credential but is exposed to browser code because it starts with NEXT_PUBLIC_. Anyone can read it from the frontend bundle.`,
        fixPrompt: fixPrompt(
          `${match[0]} is exposed to the browser through NEXT_PUBLIC_.`,
          "Move the secret to a server-only environment variable, move the paid-provider call behind a server route, and update the client to call that route without receiving the secret."
        )
      });
    }

    const clientFile = hasUseClient(file) || isLikelyClientPath(file.relativePath);
    if (clientFile && DIRECT_SECRET_VALUE.test(file.content)) {
      const match = DIRECT_SECRET_VALUE.exec(file.content);
      findings.push({
        id: "SV-COST-002",
        title: "Secret-shaped value is reachable from frontend code",
        severity: "BLOCKER",
        family: "abuse-cost",
        file: file.relativePath,
        line: lineForIndex(file.content, match?.index ?? 0),
        why: "A value that looks like a private API key, password, or privileged token appears in code that can reach the browser. This can lead to stolen keys and runaway bills.",
        fixPrompt: fixPrompt(
          "A private-looking key or token is in frontend-reachable code.",
          "Remove the credential from client code, rotate it if it was real, move all provider calls server-side, and add a test or lint rule that prevents this pattern from coming back."
        )
      });
    }
  }

  return dedupe(findings);
}

export function findSupabaseServiceRoleInClient(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    const publicServiceRole = /\b(?:process\.env\.)?NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*\b/i.exec(file.content);
    const clientReachable = hasUseClient(file) || isLikelyClientPath(file.relativePath) || Boolean(publicServiceRole);
    const match = publicServiceRole ?? /(SUPABASE_SERVICE_ROLE|service_role|"role"\s*:\s*"service_role")/i.exec(file.content);

    if (!clientReachable || !match) {
      continue;
    }

    findings.push({
      id: "SV-COST-003",
      title: "Supabase service_role appears reachable from the client",
      severity: "BLOCKER",
      family: "abuse-cost",
      file: file.relativePath,
      line: lineForIndex(file.content, match.index),
      why: "The Supabase service_role key bypasses Row Level Security. If it reaches the browser, users can often read or modify data they should never touch.",
      fixPrompt: fixPrompt(
        "A Supabase service_role credential appears reachable from client code.",
        "Remove service_role from all browser-reachable files and NEXT_PUBLIC variables, rotate the key if it was real, and create a server-only Supabase admin client used only inside protected server routes."
      )
    });
  }

  return findings;
}

export function findSupabaseRlsProblems(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];
  const sqlFiles = files.filter((file) => isSqlFile(file.relativePath));
  const allSql = sqlFiles.map((file) => file.content).join("\n").toLowerCase();

  for (const file of sqlFiles) {
    const createTablePattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-zA-Z_][\w]*)"?/gi;
    for (const match of file.content.matchAll(createTablePattern)) {
      const tableName = match[1];
      const enablePattern = new RegExp(
        `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:"?public"?\\.)?"?${escapeRegExp(tableName)}"?\\s+enable\\s+row\\s+level\\s+security`,
        "i"
      );

      if (!enablePattern.test(allSql)) {
        findings.push({
          id: "SV-COST-004",
          title: "Supabase public table is created without enabling RLS",
          severity: "BLOCKER",
          family: "abuse-cost",
          file: file.relativePath,
          line: lineForIndex(file.content, match.index ?? 0),
          why: `The public.${tableName} table is created without a matching ENABLE ROW LEVEL SECURITY statement. In Supabase, public tables without RLS are a common data-leak path.`,
          fixPrompt: fixPrompt(
            `The Supabase table public.${tableName} is missing an obvious RLS enable statement.`,
            `Add ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY; then create least-privilege policies using auth.uid() or equivalent ownership checks. Do not use broad authenticated-user policies as a shortcut.`
          )
        });
      }
    }

    const broadPolicyPattern =
      /create\s+policy[\s\S]{0,1200}?using\s*\(\s*(true|auth\.role\s*\(\s*\)\s*=\s*['"]authenticated['"])\s*\)/gi;
    for (const match of file.content.matchAll(broadPolicyPattern)) {
      findings.push({
        id: "SV-COST-005",
        title: "Supabase policy looks too broad",
        severity: "BLOCKER",
        family: "abuse-cost",
        file: file.relativePath,
        line: lineForIndex(file.content, match.index ?? 0),
        why: "A Supabase RLS policy uses USING(true) or allows every authenticated user. That often means any logged-in user can read or mutate rows they do not own.",
        fixPrompt: fixPrompt(
          "A Supabase RLS policy appears to allow all rows to all authenticated users.",
          "Replace the broad policy with least-privilege policies tied to auth.uid(), tenant_id, team membership, or another ownership boundary. Add a test case showing user A cannot read user B's rows."
        )
      });
    }
  }

  return findings;
}

export function findClientSideOnlyUsageLimits(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    const clientFile = hasUseClient(file) || isLikelyClientPath(file.relativePath);
    const hasBrowserLimit = /(localStorage|sessionStorage|indexedDB|document\.cookie)[\s\S]{0,1200}(limit|quota|usage|credits?|remaining|max)/i.test(file.content);
    const hasPaidReachability =
      PAID_API_SIGNAL.test(file.content) ||
      /fetch\s*\(\s*['"`]\/api\/(?:generate|chat|complete|email|sms|payment|checkout)/i.test(file.content);

    if (!clientFile || !hasBrowserLimit || !hasPaidReachability) {
      continue;
    }

    const match = /(localStorage|sessionStorage|indexedDB|document\.cookie)/i.exec(file.content);
    findings.push({
      id: "SV-COST-006",
      title: "Paid usage limit appears enforced only in the browser",
      severity: "BLOCKER",
      family: "abuse-cost",
      file: file.relativePath,
      line: lineForIndex(file.content, match?.index ?? 0),
      why: "This file stores a usage limit in browser-controlled storage while a paid API path appears reachable from the same client flow. Users can edit browser storage and bypass the limit.",
      fixPrompt: fixPrompt(
        "A paid usage or quota limit appears to be enforced only in frontend code.",
        "Move quota enforcement to the server. Store usage by user/IP/account in a server-side store, check it before every paid provider call, and make the frontend display the server's remaining quota instead of deciding locally."
      )
    });
  }

  return findings;
}

export function findPaidEndpointsWithoutRateLimits(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (!isServerEndpointPath(file.relativePath) || !PAID_API_SIGNAL.test(file.content) || RATE_LIMIT_SIGNAL.test(file.content)) {
      continue;
    }

    const match = PAID_API_SIGNAL.exec(file.content);
    findings.push({
      id: "SV-COST-007",
      title: "Paid provider endpoint has no obvious server-side rate limit",
      severity: "HIGH",
      family: "abuse-cost",
      file: file.relativePath,
      line: lineForIndex(file.content, match?.index ?? 0),
      why: "This server endpoint appears to call a paid provider, but ShipVerdict could not find a server-side rate limit. That leaves you exposed to abuse and surprise bills.",
      fixPrompt: fixPrompt(
        "A server endpoint calls a paid provider without an obvious rate limit.",
        "Add server-side rate limiting before the paid API call using Upstash Ratelimit, express-rate-limit, your API gateway, or a durable database counter. Return 429 when the limit is exceeded."
      )
    });
  }

  return findings;
}

function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.id}:${finding.file}:${finding.line}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
