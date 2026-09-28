import { clean, experienceBullet, projectBullet, splitList } from "./cv";
import type { CandidateProfile } from "./schema";

export type StepId = "personal" | "goal" | "education" | "project" | "experience" | "skills" | "extras";
export type Field = { key: string; label: string; placeholder?: string; optional?: boolean; multiline?: boolean };
export type InterviewStep = { id: StepId; eyebrow: string; prompt: string; helper: string; fields: Field[] };

export const interviewSteps: InterviewStep[] = [
  { id: "personal", eyebrow: "01 / Introduction", prompt: "Let's start with the essentials. How should your CV introduce you?", helper: "Only include contact details you want on your CV.", fields: [
    { key: "fullName", label: "Full name", placeholder: "Your name" },
    { key: "email", label: "Email", placeholder: "you@example.com" },
    { key: "phone", label: "Phone", placeholder: "+962 ...", optional: true },
    { key: "location", label: "City and country", placeholder: "Amman, Jordan", optional: true },
    { key: "linkedin", label: "LinkedIn URL", optional: true },
    { key: "portfolio", label: "GitHub or portfolio URL", optional: true },
  ] },
  { id: "goal", eyebrow: "02 / Direction", prompt: "What kind of opportunity are you aiming for?", helper: "A specific direction helps us choose the strongest evidence for your CV.", fields: [
    { key: "role", label: "Target role", placeholder: "Data Analyst" },
    { key: "field", label: "Field", placeholder: "Data and analytics", optional: true },
    { key: "opportunity", label: "Opportunity type", placeholder: "Internship, graduate role, or full-time", optional: true },
  ] },
  { id: "education", eyebrow: "03 / Education", prompt: "Tell me about your current or most recent education.", helper: "GPA is optional. An expected graduation year is fine.", fields: [
    { key: "institution", label: "University or institution", placeholder: "University name" },
    { key: "degree", label: "Degree", placeholder: "BSc" },
    { key: "major", label: "Major", placeholder: "Computer Science" },
    { key: "graduation", label: "Graduation year", placeholder: "Expected 2027", optional: true },
    { key: "gpa", label: "GPA", optional: true },
  ] },
  { id: "project", eyebrow: "04 / Evidence", prompt: "What is one project you're proud of?", helper: "Class projects count. Describe your own work and any result you can verify; metrics are optional.", fields: [
    { key: "name", label: "Project name", placeholder: "Campus Helpdesk", optional: true },
    { key: "problem", label: "Problem it addressed", multiline: true, optional: true },
    { key: "built", label: "What you built", multiline: true, optional: true },
    { key: "technologies", label: "Tools or technologies", optional: true },
    { key: "contribution", label: "Your personal contribution", multiline: true, optional: true },
    { key: "outcome", label: "Result or impact, if known", multiline: true, optional: true },
    { key: "link", label: "Project link", optional: true },
  ] },
  { id: "experience", eyebrow: "05 / Experience", prompt: "Have you worked, volunteered, trained, or led an activity?", helper: "No employment history is needed. You can skip this and showcase projects or activities instead.", fields: [
    { key: "role", label: "Role", placeholder: "Volunteer coordinator", optional: true },
    { key: "organization", label: "Organization", optional: true },
    { key: "dates", label: "Dates", placeholder: "Jun 2025 – Aug 2025", optional: true },
    { key: "details", label: "What you did or achieved", multiline: true, optional: true },
  ] },
  { id: "skills", eyebrow: "06 / Skills", prompt: "Which skills can you back up with real work?", helper: "Use a short, relevant selection. Commas separate individual skills.", fields: [
    { key: "programming", label: "Programming", optional: true, placeholder: "Python, JavaScript" },
    { key: "aiData", label: "AI and data", optional: true, placeholder: "Pandas, machine learning" },
    { key: "tools", label: "Tools and platforms", optional: true, placeholder: "Figma, Excel, Git" },
    { key: "domain", label: "Field-specific", optional: true, placeholder: "User research, financial analysis" },
    { key: "soft", label: "People skills", optional: true, placeholder: "Facilitation, presentation" },
  ] },
  { id: "extras", eyebrow: "07 / Finishing touches", prompt: "Anything else that strengthens your story?", helper: "Add only what is useful. Separate multiple items with commas or new lines.", fields: [
    { key: "certifications", label: "Certifications", optional: true },
    { key: "training", label: "Training", optional: true },
    { key: "volunteering", label: "Volunteering or activities", optional: true },
    { key: "awards", label: "Awards or competitions", optional: true },
    { key: "languages", label: "Languages", optional: true },
  ] },
];

export function questionForStep(step: StepId, profile: CandidateProfile): string {
  const role = clean(profile.careerGoal.role);
  if (step === "project" && role) return `What project best shows your fit for ${role}?`;
  if (step === "experience" && profile.projects.length === 0) return "What have you done outside class that shows your strengths?";
  if (step === "skills" && profile.projects[0]?.technologies) return `Which skills from ${profile.projects[0].name || "your project"} and your other work should appear on your CV?`;
  return interviewSteps.find((item) => item.id === step)?.prompt || "Tell me a little more about your experience.";
}

export function valuesForStep(profile: CandidateProfile, step: StepId): Record<string, string> {
  if (step === "personal") {
    const { fullName, email, phone, location, linkedin, portfolio } = profile.personal;
    return { fullName, email, phone, location, linkedin, portfolio };
  }
  if (step === "goal") return { ...profile.careerGoal };
  if (step === "education") return { ...(profile.education[0] || {}) };
  if (step === "project") {
    const project = profile.projects[0];
    return project ? { name: project.name, problem: project.problem, built: project.built, technologies: project.technologies, contribution: project.contribution, outcome: project.outcome, link: project.link } : {};
  }
  if (step === "experience") {
    const experience = profile.experience[0];
    return experience ? { role: experience.role, organization: experience.organization, dates: experience.dates, details: experience.details } : {};
  }
  if (step === "skills") return { ...profile.skills };
  return { certifications: profile.certifications.join(", "), training: profile.training.join(", "), volunteering: profile.volunteering.join(", "), awards: profile.awards.join(", "), languages: profile.languages.join(", ") };
}

export function applyStep(profile: CandidateProfile, step: StepId, values: Record<string, string>, improvedBullet = ""): CandidateProfile {
  const v = (key: string) => clean(values[key] || "");
  if (step === "personal") return { ...profile, personal: { ...profile.personal, fullName: v("fullName"), email: v("email"), phone: v("phone"), location: v("location"), linkedin: v("linkedin"), portfolio: v("portfolio") } };
  if (step === "goal") return { ...profile, careerGoal: { role: v("role"), field: v("field"), opportunity: v("opportunity") }, personal: { ...profile.personal, headline: v("role") } };
  if (step === "education") return { ...profile, education: [{ institution: v("institution"), degree: v("degree"), major: v("major"), graduation: v("graduation"), gpa: v("gpa") }] };
  if (step === "project") {
    if (!v("name") && !v("built")) return { ...profile, projects: profile.projects.slice(1) };
    const item = { name: v("name"), problem: v("problem"), built: v("built"), technologies: v("technologies"), contribution: v("contribution"), outcome: v("outcome"), link: v("link"), bullets: [] as string[] };
    item.bullets = [clean(improvedBullet) || projectBullet(item)].filter(Boolean);
    return { ...profile, projects: [item, ...profile.projects.slice(1)] };
  }
  if (step === "experience") {
    if (!v("role") && !v("organization") && !v("details")) return { ...profile, experience: profile.experience.slice(1) };
    return { ...profile, experience: [{ role: v("role"), organization: v("organization"), dates: v("dates"), details: v("details"), bullets: [clean(improvedBullet) || experienceBullet(v("details"))].filter(Boolean) }, ...profile.experience.slice(1)] };
  }
  if (step === "skills") return { ...profile, skills: { programming: v("programming"), aiData: v("aiData"), tools: v("tools"), domain: v("domain"), soft: v("soft") } };
  return { ...profile, certifications: splitList(v("certifications")), training: splitList(v("training")), volunteering: splitList(v("volunteering")), awards: splitList(v("awards")), languages: splitList(v("languages")) };
}

export function guidedReply(step: StepId, values: Record<string, string>): string {
  if (step === "experience" && !values.role?.trim() && !values.details?.trim()) return "That's completely fine. Projects, training and university activities can show your strengths. Let's finish with the skills you can demonstrate.";
  if (step === "skills" && values.programming?.toLowerCase().includes("python")) return "Good. Make sure your projects or activities show where you used Python. One last question before your draft.";
  const replies: Record<StepId, string> = {
    personal: "Nice to meet you. Let's choose the opportunity your CV should support.",
    goal: "Great direction. Your education gives the reader useful context.",
    education: "Now let's show work you've actually done. A university project is a strong place to start.",
    project: "That gives your CV concrete evidence. Next, include any work, training or volunteering that applies.",
    experience: "Thanks. Let's capture the skills most relevant to your direction.",
    skills: "A focused skills list reads better than a long keyword list. Let's add any final credentials or activities.",
    extras: "Your first draft is ready. You can edit every line before saving it as a PDF.",
  };
  return replies[step];
}
