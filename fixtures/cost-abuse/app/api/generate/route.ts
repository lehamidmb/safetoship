import OpenAI from "openai";

export async function POST() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: "Generate launch copy"
  });

  return Response.json({ text: response.output_text });
}
