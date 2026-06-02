"use client";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Page() {
  async function signIn(email: string) {
    await supabase.auth.signInWithOtp({ email });
  }

  return (
    <main>
      <h1>Legal Gaps</h1>
      <input type="email" name="email" onBlur={(event) => void signIn(event.currentTarget.value)} />
      <a href="/api/checkout">Start paid plan</a>
    </main>
  );
}
