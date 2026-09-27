import type { CandidateProfile } from "./schema";

export const demoProfiles: { label: string; description: string; profile: CandidateProfile }[] = [
  {
    label: "AI student",
    description: "Computer science graduate with a project-led CV",
    profile: {
      personal: { fullName: "Lina Haddad", headline: "Junior AI Engineer", email: "lina.demo@example.com", phone: "+962 79 000 0000", location: "Amman, Jordan", linkedin: "linkedin.com/in/lina-demo", portfolio: "github.com/lina-demo" },
      careerGoal: { role: "Junior AI Engineer", field: "Artificial intelligence", opportunity: "Graduate role" },
      summary: "Computer science graduate with hands-on experience building a document question-answering prototype using Python, FastAPI and vector search. Seeking a junior AI engineering role.",
      education: [{ institution: "University of Jordan", degree: "BSc", major: "Computer Science", graduation: "2026", gpa: "" }],
      projects: [{ name: "Research Paper Assistant", problem: "Students needed a faster way to search course reading.", built: "Built a document question-answering prototype.", technologies: "Python, FastAPI, vector search", contribution: "Implemented document ingestion and the API endpoints.", outcome: "Tested with a small collection of course papers.", link: "github.com/lina-demo/research-assistant", bullets: ["Implemented document ingestion and API endpoints for a course-paper question-answering prototype using Python, FastAPI and vector search."] }],
      experience: [],
      skills: { programming: "Python, TypeScript", aiData: "Vector search, data preprocessing", tools: "FastAPI, Git", domain: "", soft: "" },
      certifications: [], training: ["Machine Learning Summer School, 2025"], volunteering: ["IEEE student branch event volunteer"], awards: [], languages: ["Arabic (native)", "English (professional)"],
    },
  },
  {
    label: "Business student",
    description: "Non-technical student with activity and research evidence",
    profile: {
      personal: { fullName: "Omar Saleh", headline: "Business Analyst Intern", email: "omar.demo@example.com", phone: "+962 78 000 0000", location: "Irbid, Jordan", linkedin: "", portfolio: "" },
      careerGoal: { role: "Business Analyst Intern", field: "Business operations", opportunity: "Internship" },
      summary: "Business administration student with experience researching student service needs, organizing survey findings and presenting recommendations to a campus team. Seeking a business analyst internship.",
      education: [{ institution: "Yarmouk University", degree: "BBA", major: "Business Administration", graduation: "Expected 2027", gpa: "" }],
      projects: [{ name: "Campus Service Survey", problem: "A student club wanted to understand event attendance barriers.", built: "Designed a survey and summarized responses for club leaders.", technologies: "Excel, Google Forms", contribution: "Wrote survey questions, cleaned responses and presented findings.", outcome: "Recommendations informed the club's next event plan.", link: "", bullets: ["Designed a student survey, organized responses in Excel and presented attendance insights to club leaders."] }],
      experience: [{ role: "Events Volunteer", organization: "University Business Club", dates: "2025 – 2026", details: "Coordinated registration and helped prepare event schedules.", bullets: ["Coordinated attendee registration and helped prepare schedules for student club events."] }],
      skills: { programming: "", aiData: "", tools: "Excel, Google Forms, PowerPoint", domain: "Survey design, basic data analysis", soft: "Presentation" },
      certifications: [], training: [], volunteering: ["University Business Club"], awards: [], languages: ["Arabic (native)", "English (intermediate)"],
    },
  },
];
