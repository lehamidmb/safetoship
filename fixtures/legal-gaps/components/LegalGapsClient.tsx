"use client";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://demo.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-demo-do-not-use"
);

async function signIn(email: string) {
  await supabase.auth.signInWithOtp({ email });
}

export default function LegalGapsClient() {
  return (
    <main>
      <h1>Legal Gaps</h1>
      <label htmlFor="legal-email">Email</label>
      <input
        id="legal-email"
        type="email"
        name="email"
        onBlur={(event) => void signIn(event.currentTarget.value)}
      />
      <form action="/api/checkout" method="post">
        <button type="submit">Start paid plan</button>
      </form>
    </main>
  );
}
