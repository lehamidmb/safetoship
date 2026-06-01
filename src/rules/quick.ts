import type { Finding, ProjectFile } from "../types.js";
import { fixPrompt } from "../fixPrompt.js";
import { hasUseClient, isServerEndpointPath, lineForIndex } from "../project.js";

const SECRET_PATTERN =
  /(sk_live_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{8,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{20,}|NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)[A-Z0-9_]*|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;

export function runQuickRules(files: ProjectFile[]): Finding[] {
  return [
    ...findSecretsOutsideEnv(files),
    ...findClientOnlyAuthGuards(files),
    ...findUnsafeDbQueryInterpolation(files)
  ];
}

export function findSecretsOutsideEnv(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (/\.env(\.|$)|\.env$/.test(file.relativePath)) {
      continue;
    }

    const match = SECRET_PATTERN.exec(file.content);
    if (!match) {
      continue;
    }

    findings.push({
      id: "STS-QUICK-001",
      title: "Secret-shaped value appears outside an env file",
      severity: "BLOCKER",
      family: "quick",
      file: file.relativePath,
      line: lineForIndex(file.content, match.index),
      why: "A value that looks like an API key or privileged secret appears outside an env file. If it is real and committed, rotate it before launch.",
      fixPrompt: fixPrompt(
        "A secret-shaped value appears outside an env file.",
        "Move the secret into a server-only environment variable, rotate it if it was real, and replace the code with process.env access only on the server."
      )
    });
  }

  return findings;
}

export function findClientOnlyAuthGuards(files: ProjectFile[]): Finding[] {
  const hasServerMiddleware = files.some((file) => /(^|\/)middleware\.(ts|js)$/.test(file.relativePath));
  const findings: Finding[] = [];

  for (const file of files) {
    if (!hasUseClient(file)) {
      continue;
    }

    const hasClientRedirect = /(!user|!session|isAuthenticated\s*===\s*false|authLoading)[\s\S]{0,600}(router\.push|redirect|window\.location)/i.test(file.content);
    const hasSensitivePageSignal = /(dashboard|admin|account|billing|settings|profile|orders|messages)/i.test(file.relativePath + file.content);

    if (!hasClientRedirect || !hasSensitivePageSignal || hasServerMiddleware) {
      continue;
    }

    const match = /(router\.push|redirect|window\.location)/i.exec(file.content);
    findings.push({
      id: "STS-QUICK-002",
      title: "Sensitive page appears protected only by client-side redirect",
      severity: "HIGH",
      family: "quick",
      file: file.relativePath,
      line: lineForIndex(file.content, match?.index ?? 0),
      why: "A sensitive page appears to redirect unauthenticated users only in browser code. Client-side guards are useful UX, but they do not protect server data by themselves.",
      fixPrompt: fixPrompt(
        "A sensitive page appears protected only by a client-side auth guard.",
        "Add server-side authorization in middleware, route handlers, server components, or database policies. Keep the client redirect for UX, but make the server reject unauthorized access."
      )
    });
  }

  return findings;
}

export function findUnsafeDbQueryInterpolation(files: ProjectFile[]): Finding[] {
  const findings: Finding[] = [];
  const unsafeQuery =
    /(query|execute|raw|sql)\s*\(\s*`[\s\S]{0,500}\$\{[\s\S]{0,500}`\s*\)|\$\{[\s\S]{0,200}\}[\s\S]{0,200}(select|insert|update|delete)\s/i;

  for (const file of files) {
    if (!isServerEndpointPath(file.relativePath) && !/(^|\/)(db|database|repositories|models)\//.test(file.relativePath)) {
      continue;
    }

    const match = unsafeQuery.exec(file.content);
    if (!match) {
      continue;
    }

    findings.push({
      id: "STS-QUICK-003",
      title: "Database query appears to interpolate user-controlled input",
      severity: "BLOCKER",
      family: "quick",
      file: file.relativePath,
      line: lineForIndex(file.content, match.index),
      why: "A database query appears to build SQL with string interpolation. If user input reaches this query, it can become SQL injection.",
      fixPrompt: fixPrompt(
        "A database query appears to use string interpolation.",
        "Replace interpolated SQL with parameterized queries or your ORM's safe query builder. Add a regression test with a single quote in the input."
      )
    });
  }

  return findings;
}
