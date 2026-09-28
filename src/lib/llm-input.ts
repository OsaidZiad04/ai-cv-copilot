import type { CandidateProfile } from "./schema";
import type { StepId } from "./interview";

// Candidate text is evidence, never an instruction to the writing model.
export function professionalFact(value: string | undefined): string {
  return (value || "").split(/(?<=[.!?])\s+|\n+/).filter((part) =>
    !/ignore\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above)\s+instructions|disregard\s+(?:previous|prior|above)|(?:system|developer)\s+prompt|say\s+i\s+worked|pretend\s+(?:i|you)\s+/i.test(part),
  ).join(" ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "")
    .replace(/(?:\+?\d[\d(). -]{7,}\d)/g, "")
    .replace(/\s+/g, " ").trim();
}

const fact = (value: string | undefined) => professionalFact(value).slice(0, 2000);

export function toBulletLlmInput(step: StepId, values: Record<string, string>, targetRole: string) {
  if (step === "project") {
    const project = {
      name: fact(values.name), problem: fact(values.problem), built: fact(values.built),
      technologies: fact(values.technologies), contribution: fact(values.contribution), outcome: fact(values.outcome),
    };
    return project.built || project.contribution ? { targetRole: fact(targetRole), project } : null;
  }
  if (step === "experience") {
    const experience = { role: fact(values.role), organization: fact(values.organization), dates: fact(values.dates), details: fact(values.details) };
    return experience.details ? { targetRole: fact(targetRole), experience } : null;
  }
  return null;
}

export function toSummaryLlmInput(profile: CandidateProfile) {
  return {
    careerGoal: { role: fact(profile.careerGoal.role), field: fact(profile.careerGoal.field), opportunity: fact(profile.careerGoal.opportunity) },
    education: profile.education.map((entry) => ({ degree: fact(entry.degree), major: fact(entry.major), graduation: /\bexpected\b|\bgraduated\b|\bcompleted\b/i.test(entry.graduation) ? fact(entry.graduation) : "" })),
    projects: profile.projects.map((entry) => ({ name: fact(entry.name), built: fact(entry.built), technologies: fact(entry.technologies), contribution: fact(entry.contribution), outcome: fact(entry.outcome) })),
    experience: profile.experience.map((entry) => ({ role: fact(entry.role), organization: fact(entry.organization), dates: fact(entry.dates), details: fact(entry.details) })),
    skills: Object.fromEntries(Object.entries(profile.skills).map(([key, value]) => [key, fact(value)])),
    certifications: profile.certifications.map(fact), training: profile.training.map(fact),
    volunteering: profile.volunteering.map(fact), awards: profile.awards.map(fact),
  };
}

export function enhancementCacheKey(step: StepId, values: Record<string, string>, targetRole: string): string | null {
  const input = toBulletLlmInput(step, values, targetRole);
  return input ? `${step}:${JSON.stringify(input)}` : null;
}

export function isDemoMode(search: string): boolean { return new URLSearchParams(search).get("demo") === "1"; }
