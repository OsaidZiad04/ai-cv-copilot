import { clean, splitList } from "./cv";
import { skillMention } from "./review";
import type { CandidateProfile } from "./schema";

export type EvidenceNote = { skill: string; example: string };

export function firstSkillGap(profile: CandidateProfile, draft: Record<string, string>, note?: EvidenceNote | null): string | null {
  const skills = ["programming", "aiData", "tools", "domain"].flatMap((key) => splitList(draft[key] || ""));
  const sources = [
    ...profile.projects.flatMap((project) => [project.problem, project.built, project.technologies, project.contribution, project.outcome]),
    ...profile.experience.map((item) => item.details),
    ...profile.training, ...profile.volunteering,
  ];
  return skills.find((skill) => {
    if (note?.skill.toLowerCase() === skill.toLowerCase()) return true;
    return skillMention(skill, sources) !== "mentioned";
  }) || null;
}

export function captureEvidenceNote(skill: string | null, answer: string): EvidenceNote | null {
  const example = clean(answer);
  return skill && example ? { skill, example } : null;
}

export function needsProjectContribution(draft: Record<string, string>): boolean {
  return Boolean(clean(draft.built || "") || clean(draft.problem || "")) && !clean(draft.contribution || "");
}
