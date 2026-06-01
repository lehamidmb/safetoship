import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = await openai.responses.create({
    model: "gpt-5-mini",
    input: body.prompt
  });

  return Response.json({ text: result.output_text });
}
