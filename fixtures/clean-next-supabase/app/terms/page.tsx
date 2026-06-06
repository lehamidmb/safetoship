import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms governing use of Clean Next Supabase."
};

export default function TermsPage() {
  return (
    <main>
      <h1>Terms of Use</h1>
      <p>Users must use the service lawfully, keep account credentials secure, and avoid abusive automation.</p>
      <p>The service is provided as-is. To the maximum extent allowed by law, liability is limited to amounts paid for the service.</p>
      <p>These terms are governed by the laws of the launch jurisdiction. Contact legal@example.com with questions.</p>
    </main>
  );
}
