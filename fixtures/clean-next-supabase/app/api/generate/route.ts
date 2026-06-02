import OpenAI from "openai";

const rateLimit = {
  async limit(_key: string) {
    return { success: true };
  }
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const quota = await rateLimit.limit(ip);

  if (!quota.success) {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const body = await request.json();
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: body.prompt
  });

  return Response.json({ text: response.output_text });
}
