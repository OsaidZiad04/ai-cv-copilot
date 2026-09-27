"use client";

import type { CandidateProfile } from "@/lib/schema";
import { projectBullet, experienceBullet } from "@/lib/cv";

type Props = { profile: CandidateProfile; onChange: (profile: CandidateProfile) => void };
type StringKey<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];

function TextField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className="field"><span>{label}</span>{multiline
    ? <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={2000} rows={3} />
    : <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={500} />}</label>;
}

const personalLabels: Record<keyof CandidateProfile["personal"], string> = {
  fullName: "Full name", headline: "Professional headline", email: "Email", phone: "Phone", location: "City and country", linkedin: "LinkedIn", portfolio: "GitHub or portfolio",
};
const skillLabels: Record<keyof CandidateProfile["skills"], string> = {
  programming: "Programming", aiData: "AI and data", tools: "Tools and platforms", domain: "Domain skills", soft: "People skills",
};

export function ProfileEditor({ profile, onChange }: Props) {
  const setGroup = <K extends "personal" | "careerGoal" | "skills">(group: K, key: StringKey<CandidateProfile[K]>, value: string) => onChange({ ...profile, [group]: { ...profile[group], [key]: value } });
  const updateArray = <K extends "education" | "projects" | "experience">(group: K, index: number, patch: Partial<CandidateProfile[K][number]>) => onChange({ ...profile, [group]: profile[group].map((item, i) => i === index ? { ...item, ...patch } : item) });
  const removeArray = <K extends "education" | "projects" | "experience">(group: K, index: number) => onChange({ ...profile, [group]: profile[group].filter((_, i) => i !== index) });

  return <div className="editor-stack">
    <div className="panel"><div className="section-heading"><div><span className="eyebrow">Identity</span><h2>Contact & direction</h2></div></div>
      <div className="field-grid">{(Object.keys(personalLabels) as (keyof CandidateProfile["personal"])[]).map((key) => <TextField key={key} label={personalLabels[key]} value={profile.personal[key]} onChange={(value) => setGroup("personal", key, value)} />)}
        <TextField label="Target role" value={profile.careerGoal.role} onChange={(value) => setGroup("careerGoal", "role", value)} />
        <TextField label="Field" value={profile.careerGoal.field} onChange={(value) => setGroup("careerGoal", "field", value)} />
        <TextField label="Opportunity type" value={profile.careerGoal.opportunity} onChange={(value) => setGroup("careerGoal", "opportunity", value)} />
      </div>
      <TextField label="Professional summary" value={profile.summary} onChange={(value) => onChange({ ...profile, summary: value })} multiline />
    </div>

    <div className="panel"><div className="section-heading"><div><span className="eyebrow">Background</span><h2>Education</h2></div><button className="text-button" type="button" onClick={() => onChange({ ...profile, education: [...profile.education, { institution: "", degree: "", major: "", graduation: "", gpa: "" }] })}>+ Add education</button></div>
      {profile.education.map((item, index) => <div className="edit-item" key={index}><div className="item-heading"><strong>Education {index + 1}</strong><button className="text-button danger" onClick={() => removeArray("education", index)}>Remove</button></div><div className="field-grid">
        {(["institution", "degree", "major", "graduation", "gpa"] as const).map((key) => <TextField key={key} label={({ institution: "Institution", degree: "Degree", major: "Major", graduation: "Graduation", gpa: "GPA (optional)" })[key]} value={item[key]} onChange={(value) => updateArray("education", index, { [key]: value })} />)}
      </div></div>)}
    </div>

    <div className="panel"><div className="section-heading"><div><span className="eyebrow">Evidence</span><h2>Projects</h2></div><button className="text-button" type="button" onClick={() => onChange({ ...profile, projects: [...profile.projects, { name: "", problem: "", built: "", technologies: "", contribution: "", outcome: "", link: "", bullets: [] }] })}>+ Add project</button></div>
      {profile.projects.map((item, index) => <div className="edit-item" key={index}><div className="item-heading"><strong>{item.name || `Project ${index + 1}`}</strong><button className="text-button danger" onClick={() => removeArray("projects", index)}>Remove</button></div><div className="field-grid">
        {(["name", "problem", "built", "technologies", "contribution", "outcome", "link"] as const).map((key) => <TextField key={key} label={({ name: "Project name", problem: "Problem", built: "What you built", technologies: "Technologies", contribution: "Your contribution", outcome: "Result", link: "Link" })[key]} value={item[key]} onChange={(value) => updateArray("projects", index, { [key]: value })} multiline={["problem", "built", "contribution"].includes(key)} />)}
      </div><TextField label="CV bullets (one per line)" value={item.bullets.join("\n")} onChange={(value) => updateArray("projects", index, { bullets: value.split("\n") })} multiline />
        <button className="text-button" onClick={() => updateArray("projects", index, { bullets: [projectBullet(item)].filter(Boolean) })}>Rewrite from my facts</button>
      </div>)}
    </div>

    <div className="panel"><div className="section-heading"><div><span className="eyebrow">Track record</span><h2>Experience</h2></div><button className="text-button" type="button" onClick={() => onChange({ ...profile, experience: [...profile.experience, { role: "", organization: "", dates: "", details: "", bullets: [] }] })}>+ Add experience</button></div>
      {profile.experience.map((item, index) => <div className="edit-item" key={index}><div className="item-heading"><strong>{item.role || `Experience ${index + 1}`}</strong><button className="text-button danger" onClick={() => removeArray("experience", index)}>Remove</button></div><div className="field-grid">
        {(["role", "organization", "dates", "details"] as const).map((key) => <TextField key={key} label={({ role: "Role", organization: "Organization", dates: "Dates", details: "What you did" })[key]} value={item[key]} onChange={(value) => updateArray("experience", index, { [key]: value })} multiline={key === "details"} />)}
      </div><TextField label="CV bullets (one per line)" value={item.bullets.join("\n")} onChange={(value) => updateArray("experience", index, { bullets: value.split("\n") })} multiline />
        <button className="text-button" onClick={() => updateArray("experience", index, { bullets: [experienceBullet(item.details)].filter(Boolean) })}>Rewrite from my facts</button>
      </div>)}
    </div>

    <div className="panel"><div className="section-heading"><div><span className="eyebrow">Finishing details</span><h2>Skills & extras</h2></div></div>
      <div className="field-grid">{(Object.keys(skillLabels) as (keyof CandidateProfile["skills"])[]).map((key) => <TextField key={key} label={skillLabels[key]} value={profile.skills[key]} onChange={(value) => setGroup("skills", key, value)} />)}</div>
      <p className="hint">One item per line for the sections below. Clear a section to remove it from the CV.</p>
      <div className="field-grid">{(["certifications", "training", "volunteering", "awards", "languages"] as const).map((key) => <TextField key={key} label={({ certifications: "Certifications", training: "Training", volunteering: "Activities & volunteering", awards: "Awards", languages: "Languages" })[key]} value={profile[key].join("\n")} onChange={(value) => onChange({ ...profile, [key]: value.split("\n") })} multiline />)}</div>
    </div>
  </div>;
}
