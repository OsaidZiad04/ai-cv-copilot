import { createEmailHandler, emailConfig, sendWithBrevo } from "@/lib/email-cv";

export const runtime = "nodejs";
export const maxDuration = 30;
export function GET() {
  return Response.json({ enabled: emailConfig(process.env).enabled }, { headers: { "Cache-Control": "no-store" } });
}
export const POST = createEmailHandler({
  config: () => emailConfig(process.env),
  render: async (profile) => (await import("@/lib/pdf/render")).renderCvPdf(profile),
  send: sendWithBrevo,
});
