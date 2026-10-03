import { createHash } from "node:crypto";
import { z } from "zod";
import { candidateProfileSchema, type CandidateProfile } from "./schema";
import { readJsonLimited } from "./http";

export const emailRequestSchema = z.object({
  profile: candidateProfileSchema.extend({ personal: candidateProfileSchema.shape.personal.extend({ email: z.string().trim().max(240).email() }) }),
}).strict();

export type EmailConfig = { enabled: boolean; key: string; from: string; fromName: string };
export function emailConfig(env: NodeJS.ProcessEnv): EmailConfig {
  return { enabled: env.CV_EMAIL_SEND_ENABLED === "true", key: env.BREVO_API_KEY || "", from: env.CV_EMAIL_FROM || "", fromName: env.CV_EMAIL_FROM_NAME || "AI CV Copilot" };
}
export function safeCvFilename(name: string): string {
  const safe = name.normalize("NFKC").replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").slice(0, 80);
  return `${safe && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(safe) ? safe : "My"}_CV.pdf`;
}

// Best effort per-instance only. Hashes expire; no candidate or CV history is retained.
export class EmailThrottle {
  private entries = new Map<string, { count: number; until: number }>();
  take(email: string, ip: string, now = Date.now()): boolean {
    for (const [key, value] of this.entries) if (value.until <= now) this.entries.delete(key);
    if (this.entries.size >= 1000) return false;
    const recipient = createHash("sha256").update(`recipient:${email.toLowerCase()}`).digest("hex");
    const source = createHash("sha256").update(`source:${ip}`).digest("hex");
    if (this.entries.has(recipient) || (this.entries.get(source)?.count || 0) >= 5) return false;
    this.entries.set(recipient, { count: 1, until: now + 60_000 });
    const previous = this.entries.get(source);
    this.entries.set(source, { count: (previous?.count || 0) + 1, until: previous?.until || now + 600_000 });
    return true;
  }
}

export async function sendWithBrevo(profile: CandidateProfile, pdf: Buffer, config: EmailConfig, signal: AbortSignal, fetcher = fetch): Promise<void> {
  const firstName = profile.personal.fullName.replace(/[\p{C}]/gu, " ").trim().split(/\s+/)[0]?.slice(0, 80) || "there";
  const response = await fetcher("https://api.brevo.com/v3/smtp/email", {
    method: "POST", signal,
    headers: { "api-key": config.key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: config.from, name: config.fromName }, to: [{ email: profile.personal.email }],
      subject: "Your CV from AI CV Copilot",
      textContent: `Hi ${firstName},\n\nYour CV from the CV Corner is attached.\n\nPlease review all information before using it in an application, especially contact details, dates, project contributions and generated wording.\n\nGood luck with your next opportunity.\n\n— AI CV Copilot`,
      attachment: [{ name: safeCvFilename(profile.personal.fullName), content: pdf.toString("base64") }],
    }),
  });
  // Provider response bodies can contain private operational information. Never forward or log them.
  if (!response.ok) { await response.body?.cancel(); throw new Error("Delivery unavailable"); }
  await response.body?.cancel();
}

type Dependencies = {
  config: () => EmailConfig;
  render: (profile: CandidateProfile) => Promise<Buffer>;
  send: typeof sendWithBrevo;
  throttle?: EmailThrottle;
  timeoutMs?: number;
};
const headers = { "Cache-Control": "no-store" };
const unavailable = "Email delivery is unavailable right now. You can still save your CV as PDF.";
export function createEmailHandler(dependencies: Dependencies) {
  const throttle = dependencies.throttle || new EmailThrottle();
  let active = 0;
  return async (request: Request): Promise<Response> => {
    const config = dependencies.config();
    if (!config.enabled || !config.key || !z.string().email().safeParse(config.from).success || config.fromName.length > 120) return Response.json({ error: unavailable }, { status: 503, headers });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: unavailable }, { status: 403, headers });
    let profile: CandidateProfile;
    let bodyTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid input");
      const bodyTimeout = new Promise<never>((_, reject) => { bodyTimer = setTimeout(() => reject(new Error("Input timeout")), Math.min(dependencies.timeoutMs || 2000, 2000)); });
      profile = emailRequestSchema.parse(await Promise.race([readJsonLimited(request, 262_144), bodyTimeout])).profile;
      if (JSON.stringify(profile).length > 60_000) throw new Error("Profile too large for delivery");
    } catch { return Response.json({ error: "Please review your CV details and email address before sending." }, { status: 400, headers }); }
    finally { clearTimeout(bodyTimer); }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 100) || "local";
    if (active >= 2 || !throttle.take(profile.personal.email, ip)) return Response.json({ error: "Please wait before sending again. You can still save your CV as PDF." }, { status: 429, headers });
    active++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs || 25_000);
    const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("Delivery timeout")), { once: true }));
    try {
      const pdf = await Promise.race([dependencies.render(profile), aborted]);
      if (controller.signal.aborted || pdf.length > 2_000_000 || pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("PDF unavailable");
      await Promise.race([dependencies.send(profile, pdf, config, controller.signal), aborted]);
      return Response.json({ sent: true }, { headers });
    } catch { return Response.json({ error: unavailable }, { status: 503, headers }); }
    finally { clearTimeout(timer); active--; }
  };
}
