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
      const summary = await provider.summary(profile);
      return NextResponse.json({ summary: summary.trim() || fallbackSummary(profile), mode: provider.mode === "groq" && summary.trim() ? "groq" : "guided", fallback: provider.mode === "guided" }, { headers });
    } catch {
      return NextResponse.json({ summary: fallbackSummary(profile), mode: "guided", fallback: true }, { headers });
    }
  } catch {
    return NextResponse.json({ error: "Please review your CV information." }, { status: 400, headers });
  }
}
