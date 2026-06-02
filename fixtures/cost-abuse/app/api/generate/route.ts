import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST() {
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: "Generate launch copy"
  });

  return Response.json({ text: response.output_text });
}
