import { promises as fs } from "node:fs";
import path from "node:path";
import { RULE_METADATA } from "./ruleMetadata.js";
import type { Confidence, RuleOverride, SafeToShipConfig, Severity } from "./types.js";

const CONFIG_FILE = ".safetoshiprc.json";
const severities = new Set<Severity>(["LOW", "MEDIUM", "HIGH", "BLOCKER"]);
const confidences = new Set<Confidence>(["low", "medium", "high"]);

export async function loadConfig(targetDir: string): Promise<{ config: SafeToShipConfig; warnings: string[] }> {
  const configPath = path.join(targetDir, CONFIG_FILE);
  let raw: string;

  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { config: emptyConfig(), warnings: [] };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${CONFIG_FILE} is not valid JSON.`);
  }

  if (!isObject(parsed)) {
    throw new Error(`${CONFIG_FILE} must contain a JSON object.`);
  }

  const warnings: string[] = [];
  const exclude = Array.isArray(parsed.exclude) && parsed.exclude.every((value) => typeof value === "string")
    ? parsed.exclude
    : [];
  if (parsed.exclude !== undefined && exclude.length === 0 && JSON.stringify(parsed.exclude) !== "[]") {
    warnings.push(`${CONFIG_FILE}: exclude must be an array of path strings.`);
  }

  const rules: Record<string, RuleOverride> = {};
  if (parsed.rules !== undefined && !isObject(parsed.rules)) {
    throw new Error(`${CONFIG_FILE}: rules must be an object keyed by rule ID.`);
  }

  for (const [id, value] of Object.entries((parsed.rules as Record<string, unknown> | undefined) ?? {})) {
    const normalizedId = id.toUpperCase();
    if (!RULE_METADATA.has(normalizedId)) {
      warnings.push(`${CONFIG_FILE}: ignored unknown rule ${id}.`);
      continue;
    }
    if (!isObject(value)) {
      warnings.push(`${CONFIG_FILE}: ignored non-object override for ${id}.`);
      continue;
    }
    const override: RuleOverride = {};
    if (typeof value.enabled === "boolean") override.enabled = value.enabled;
    if (typeof value.reason === "string") override.reason = value.reason.trim();
    if (typeof value.severity === "string" && severities.has(value.severity.toUpperCase() as Severity)) {
      override.severity = value.severity.toUpperCase() as Severity;
    } else if (value.severity !== undefined) {
      warnings.push(`${CONFIG_FILE}: ignored invalid severity for ${id}.`);
    }
    if (typeof value.confidence === "string" && confidences.has(value.confidence.toLowerCase() as Confidence)) {
      override.confidence = value.confidence.toLowerCase() as Confidence;
    } else if (value.confidence !== undefined) {
      warnings.push(`${CONFIG_FILE}: ignored invalid confidence for ${id}.`);
    }
    rules[normalizedId] = override;
  }

  return {
    config: {
      exclude,
      rules,
      deployGate: parsed.deployGate === true
    },
    warnings
  };
}

function emptyConfig(): SafeToShipConfig {
  return { exclude: [], rules: {} };
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
