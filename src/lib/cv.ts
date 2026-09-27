import type { CandidateProfile } from "./schema";

export function clean(value: string): string { return value.trim().replace(/\s+/g, " "); }
export function hasText(value: string): boolean { return Boolean(clean(value)); }
export function splitList(value: string): string[] { return value.split(/[,;\n]/).map(clean).filter(Boolean); }

export function projectBullet(project: CandidateProfile["projects"][number]): string {
  const action = clean(project.contribution || project.built);
  const context = clean(project.built);
  const result = clean(project.outcome);
  const technology = clean(project.technologies);
  const sentence = action || context;
  if (!sentence) return "";
  const parts = [sentence];
  if (context && context !== action) parts.push(context.charAt(0).toLowerCase() + context.slice(1));
  if (technology && !parts.join(" ").toLowerCase().includes(technology.toLowerCase())) parts.push(`using ${technology}`);
  if (result) parts.push(`resulting in ${result.charAt(0).toLowerCase() + result.slice(1)}`);
  return clean(parts.join("; ")).replace(/[.;\s]+$/, "") + ".";
}

export function experienceBullet(details: string): string {
  const value = clean(details);
  return value ? value.replace(/[.;\s]+$/, "") + "." : "";
}

export function fallbackSummary(profile: CandidateProfile): string {
  const role = clean(profile.careerGoal.role);
  const major = clean(profile.education[0]?.major || profile.education[0]?.degree || "");
  const evidence = profile.projects.find((p) => hasText(p.built) || hasText(p.name));
  const skill = Object.values(profile.skills).flatMap(splitList)[0];
  const identity = major ? `Candidate with a ${major} background` : role ? `Early-career ${role.toLowerCase()} candidate` : "Early-career candidate";
  const work = evidence ? ` with project experience in ${clean(evidence.name || evidence.built)}` : "";
  const tools = skill ? ` using ${skill}` : "";
  const goal = role ? ` seeking ${role} opportunities` : "";
  return `${identity}${work}${tools}${goal}.`;
}

export function hasUnsupportedNumbers(generated: string, source: string): boolean {
  const supplied = new Set(source.match(/\d+(?:[.,]\d+)?%?/g) || []);
  return (generated.match(/\d+(?:[.,]\d+)?%?/g) || []).some((number) => !supplied.has(number));
}

export type CvSection = "education" | "projects" | "experience" | "skills" | "certifications" | "training" | "volunteering" | "awards" | "languages";

export function visibleSections(profile: CandidateProfile): CvSection[] {
  const hasExperience = profile.experience.some((e) => hasText(e.role) || hasText(e.organization) || e.bullets.some(hasText));
  const order: CvSection[] = hasExperience
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
