import type { CandidateProfile } from "./schema";
import { clean, hasText, splitList } from "./cv";

export function readinessChecks(profile: CandidateProfile): string[] {
  const checks: string[] = [];
  if (!hasText(profile.personal.email)) checks.push("Add an email address so reviewers can contact you.");
  if (!hasText(profile.personal.linkedin) && !hasText(profile.personal.portfolio)) checks.push("Add a LinkedIn or portfolio link if you have one.");
  for (const project of profile.projects) {
    if (hasText(project.name) && !hasText(project.contribution)) checks.push(`${project.name}: clarify what you personally contributed.`);
    if (hasText(project.name) && !hasText(project.outcome)) checks.push(`${project.name}: add a result if you can verify one; a metric is optional.`);
  }
  const allBullets = [...profile.projects, ...profile.experience].flatMap((item) => item.bullets);
  if (allBullets.some((bullet) => clean(bullet).length > 240)) checks.push("Shorten long bullets for easier scanning.");
  const vague = new Set(["teamwork", "communication", "leadership", "problem solving", "hard working"]);
  const skills = Object.values(profile.skills).flatMap(splitList);
  const evidence = [...profile.projects.flatMap((item) => [item.built, item.technologies, item.contribution, ...item.bullets]), ...profile.experience.flatMap((item) => [item.details, ...item.bullets])].join(" ").toLowerCase();
  const unsupported = splitList(profile.skills.programming).concat(splitList(profile.skills.aiData)).filter((skill) => !evidence.includes(skill.toLowerCase()));
  if (unsupported[0]) checks.push(`${unsupported[0]} is listed as a skill but is not shown in a project or experience bullet.`);
  if (skills.some((skill) => vague.has(skill.toLowerCase())) && profile.projects.length + profile.experience.length === 0) checks.push("Support broad skills with a project or experience example.");
  if (profile.projects.length + profile.experience.length === 0) checks.push("Add a project, activity, training, or experience that shows your work.");
  if (profile.summary.length > 350) checks.push("Shorten the summary so your strongest evidence is easy to find.");
  return checks;
}
