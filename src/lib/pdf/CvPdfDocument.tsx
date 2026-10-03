import { Document, Font, Link, Page, StyleSheet, Text, View, type TextProps } from "@react-pdf/renderer";
import { join } from "node:path";
import { hasText, visibleSections, type CvSection } from "../cv";
import type { CandidateProfile } from "../schema";

for (const family of ["NotoSans", "NotoSansArabic"]) Font.register({ family, fonts: [
  { src: join(process.cwd(), "assets/fonts", `${family}-Regular.ttf`) },
  { src: join(process.cwd(), "assets/fonts", `${family}-Bold.ttf`), fontWeight: 700 },
] });
// Do not insert invented hyphens into names, evidence or URLs.
Font.registerHyphenationCallback((word) => [word]);
const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 45, fontFamily: "NotoSans", fontSize: 9.5, lineHeight: 1.4, color: "#222222", backgroundColor: "#ffffff" },
  header: { marginBottom: 13 }, name: { fontSize: 20, lineHeight: 1.6, fontWeight: 700, marginBottom: 3 },
  headline: { fontSize: 11, lineHeight: 1.5, marginBottom: 3 }, contact: { fontSize: 9 },
  headingWrap: { borderBottomWidth: 0.6, borderBottomColor: "#555555", paddingBottom: 3, marginTop: 12, marginBottom: 6 },
  heading: { fontSize: 10.5, fontWeight: 700, lineHeight: 1.5 },
  entry: { marginBottom: 7 }, title: { fontWeight: 700 }, muted: { fontSize: 9, color: "#444444" },
  bullet: { marginLeft: 10, marginBottom: 3 }, link: { color: "#222222", textDecoration: "none", fontSize: 9 },
});
function PdfText({ children, style, ...props }: TextProps & { children: string }) {
  if (!/[\u0600-\u08ff]/u.test(children)) return <Text {...props} style={style} orphans={2} widows={2}>{children}</Text>;
  const runs = children.split(/([\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+(?: +[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+)*)/u);
  return <Text {...props} style={style} orphans={2} widows={2}>{runs.map((run, index) => <Text key={index} style={{ fontFamily: /[\u0600-\u08ff]/u.test(run) ? "NotoSansArabic" : "NotoSans" }}>{run}</Text>)}</Text>;
}
export function safePdfUrl(value: string): string | null {
  // Explicit unsafe schemes remain plain text. Candidate URLs are never fetched.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
  try { const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
function PdfLink({ value }: { value: string }) {
  const url = safePdfUrl(value);
  const display = value.replace(/^https?:\/\//i, "");
  // Explicit visual line breaks preserve copyable URL characters and the full link target.
  const wrapped = Array.from(display).reduce((text, character, index) => text + (index && index % 48 === 0 ? "\n" : "") + character, "");
  return url ? <Link src={url} style={styles.link}>{wrapped}</Link> : <PdfText style={styles.link}>{value}</PdfText>;
}
const titles: Record<CvSection, string> = { education: "Education", projects: "Projects", experience: "Experience", skills: "Skills", certifications: "Certifications", training: "Training", volunteering: "Activities & Volunteering", awards: "Awards", languages: "Languages" };
function Heading({ children }: { children: string }) { return <View style={styles.headingWrap} minPresenceAhead={28}><PdfText style={styles.heading}>{children}</PdfText></View>; }
function canSplitSection(profile: CandidateProfile, section: CvSection): boolean {
  if (["education", "projects", "experience", "skills"].includes(section)) return true;
  const entries = profile[section as "certifications" | "training" | "volunteering" | "awards" | "languages"];
  return entries.length > 6 || entries.join(" ").length > 400;
}
function Bullets({ values }: { values: string[] }) { return <>{values.filter(hasText).map((value, index) => <PdfText key={index} style={styles.bullet}>{`• ${value}`}</PdfText>)}</>; }
export function CvPdfDocument({ profile }: { profile: CandidateProfile }) {
  return <Document title="Curriculum Vitae" author={profile.personal.fullName || undefined}>
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header}>
        <PdfText style={styles.name}>{profile.personal.fullName || "Your Name"}</PdfText>
        {(profile.personal.headline || profile.careerGoal.role) && <PdfText style={styles.headline}>{profile.personal.headline || profile.careerGoal.role}</PdfText>}
        <PdfText style={styles.contact}>{[profile.personal.location, profile.personal.phone, profile.personal.email].filter(hasText).join(" · ")}</PdfText>
        {profile.personal.linkedin && <PdfLink value={profile.personal.linkedin} />}
        {profile.personal.portfolio && <PdfLink value={profile.personal.portfolio} />}
      </View>
      {hasText(profile.summary) && <><Heading>Professional Summary</Heading><PdfText>{profile.summary}</PdfText></>}
      {visibleSections(profile).map((section) => <View key={section} wrap={canSplitSection(profile, section)}>
        <Heading>{titles[section]}</Heading>
        {section === "education" && profile.education.map((item, index) => <View key={index} style={styles.entry}>
          <PdfText style={styles.title} minPresenceAhead={14}>{[item.degree, item.major].filter(hasText).join(" in ") || item.institution}</PdfText>
          {item.graduation && <PdfText>{item.graduation}</PdfText>}
          <PdfText>{item.institution + (item.gpa ? ` · GPA ${item.gpa}` : "")}</PdfText>
        </View>)}
        {section === "projects" && profile.projects.map((item, index) => <View key={index} style={styles.entry}>
          <PdfText style={styles.title} minPresenceAhead={14}>{item.name || "Project"}</PdfText>
          {item.link && <PdfLink value={item.link} />}
          {item.technologies && <PdfText style={styles.muted}>{item.technologies}</PdfText>}
          {!item.bullets.some(hasText) && !hasText(item.built) && !hasText(item.contribution) && [item.problem, item.outcome].filter(hasText).map((fact, i) => <PdfText key={i}>{fact}</PdfText>)}
          <Bullets values={item.bullets} />
        </View>)}
        {section === "experience" && profile.experience.map((item, index) => <View key={index} style={styles.entry}>
          <PdfText style={styles.title} minPresenceAhead={14}>{item.role || "Experience"}</PdfText>
          <PdfText>{item.dates}</PdfText><PdfText>{item.organization}</PdfText><Bullets values={item.bullets} />
        </View>)}
        {section === "skills" && Object.entries(profile.skills).filter(([, value]) => hasText(value)).map(([key, value]) => <PdfText key={key}>{`${({ programming: "Programming", aiData: "AI & Data", tools: "Tools & Platforms", domain: "Domain", soft: "People Skills" } as Record<string, string>)[key]}: ${value}`}</PdfText>)}
        {!["education", "projects", "experience", "skills"].includes(section) && <Bullets values={profile[section as "certifications" | "training" | "volunteering" | "awards" | "languages"]} />}
      </View>)}
    </Page>
  </Document>;
}
