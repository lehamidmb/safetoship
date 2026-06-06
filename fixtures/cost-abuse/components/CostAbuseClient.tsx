"use client";

async function generate() {
  const currentUsage = Number(localStorage.getItem("generationQuota") ?? "0");
  if (currentUsage >= 5) {
    return;
  }

  localStorage.setItem("generationQuota", String(currentUsage + 1));
  await fetch("/api/generate", { method: "POST" });
}

export default function CostAbuseClient() {
  return (
    <main>
      <h1>Cost Abuse</h1>
      <button type="button" onClick={generate}>Generate</button>
    </main>
  );
}
