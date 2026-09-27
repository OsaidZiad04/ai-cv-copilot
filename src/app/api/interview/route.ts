import { NextResponse } from "next/server";
import { interviewRequestSchema } from "@/lib/schema";
import { guidedReply } from "@/lib/interview";
import { selectProvider } from "@/lib/providers";

export async function POST(request: Request) {
  try {
    const input = interviewRequestSchema.parse(await request.json());
    const provider = selectProvider({ LLM_PROVIDER: process.env.LLM_PROVIDER, GROQ_API_KEY: process.env.GROQ_API_KEY, GROQ_MODEL: process.env.GROQ_MODEL });
    try {
      const output = await provider.interview(input);
      return NextResponse.json({ ...output, mode: provider.mode });
    } catch {
      return NextResponse.json({ reply: guidedReply(input.step, input.values), bullet: "", mode: "guided" });
    }
  } catch {
    return NextResponse.json({ error: "Please check your answers and try again." }, { status: 400 });
  }
}
