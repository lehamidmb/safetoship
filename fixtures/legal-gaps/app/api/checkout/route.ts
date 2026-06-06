import Stripe from "stripe";

const rateLimit = { async limit() { return { success: true }; } };

export async function POST() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const quota = await rateLimit.limit();
  if (!quota.success) {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [],
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel"
  });

  return Response.json({ url: session.url });
}
