"use client";

export default function Page() {
  async function generate() {
    const currentUsage = Number(localStorage.getItem("generationQuota") ?? "0");
    if (currentUsage >= 5) {
      return;
    }

    localStorage.setItem("generationQuota", String(currentUsage + 1));
    await fetch("/api/generate", { method: "POST" });
  }

  return (
    <main>
      <h1>Cost Abuse</h1>
      <button onClick={generate}>Generate</button>
    </main>
  );
}
