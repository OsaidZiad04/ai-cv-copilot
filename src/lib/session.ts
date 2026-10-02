import { z } from "zod";
import { freshnessSchema } from "./freshness";
import { candidateProfileSchema } from "./schema";

export const sessionKey = "ai-cv-copilot-session-v2";

const savedSessionSchema = z.object({
  evidenceNote: z.object({ skill: z.string().max(240), example: z.string().max(2000) }).nullable().optional(),
  freshness: z.unknown().optional().transform((v) => freshnessSchema.safeParse(v).success ? freshnessSchema.parse(v) : undefined),
  phase: z.enum(["interview", "profile", "workspace"]),
  stepIndex: z.number().int().min(0).max(6),
  profile: candidateProfileSchema,
  mode: z.enum(["groq", "mock", "guided"]),
  aiEnabled: z.boolean(),
  view: z.enum(["preview", "edit", "review"]),
  draft: z.record(z.string().max(2000)).refine((value) => Object.keys(value).length <= 12),
  reply: z.string().max(500),
  enhancements: z.record(z.string().max(500)).refine((value) => Object.keys(value).length <= 3 && Object.keys(value).every((key) => key.length <= 12_000)).default({}),
});

export type SavedSession = z.infer<typeof savedSessionSchema>;

export function restoreSession(raw: string | null): SavedSession | null {
  if (!raw) return null;
  try {
    const result = savedSessionSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

export class SubmissionGate {
  private sequence = 0;
  private active = false;
  private lastFinishedAt = 0;

  begin(minIntervalMs = 0, now = Date.now()): number | null {
    if (this.active || (this.lastFinishedAt && now - this.lastFinishedAt < minIntervalMs)) return null;
    this.active = true;
    return ++this.sequence;
  }

  isCurrent(id: number): boolean { return this.active && id === this.sequence; }
  finish(id: number, now = Date.now()): boolean {
    if (!this.isCurrent(id)) return false;
    this.active = false;
    this.lastFinishedAt = now;
    return true;
  }
  cancel(): void { this.sequence++; this.active = false; this.lastFinishedAt = 0; }
}
