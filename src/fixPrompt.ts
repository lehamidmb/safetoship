export function fixPrompt(problem: string, requestedFix: string): string {
  return [
    "Claude Code / Codex / Cursor fix prompt:",
    `I am preparing this app for launch. ${problem}`,
    requestedFix,
    "Make the smallest safe change, show the full diff, and add or update tests where practical."
  ].join("\n");
}
