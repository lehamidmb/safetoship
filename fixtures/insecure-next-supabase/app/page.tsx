"use client";

import { useState } from "react";

const publicOpenAiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "sk-fake-demo-key-do-not-use";

export default function Page() {
  const [email, setEmail] = useState("");
  const [prompt, setPrompt] = useState("");

  async function generate() {
    const used = Number(localStorage.getItem("dailyUsage") ?? "0");
    if (used >= 5) {
      alert("You hit today's limit");
      return;
    }

    localStorage.setItem("dailyUsage", String(used + 1));
    await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, publicOpenAiKey })
    });
  }

  return (
    <main>
      <h1>Demo Launch App</h1>
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      <button onClick={generate}>Generate</button>
    </main>
  );
}
