import { z } from "zod";

const text = z.string().max(2000);
const short = z.string().max(240);
const url = z.string().max(500);

export const candidateProfileSchema = z.object({
  personal: z.object({
    fullName: short, headline: short, email: short, phone: short,
    location: short, linkedin: url, portfolio: url,
  }),
  careerGoal: z.object({ role: short, field: short, opportunity: short }),
  summary: text,
  education: z.array(z.object({ institution: short, degree: short, major: short, graduation: short, gpa: short })).max(10),
  projects: z.array(z.object({ name: short, problem: text, built: text, technologies: short, contribution: text, outcome: text, link: url, bullets: z.array(text).max(8) })).max(15),
  experience: z.array(z.object({ role: short, organization: short, dates: short, details: text, bullets: z.array(text).max(8) })).max(15),
  skills: z.object({ programming: short, aiData: short, tools: short, domain: short, soft: short }),
  certifications: z.array(short).max(20),
  training: z.array(short).max(20),
  volunteering: z.array(short).max(20),
  awards: z.array(short).max(20),
  languages: z.array(short).max(20),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;

export const emptyProfile = (): CandidateProfile => ({
  personal: { fullName: "", headline: "", email: "", phone: "", location: "", linkedin: "", portfolio: "" },
  careerGoal: { role: "", field: "", opportunity: "" },
  summary: "",
  education: [], projects: [], experience: [],
  skills: { programming: "", aiData: "", tools: "", domain: "", soft: "" },
  certifications: [], training: [], volunteering: [], awards: [], languages: [],
});

export const interviewRequestSchema = z.object({
  step: z.enum(["personal", "goal", "education", "project", "experience", "skills", "extras"]),
  values: z.record(z.string().max(2000)).refine((v) => Object.keys(v).length <= 12),
  targetRole: z.string().max(240),
});

export const aiResponseSchema = z.object({
  bullet: z.string().max(500),
});

export const summaryRequestSchema = candidateProfileSchema;
export const summaryResponseSchema = z.object({ summary: z.string().max(600) });
