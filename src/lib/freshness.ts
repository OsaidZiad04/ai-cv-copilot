import { z } from "zod";
import type { CandidateProfile } from "./schema";
import { projectBullet, experienceBullet, fallbackSummary } from "./cv";
import { toBulletLlmInput, toSummaryLlmInput } from "./llm-input";

type Group = "projects" | "experience";
export type IdentityChange = { group: Group; index: number; kind: "edit" | "remove" };
const artifactSchema = z.object({
  origin: z.enum(["guided", "groq", "manual", "unknown"]),
  fingerprint: z.string().max(160000).nullable(),
  conservative: z.string().max(160000).nullable(),
  reviewed: z.string().max(160000).nullable(),
  event: z.enum(["written", "edited", "regenerated", "kept", "unknown"]),
});
export const freshnessSchema = z.object({
  version: z.literal(1),
  projects: z.array(z.string().uuid()).max(15),
  experience: z.array(z.string().uuid()).max(15),
  artifacts: z.record(artifactSchema).refine((v) => Object.keys(v).length <= 31),
}).refine((v) => JSON.stringify(v).length <= 524288);
export type FreshnessState = z.infer<typeof freshnessSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type Proposal = { key: string; fingerprint: string; before: string[]; after: string[]; session: number; origin?: "guided" | "groq" };
const unknown = (): Artifact => ({ origin: "unknown", fingerprint: null, conservative: null, reviewed: null, event: "unknown" });
// Exact canonical serialization avoids hash collisions. It is local change metadata, not encryption.
export function canonical(value: unknown): string {
  function normalize(v: unknown): unknown {
    if (typeof v === "string") return v.replace(/[ \t\r\n]+/g, " ").trim();
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, normalize(x)]));
    return v;
  }
  return JSON.stringify(normalize(value));
}
export function initializeFreshness(profile: CandidateProfile): FreshnessState {
  const state: FreshnessState = { version: 1, projects: profile.projects.map(() => crypto.randomUUID()), experience: profile.experience.map(() => crypto.randomUUID()), artifacts: { summary: unknown() } };
  [...state.projects, ...state.experience].forEach((id) => { state.artifacts[id] = unknown(); });
  return state;
}
function bounded(profile: CandidateProfile, state: FreshnessState): FreshnessState {
  return freshnessSchema.safeParse(state).success ? state : initializeFreshness(profile);
}
export function restoreFreshness(profile: CandidateProfile, raw: unknown): FreshnessState {
  const parsed = freshnessSchema.safeParse(raw);
  if (!parsed.success) return initializeFreshness(profile);
  const s = parsed.data;
  const ids = [...s.projects, ...s.experience];
  if (s.projects.length !== profile.projects.length || s.experience.length !== profile.experience.length || new Set(ids).size !== ids.length || ids.some((id) => !s.artifacts[id]) || !s.artifacts.summary || Object.keys(s.artifacts).some((id) => id !== "summary" && !ids.includes(id))) return initializeFreshness(profile);
  return s;
}
export function artifactText(profile: CandidateProfile, state: FreshnessState, key: string): string[] {
  if (key === "summary") return [profile.summary];
  for (const group of ["projects", "experience"] as const) {
    const i = state[group].indexOf(key);
    if (i >= 0) return profile[group][i].bullets;
  }
  return [];
}
export function sourceFingerprint(profile: CandidateProfile, state: FreshnessState, key: string, origin = state.artifacts[key]?.origin): string {
  if (key === "summary") {
    // Conservative manual/legacy dependencies include all professional facts, but never contact or prose.
    const facts = { ...toSummaryLlmInput(profile), education: profile.education, projects: profile.projects.map(({ bullets: _bullets, link: _link, ...p }) => p) };
    return canonical({ facts, projects: state.projects, experience: state.experience });
  }
  const group = state.projects.includes(key) ? "projects" : "experience";
  const index = state[group].indexOf(key);
  if (index < 0) return canonical({ removed: key });
  if (group === "projects") {
    const p = profile.projects[index];
    if (origin === "guided") return canonical({ built: p.built, contribution: p.contribution, technologies: p.technologies, outcome: p.outcome });
    const { bullets: _bullets, link: _link, ...facts } = p;
    return canonical(origin === "groq" ? toBulletLlmInput("project", facts, profile.careerGoal.role) : { facts, targetRole: profile.careerGoal.role });
  }
  const e = profile.experience[index];
  if (origin === "guided") return canonical({ details: e.details });
  const { bullets: _bullets, ...facts } = e;
  return canonical(origin === "groq" ? toBulletLlmInput("experience", facts, profile.careerGoal.role) : { facts, targetRole: profile.careerGoal.role });
}
export function freshness(profile: CandidateProfile, state: FreshnessState, key: string): "current" | "stale" | "unknown" {
  const a = state.artifacts[key];
  if (!a || (!a.fingerprint && !a.reviewed)) return "unknown";
  return sourceFingerprint(profile, state, key) === (a.reviewed || a.fingerprint) ? "current" : "stale";
}
export function recordWritten(profile: CandidateProfile, state: FreshnessState, key: string, origin: "guided" | "groq", event: "written" | "regenerated" = "written"): FreshnessState {
  return bounded(profile, { ...state, artifacts: { ...state.artifacts, [key]: { origin, fingerprint: sourceFingerprint(profile, state, key, origin), conservative: sourceFingerprint(profile, state, key, "manual"), reviewed: null, event } } });
}
export function reconcileFreshness(before: CandidateProfile, next: CandidateProfile, state: FreshnessState, change?: IdentityChange): FreshnessState {
  const result: FreshnessState = { ...state, artifacts: { ...state.artifacts } };
  for (const group of ["projects", "experience"] as const) {
    const used = new Set<number>();
    result[group] = next[group].map((item, index) => {
      let match = before[group].findIndex((old, i) => !used.has(i) && old === item);
      if (match < 0 && change?.group === group && change.kind === "edit" && change.index === index) match = index;
      if (match < 0) {
        const candidates = before[group].flatMap((old, i) => !used.has(i) && canonical(old) === canonical(item) ? [i] : []);
        if (candidates.length === 1) match = candidates[0];
      }
      if (match >= 0 && !used.has(match)) { used.add(match); return state[group][match]; }
      const id = crypto.randomUUID(); result.artifacts[id] = unknown(); return id;
    });
  }
  for (const id of Object.keys(result.artifacts)) if (id !== "summary" && ![...result.projects, ...result.experience].includes(id)) delete result.artifacts[id];
  for (const key of Object.keys(result.artifacts)) {
    if (JSON.stringify(artifactText(before, state, key)) !== JSON.stringify(artifactText(next, result, key))) {
      const a = result.artifacts[key];
      // Preserve the original dependency baseline when wording changes. Manual != fresh.
      result.artifacts[key] = { ...a, origin: "manual", event: "edited", fingerprint: a.conservative, reviewed: a.reviewed ? a.conservative : null };
    }
  }
  return bounded(next, result);
}
export function keepWording(profile: CandidateProfile, state: FreshnessState, key: string): FreshnessState {
  return bounded(profile, { ...state, artifacts: { ...state.artifacts, [key]: { ...state.artifacts[key], reviewed: sourceFingerprint(profile, state, key), conservative: sourceFingerprint(profile, state, key, "manual"), event: "kept" } } });
}
export function proposeGuided(profile: CandidateProfile, state: FreshnessState, key: string, session: number): Proposal {
  const project = state.projects.indexOf(key);
  const experience = state.experience.indexOf(key);
  const after = key === "summary" ? [fallbackSummary(profile)] : project >= 0 ? [projectBullet(profile.projects[project])].filter(Boolean) : experience >= 0 ? [experienceBullet(profile.experience[experience].details)].filter(Boolean) : [];
  return { key, fingerprint: sourceFingerprint(profile, state, key), before: [...artifactText(profile, state, key)], after, session };
}
export function acceptProposal(profile: CandidateProfile, state: FreshnessState, proposal: Proposal, session: number): { profile: CandidateProfile; state: FreshnessState } | null {
  if (session !== proposal.session || !state.artifacts[proposal.key] || sourceFingerprint(profile, state, proposal.key) !== proposal.fingerprint || JSON.stringify(artifactText(profile, state, proposal.key)) !== JSON.stringify(proposal.before)) return null;
  const next = { ...profile };
  if (proposal.key === "summary") next.summary = proposal.after[0] || "";
  else for (const group of ["projects", "experience"] as const) {
    const index = state[group].indexOf(proposal.key);
    if (index >= 0 && group === "projects") next.projects = profile.projects.map((item, i) => i === index ? { ...item, bullets: [...proposal.after] } : item);
    if (index >= 0 && group === "experience") next.experience = profile.experience.map((item, i) => i === index ? { ...item, bullets: [...proposal.after] } : item);
  }
  return { profile: next, state: recordWritten(next, state, proposal.key, proposal.origin || "guided", "regenerated") };
}
