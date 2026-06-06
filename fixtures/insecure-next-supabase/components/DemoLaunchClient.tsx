"use client";

import { useState } from "react";
import { supabase } from "./SupabaseClient";

const publicOpenAiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "sk-fake-demo-key-do-not-use";

export default function DemoLaunchClient() {
  const [email, setEmail] = useState("");
  const [prompt, setPrompt] = useState("");

  async function generate() {
    const used = Number(localStorage.getItem("dailyUsage") ?? "0");
    if (used >= 5) {
      alert("You hit today's limit");
      return;
    }

    await supabase.auth.getSession();
    localStorage.setItem("dailyUsage", String(used + 1));
    await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt, publicOpenAiKey })
    });
  }

  return (
    <main>
      <h1>Demo Launch App</h1>
      <label htmlFor="demo-email">Email</label>
      <input
        id="demo-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label htmlFor="demo-prompt">Prompt</label>
      <textarea
        id="demo-prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <button type="button" onClick={generate}>Generate</button>
    </main>
  );
}
