export function emailFixtures(emptyProfile, demoProfiles, applyStep) {
  const technical = structuredClone(demoProfiles[0].profile);
  const business = structuredClone(demoProfiles[1].profile);
  const contribution = applyStep(emptyProfile(), "project", { contribution: "Designed the survey and analyzed 40 responses" });
  contribution.personal.fullName = "Synthetic Contribution Student"; contribution.personal.email = "synthetic@example.com";
  const noWork = structuredClone(technical); noWork.experience = [];
  const long = structuredClone(business);
  long.projects = Array.from({ length: 5 }, (_, index) => ({ ...structuredClone(business.projects[0]), name: `Synthetic research project ${index + 1}`, bullets: [
    "Designed a student survey and organized responses in Excel to help the university club understand attendee needs.",
    "Prepared a concise report describing the survey process and discussed the findings with other student volunteers.",
    "Presented the supplied findings to club organizers and documented practical questions for the next event.",
  ] }));
  const sparse = emptyProfile(); sparse.personal.fullName = "Synthetic Sparse Student"; sparse.personal.email = "sparse@example.com";
  const urls = structuredClone(technical); urls.personal.portfolio = `https://example.com/portfolio/${"long-path-segment/".repeat(20)}`; urls.projects[0].link = `https://example.com/project/${"q".repeat(260)}`;
  const unicode = structuredClone(technical); unicode.personal.fullName = "محمد أحمد — Zoë Álvarez";
  return { technical, business, contribution, noWork, long, sparse, urls, unicode };
}
