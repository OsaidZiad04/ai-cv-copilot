import { NextResponse } from "next/server";
import { summaryRequestSchema } from "@/lib/schema";
import { fallbackSummary } from "@/lib/cv";
import { selectProvider } from "@/lib/providers";
import { readJsonLimited } from "@/lib/http";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const profile = summaryRequestSchema.parse(await readJsonLimited(request, 262_144));
    const provider = selectProvider({ LLM_PROVIDER: process.env.LLM_PROVIDER, GROQ_API_KEY: process.env.GROQ_API_KEY, GROQ_MODEL: process.env.GROQ_MODEL });
    try {
      return NextResponse.json({ summary: await provider.summary(profile), mode: provider.mode }, { headers });
    } catch {
      return NextResponse.json({ summary: fallbackSummary(profile), mode: "guided" }, { headers });
    }
  } catch {
    return NextResponse.json({ error: "Please review your CV information." }, { status: 400, headers });
  }
}
