import type { CandidateProfile } from "./schema";
import { clean, hasText, splitList } from "./cv";

export function readinessChecks(profile: CandidateProfile): string[] {
  const checks: string[] = [];
  if (!hasText(profile.personal.email)) checks.push("Add an email address so reviewers can contact you.");
  if (!hasText(profile.personal.linkedin)) checks.push("Consider adding a LinkedIn profile if you have one.");
  for (const project of profile.projects) {
    if (hasText(project.name) && !hasText(project.contribution)) checks.push(`${project.name}: clarify what you personally contributed.`);
  }
  const allBullets = [...profile.projects, ...profile.experience].flatMap((item) => item.bullets);
  if (allBullets.some((bullet) => clean(bullet).length > 240)) checks.push("Shorten long bullets for easier scanning.");
  const vague = new Set(["teamwork", "communication", "leadership", "problem solving", "hard working"]);
  const skills = Object.values(profile.skills).flatMap(splitList);
  if (skills.some((skill) => vague.has(skill.toLowerCase())) && profile.projects.length + profile.experience.length === 0) checks.push("Support broad skills with a project or experience example.");
  if (profile.projects.length + profile.experience.length === 0) checks.push("Add a project, activity, training, or experience that shows your work.");
  return checks;
}
