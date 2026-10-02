import type { CandidateProfile } from "./schema";
import { clean, hasText, splitList } from "./cv";

export type ReviewTask = { id: string; message: string; reason: string; source: string; field: string };
export type ReviewExample = { key: string; label: string; action: string; field: string };
const actionWords = /\b(organized|organised|led|built|created|prepared|designed|implemented|analyzed|analysed|coordinated|taught|translated|developed|wrote|supported|tested|compared|reviewed|collected|conducted|facilitated|maintained|helped|delivered|managed|produced|recorded|ran|used|sketched|drafted|prototyped|presented|researched)\b/i;
export function suppliedExamples(profile: CandidateProfile): ReviewExample[] {
  const examples: Omit<ReviewExample, "key">[] = [];
  profile.projects.forEach((p, i) => {
    const action = clean(p.contribution) || clean(p.built);
    if (action) examples.push({ label: `Project ${i + 1}: ${p.name || "Untitled"}`, action, field: `projects-${i}-${hasText(p.contribution) ? "contribution" : "built"}` });
  });
  profile.experience.forEach((e, i) => { if (hasText(e.details)) examples.push({ label: `Experience ${i + 1}: ${e.role || "Untitled"}`, action: e.details, field: `experience-${i}-details` }); });
  for (const group of ["volunteering", "training"] as const) profile[group].forEach((action, i) => {
    if (actionWords.test(action)) examples.push({ label: `${group === "volunteering" ? "Activity" : "Training"} ${i + 1}`, action, field: group });
  });
  // Identity uses the supplied text, not an array position. Reorder re-resolves the current field.
  const occurrences = new Map<string, number>();
  return examples.map(e => {
    const identity = JSON.stringify([e.label.replace(/^(Project|Experience|Activity|Training) \d+/, "$1"), e.action]);
    const occurrence = occurrences.get(identity) || 0;
    occurrences.set(identity, occurrence + 1);
    return { ...e, key: JSON.stringify([identity, occurrence]) };
  });
}

// Deliberately accepts only two exact year or English month/year endpoints.
// Ambiguous numeric dates and mixed precision abstain; no locale inference.
export function reversedDates(value: string): boolean {
  const parts = value.trim().split(/\s+(?:-|–|—|to)\s+/i);
  if (parts.length !== 2) return false;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const parse = (part: string) => {
    if (/^(19|20)\d{2}$/.test(part)) return { value: Number(part) * 12, precision: "year" };
    const m = /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+((?:19|20)\d{2})$/i.exec(part);
    return m ? { value: Number(m[2]) * 12 + months.indexOf(m[1].slice(0, 3).toLowerCase()), precision: "month" } : null;
  };
  const [start, end] = parts.map(parse);
  return !!start && !!end && start.precision === end.precision && start.value > end.value;
}

export function skillMention(skill: string, sources: string[]): "mentioned" | "context" | "absent" {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Explicit tokens: R != RStudio, C != C++, C++ != C. Preserve symbolic suffixes.
  const token = new RegExp(`(?<![\\p{L}\\p{N}_+#])${escaped}(?![\\p{L}\\p{N}_+#])`, "iu");
  let uncertain = false;
  for (const source of sources) for (const sentence of source.split(/[.!?;\n]+/)) {
    if (!token.test(sentence)) continue;
    if (/\b(no|not|never|without|didn['’]t|haven['’]t|team|teammate|studied|studying|learning|course|tutorial|planned|planning)\b/i.test(sentence)) uncertain = true;
    else return "mentioned";
  }
  return uncertain ? "context" : "absent";
}

export function reviewTasks(profile: CandidateProfile): ReviewTask[] {
  const tasks: ReviewTask[] = [];
  const add = (id: string, message: string, reason: string, source: string, field: string) => tasks.push({ id, message, reason, source, field });
  profile.experience.forEach((e, i) => { if (reversedDates(e.dates)) add(`dates-${i}`, "Check the employment date order.", "The supplied start date is later than the end date. Confirm the dates with the candidate.", e.dates, `experience-${i}-dates`); });
  profile.education.forEach((e, i) => { if (/\b(graduated|completed)\b/i.test(e.graduation) && /\bexpected\b/i.test(e.graduation)) add(`graduation-${i}`, "Clarify the graduation status.", "The same field contains completed and expected graduation wording. Ask which statement applies.", e.graduation, `education-${i}-graduation`); });
  profile.projects.forEach((p, i) => {
    if (!hasText(p.name)) return;
    if (!hasText(p.built) && !hasText(p.contribution)) add(`action-${i}`, `${p.name}: ask what work has been done.`, "A project title alone does not describe an action. Ask whether this is planned work, coursework, or completed work; no metric is required.", `Project ${i + 1}: ${p.name}`, `projects-${i}-contribution`);
    else if (!hasText(p.contribution)) add(`contribution-${i}`, `${p.name}: clarify what you personally contributed.`, "The built-work field is supplied, but the personal contribution field is empty.", p.built, `projects-${i}-contribution`);
  });
  const sources = [...profile.projects.flatMap(p => [p.built, p.technologies, p.contribution, p.outcome]), ...profile.experience.map(e => e.details), ...profile.volunteering, ...profile.training];
  for (const group of ["programming", "aiData"] as const) for (const skill of splitList(profile.skills[group])) {
    const mention = skillMention(skill, sources);
    if (mention !== "mentioned") add(`skill-${group}-${skill}`, mention === "context" ? `${skill}: ask about personal use and context.` : `${skill}: not explicitly mentioned in supplied examples.`, mention === "context" ? "A literal mention includes uncertain, team, learning, or negated context. Ask what the candidate personally did; this does not judge ability." : "An exact token was not found in raw project, experience, activity, or training facts. Ask for context or leave it for discussion; absence does not mean inability.", profile.skills[group], `skills-${group}`);
  }
  const examples = suppliedExamples(profile);
  if (!examples.length) add("example", "Choose an action example to discuss.", "No action example is available in the current fields. Activities, training, coursework, or work can count; employment and metrics are optional.", [...profile.volunteering, ...profile.training].filter(hasText).join("; ") || "No supplied action example", "volunteering");
  if (!hasText(profile.personal.email)) add("email", "Add an email address so reviewers can contact you.", "The contact email field is empty.", "Email: empty", "personal-email");
  if (!hasText(profile.personal.linkedin) && !hasText(profile.personal.portfolio)) add("link", "Add a LinkedIn or portfolio link if you have one.", "Both optional professional link fields are empty.", "LinkedIn / portfolio: empty", "personal-portfolio");
  profile.projects.forEach((p, i) => { if (hasText(p.name) && (hasText(p.built) || hasText(p.contribution)) && !hasText(p.outcome)) add(`outcome-${i}`, `${p.name}: add a result if you can verify one; a metric is optional.`, "Work is described but the result field is empty. This is optional polish, not an evidence requirement.", `Project ${i + 1}: ${p.name}`, `projects-${i}-outcome`); });
  [...profile.projects, ...profile.experience].forEach((item, i) => {
    if (item.bullets.some(b => clean(b).length > 240)) {
      const project = i < profile.projects.length;
      const index = project ? i : i - profile.projects.length;
      add(`long-${i}`, "Shorten long bullets for easier scanning.", "A stored bullet exceeds the existing 240 character scanning heuristic. Check that facts remain after editing.", item.bullets.join("\n"), `${project ? "projects" : "experience"}-${index}-bullets`);
    }
  });
  const vague = new Set(["teamwork", "communication", "leadership", "problem solving", "hard working"]);
  if (!examples.length && Object.values(profile.skills).flatMap(splitList).some(s => vague.has(s.toLowerCase()))) add("broad", "Support broad skills with an action example.", "Broad skill labels have no supplied action example yet; activities or coursework can count.", profile.skills.soft || Object.values(profile.skills).join(", "), "skills-soft");
  if (profile.summary.length > 350) add("summary", "Shorten the summary so your strongest evidence is easy to find.", "The summary exceeds the existing 350 character readability heuristic. This check does not verify its claims or freshness.", profile.summary, "summary");
  return tasks;
}

export function readinessChecks(profile: CandidateProfile): string[] { return reviewTasks(profile).map(task => task.message); }
