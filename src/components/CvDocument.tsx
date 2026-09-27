import type { CandidateProfile } from "@/lib/schema";
import { hasText, visibleSections, type CvSection } from "@/lib/cv";

const titles: Record<CvSection, string> = {
  education: "Education", projects: "Projects", experience: "Experience", skills: "Skills",
  certifications: "Certifications", training: "Training", volunteering: "Activities & Volunteering", awards: "Awards", languages: "Languages",
};

function SafeLink({ value }: { value: string }) {
  const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(href);
    if (!["http:", "https:"].includes(parsed.protocol)) return <span>{value}</span>;
    return <a href={parsed.href} target="_blank" rel="noopener noreferrer">{value.replace(/^https?:\/\//i, "")}</a>;
  } catch { return <span>{value}</span>; }
}

export function CvDocument({ profile }: { profile: CandidateProfile }) {
  const contact = [profile.personal.location, profile.personal.phone, profile.personal.email].filter(hasText);
  return <article className="cv-paper" aria-label="ATS Clean CV preview">
    <header className="cv-header">
      <h1>{profile.personal.fullName || "Your Name"}</h1>
      {(profile.personal.headline || profile.careerGoal.role) && <p className="cv-headline">{profile.personal.headline || profile.careerGoal.role}</p>}
      {contact.length > 0 && <p className="cv-contact">{contact.join("  ·  ")}</p>}
      {(profile.personal.linkedin || profile.personal.portfolio) && <p className="cv-links">{profile.personal.linkedin && <SafeLink value={profile.personal.linkedin} />}{profile.personal.linkedin && profile.personal.portfolio && "  ·  "}{profile.personal.portfolio && <SafeLink value={profile.personal.portfolio} />}</p>}
    </header>
    {hasText(profile.summary) && <section className="cv-section"><h2>Professional Summary</h2><p>{profile.summary}</p></section>}
    {visibleSections(profile).map((section) => <section className="cv-section" key={section} data-section={section}>
      <h2>{titles[section]}</h2>
      {section === "education" && profile.education.map((item, i) => <div className="cv-entry" key={i}>
        <div className="cv-entry-title"><strong>{[item.degree, item.major].filter(hasText).join(" in ") || item.institution}</strong><span>{item.graduation}</span></div>
        <p>{item.institution}{item.gpa && ` · GPA ${item.gpa}`}</p>
      </div>)}
      {section === "projects" && profile.projects.map((item, i) => <div className="cv-entry" key={i}>
        <div className="cv-entry-title"><strong>{item.name || "Project"}</strong>{item.link && <SafeLink value={item.link} />}</div>
        {item.technologies && <p className="cv-muted">{item.technologies}</p>}
        {item.bullets.filter(hasText).length > 0 && <ul>{item.bullets.filter(hasText).map((bullet, j) => <li key={j}>{bullet}</li>)}</ul>}
      </div>)}
      {section === "experience" && profile.experience.map((item, i) => <div className="cv-entry" key={i}>
        <div className="cv-entry-title"><strong>{item.role || "Experience"}</strong><span>{item.dates}</span></div>
        <p>{item.organization}</p>
        {item.bullets.filter(hasText).length > 0 && <ul>{item.bullets.filter(hasText).map((bullet, j) => <li key={j}>{bullet}</li>)}</ul>}
      </div>)}
      {section === "skills" && <div className="cv-skills">{Object.entries(profile.skills).filter(([, value]) => hasText(value)).map(([key, value]) => <p key={key}><strong>{({ programming: "Programming", aiData: "AI & Data", tools: "Tools & Platforms", domain: "Domain", soft: "People Skills" } as Record<string, string>)[key]}:</strong> {value}</p>)}</div>}
      {!["education", "projects", "experience", "skills"].includes(section) && <ul>{(profile[section as "certifications" | "training" | "volunteering" | "awards" | "languages"] as string[]).filter(hasText).map((item, i) => <li key={i}>{item}</li>)}</ul>}
    </section>)}
  </article>;
}
