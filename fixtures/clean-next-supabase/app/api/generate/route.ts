import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabaseServer";

const rateLimit = {
  async limit(_key: string) {
    return { success: true };
  }
};

export async function POST(request: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
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
  const supabase = createServerSupabaseClient();
  await supabase.from("generations").insert({
    prompt: body.prompt,
    response: response.output_text
  });

  return Response.json({ text: response.output_text });
}
