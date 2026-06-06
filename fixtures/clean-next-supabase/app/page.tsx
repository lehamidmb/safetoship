import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clean Next Supabase",
  description: "A launch-ready Next.js and Supabase fixture for SafeToShip."
};

export default function Page() {
  return (
    <main>
      <h1>Clean Next Supabase</h1>
      <form action="/api/generate">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" name="email" />
        <button type="submit">Generate</button>
      </form>
    </main>
  );
}
