import { NextResponse } from "next/server";
import { summaryRequestSchema } from "@/lib/schema";
import { fallbackSummary } from "@/lib/cv";
import { selectProvider } from "@/lib/providers";

export async function POST(request: Request) {
  try {
    const profile = summaryRequestSchema.parse(await request.json());
    const provider = selectProvider({ LLM_PROVIDER: process.env.LLM_PROVIDER, GROQ_API_KEY: process.env.GROQ_API_KEY, GROQ_MODEL: process.env.GROQ_MODEL });
    try {
      return NextResponse.json({ summary: await provider.summary(profile), mode: provider.mode });
    } catch {
      return NextResponse.json({ summary: fallbackSummary(profile), mode: "guided" });
    }
  } catch {
    return NextResponse.json({ error: "Please review your CV information." }, { status: 400 });
  }
}
