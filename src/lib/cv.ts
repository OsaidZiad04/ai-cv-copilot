import type { CandidateProfile } from "./schema";

export function clean(value: string): string { return value.trim().replace(/\s+/g, " "); }
export function hasText(value: string): boolean { return Boolean(clean(value)); }
export function splitList(value: string): string[] { return value.split(/[,;\n]/).map(clean).filter(Boolean); }

export function projectBullet(project: CandidateProfile["projects"][number]): string {
  const action = clean(project.contribution || project.built);
  const result = clean(project.outcome);
  const technology = clean(project.technologies);
  if (!action) return "";
  const main = technology && !action.toLowerCase().includes(technology.toLowerCase())
    ? `${action.replace(/[.;\s]+$/, "")} using ${technology}` : action;
  const sentences = [main, result].filter(Boolean);
  return sentences.map((sentence) => clean(sentence).replace(/[.;\s]+$/, "") + ".").join(" ");
}

export function experienceBullet(details: string): string {
  const value = clean(details);
  return value ? value.replace(/[.;\s]+$/, "") + "." : "";
}

export function fallbackSummary(profile: CandidateProfile): string {
  const role = clean(profile.careerGoal.role);
  const major = clean(profile.education[0]?.major || profile.education[0]?.degree || "");
  const project = profile.projects.find((item) => hasText(item.name));
  const skill = splitList(project?.technologies || "")[0] || Object.values(profile.skills).flatMap(splitList)[0];
  const identity = major ? `${major} candidate` : "Early-career candidate";
  const evidence = project ? ` with project work on ${clean(project.name)}` : "";
  const tools = skill ? ` using ${skill}` : "";
  const goal = role ? ` Seeking ${role} opportunities.` : "";
  return `${identity}${evidence}${tools}.${goal}`;
}

export function hasUnsupportedNumbers(generated: string, source: string): boolean {
  const supplied = new Set(source.match(/\d+(?:[.,]\d+)?%?/g) || []);
  return (generated.match(/\d+(?:[.,]\d+)?%?/g) || []).some((number) => !supplied.has(number));
}

export type CvSection = "education" | "projects" | "experience" | "skills" | "certifications" | "training" | "volunteering" | "awards" | "languages";

export function visibleSections(profile: CandidateProfile): CvSection[] {
  const hasExperience = profile.experience.some((e) => hasText(e.role) || hasText(e.organization) || e.bullets.some(hasText));
  const isCurrentStudent = /expected|current|present/i.test(profile.education[0]?.graduation || "");
  const order: CvSection[] = hasExperience && !isCurrentStudent
    ? ["experience", "education", "projects", "skills", "certifications", "training", "volunteering", "awards", "languages"]
    : ["education", "projects", "experience", "skills", "training", "certifications", "volunteering", "awards", "languages"];
  return order.filter((section) => {
    if (section === "skills") return Object.values(profile.skills).some(hasText);
    if (section === "education") return profile.education.some((e) => hasText(e.institution) || hasText(e.degree));
    if (section === "projects") return profile.projects.some((p) => hasText(p.name) || hasText(p.built));
    if (section === "experience") return hasExperience;
    return profile[section].some(hasText);
  });
}
