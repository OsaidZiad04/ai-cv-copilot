import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  const target = request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request;
  return resolveFilename.call(this, target, parent, ...rest);
};
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  module._compile(output, filename);
};
require.extensions[".tsx"] = require.extensions[".ts"];
const { candidateProfileSchema, emptyProfile } = require("../src/lib/schema.ts");
const { applyStep } = require("../src/lib/interview.ts");
const { fallbackSummary, visibleSections, projectBullet, hasUnsupportedNumbers } = require("../src/lib/cv.ts");
const { selectProvider, parseAiResponse } = require("../src/lib/providers.ts");
const { readinessChecks } = require("../src/lib/review.ts");
const { questionForStep, valuesForStep } = require("../src/lib/interview.ts");
const { restoreSession, SubmissionGate } = require("../src/lib/session.ts");
const { readJsonLimited } = require("../src/lib/http.ts");
const { demoProfiles } = require("../src/lib/demo.ts");
const { CvDocument } = require("../src/components/CvDocument.tsx");
const { renderToStaticMarkup } = require("react-dom/server");

test("schema accepts a complete empty profile and rejects malformed data", () => {
  assert.equal(candidateProfileSchema.safeParse(emptyProfile()).success, true);
  assert.equal(candidateProfileSchema.safeParse({ personal: { fullName: 42 } }).success, false);
});

test("guided flow captures facts and never invents a metric", () => {
  const profile = applyStep(emptyProfile(), "project", { name: "Campus app", built: "Built an event registration page", contribution: "Designed the registration form", technologies: "React" });
  assert.equal(profile.projects.length, 1);
  assert.match(profile.projects[0].bullets[0], /registration form/);
  assert.doesNotMatch(profile.projects[0].bullets[0], /\d+%/);
  assert.doesNotMatch(fallbackSummary(profile), /\d+%/);
  assert.equal(projectBullet({ name: "", problem: "", built: "", contribution: "", technologies: "", outcome: "", link: "", bullets: [] }), "");
});

test("provider selection supports mock, guided and missing Groq credentials", async () => {
  assert.equal(selectProvider({ LLM_PROVIDER: "mock" }).mode, "mock");
  assert.equal(selectProvider({ LLM_PROVIDER: "guided" }).mode, "guided");
  assert.equal(selectProvider({ LLM_PROVIDER: "groq" }).mode, "guided");
  assert.equal(selectProvider({ LLM_PROVIDER: "unknown" }).mode, "guided");
  const result = await selectProvider({ LLM_PROVIDER: "mock" }).interview({ step: "personal", values: {}, targetRole: "" });
  assert.match(result.reply, /opportunity/);
});

test("malformed AI JSON is rejected for safe fallback", () => {
  assert.throws(() => parseAiResponse("not json"));
  assert.throws(() => parseAiResponse('{"reply":4,"bullet":""}'));
});

test("ATS CV renders populated sections and omits empty optional sections", () => {
  const profile = applyStep(emptyProfile(), "education", { institution: "University", degree: "BSc", major: "Business", graduation: "2027" });
  profile.personal.fullName = "Demo Student";
  const markup = renderToStaticMarkup(CvDocument({ profile }));
  assert.match(markup, /Demo Student/);
  assert.match(markup, /Education/);
  assert.doesNotMatch(markup, /Certifications/);
  assert.deepEqual(visibleSections(profile), ["education"]);
});

test("candidate text is escaped and unsafe link schemes are not rendered as links", () => {
  const profile = emptyProfile();
  profile.personal.fullName = "<script>alert(1)</script>";
  profile.personal.portfolio = "javascript:alert(1)";
  const html = renderToStaticMarkup(CvDocument({ profile }));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test("no-key guided path can produce an editable and printable profile", async () => {
  const provider = selectProvider({ LLM_PROVIDER: "groq", GROQ_API_KEY: "" });
  let profile = applyStep(emptyProfile(), "personal", { fullName: "Student Name", email: "student@example.com" });
  profile = applyStep(profile, "goal", { role: "Analyst Intern" });
  profile.summary = await provider.summary(profile);
  assert.equal(candidateProfileSchema.safeParse(profile).success, true);
  assert.match(renderToStaticMarkup(CvDocument({ profile })), /Analyst Intern/);
});

test("complete guided interview yields a validated CV and review guidance", async () => {
  let profile = emptyProfile();
  profile = applyStep(profile, "personal", { fullName: "Test Student", email: "test@example.com", location: "Amman" });
  profile = applyStep(profile, "goal", { role: "Business Analyst Intern", field: "Operations", opportunity: "Internship" });
  profile = applyStep(profile, "education", { institution: "Example University", degree: "BBA", major: "Business", graduation: "2027" });
  profile = applyStep(profile, "project", { name: "Survey", built: "Created a student survey", contribution: "Analyzed responses", technologies: "Excel" });
  profile = applyStep(profile, "experience", {});
  profile = applyStep(profile, "skills", { tools: "Excel, PowerPoint", domain: "Survey analysis" });
  profile = applyStep(profile, "extras", { languages: "Arabic, English", volunteering: "Business club" });
  profile.summary = await selectProvider({ LLM_PROVIDER: "guided" }).summary(profile);
  assert.equal(candidateProfileSchema.safeParse(profile).success, true);
  assert.equal(profile.experience.length, 0);
  const html = renderToStaticMarkup(CvDocument({ profile }));
  for (const expected of ["Test Student", "Business Analyst Intern", "Education", "Projects", "Skills", "Activities &amp; Volunteering", "Languages"]) assert.match(html, new RegExp(expected));
  assert.match(readinessChecks(profile).join(" "), /LinkedIn/);
  assert.equal(hasUnsupportedNumbers("Raised attendance 50%", "Raised attendance"), true);
});

test("both demo profiles validate and render their distinct evidence", () => {
  for (const { profile } of demoProfiles) {
    assert.equal(candidateProfileSchema.safeParse(profile).success, true);
    const html = renderToStaticMarkup(CvDocument({ profile }));
    assert.match(html, new RegExp(profile.personal.fullName));
    assert.match(html, new RegExp(profile.projects[0].name));
  }
  assert.deepEqual(require("../src/lib/cv.ts").visibleSections(demoProfiles[1].profile).slice(0, 3), ["education", "projects", "experience"]);
});

test("refresh restores unfinished answers and reset clears the session", () => {
  const saved = { phase: "interview", stepIndex: 3, profile: emptyProfile(), mode: "guided", aiEnabled: false, view: "preview", draft: { name: "Campus survey", built: "Created a survey" }, reply: "Tell me more." };
  const restored = restoreSession(JSON.stringify(saved));
  assert.equal(restored?.draft.built, "Created a survey");
  assert.equal(restoreSession(null), null);
  assert.equal(restoreSession("{bad json"), null);
  assert.equal(restoreSession(JSON.stringify({ ...saved, stepIndex: 99 })), null);
});

test("duplicate submissions and late results after reset are ignored", () => {
  const gate = new SubmissionGate();
  const first = gate.begin(500, 1000);
  assert.equal(typeof first, "number");
  assert.equal(gate.begin(), null);
  gate.cancel();
  assert.equal(gate.isCurrent(first), false);
  const second = gate.begin(500, 2000);
  assert.equal(gate.isCurrent(second), true);
  assert.equal(gate.finish(second, 2010), true);
  assert.equal(gate.begin(500, 2011), null);
  assert.equal(typeof gate.begin(500, 2511), "number");
});

test("going back preserves answers and replacing an interview project does not duplicate it", () => {
  let profile = applyStep(emptyProfile(), "goal", { role: "Data Analyst" });
  profile = applyStep(profile, "project", { name: "First project", built: "Built a report" });
  assert.match(questionForStep("project", profile), /Data Analyst/);
  assert.equal(valuesForStep(profile, "project").name, "First project");
  profile = applyStep(profile, "project", { name: "Revised project", built: "Built a dashboard" });
  assert.equal(profile.projects.length, 1);
  assert.equal(profile.projects[0].name, "Revised project");
});

test("oversized and malformed requests are rejected before profile processing", async () => {
  const oversized = new Request("http://localhost/api/interview", { method: "POST", body: JSON.stringify({ step: "personal", values: { fullName: "A".repeat(5000) } }) });
  await assert.rejects(readJsonLimited(oversized, 1024));
  const malformed = new Request("http://localhost/api/interview", { method: "POST", body: "not json" });
  await assert.rejects(readJsonLimited(malformed, 1024));
  assert.equal(candidateProfileSchema.safeParse({ ...emptyProfile(), projects: [{ name: "X", bullets: ["bad"] }] }).success, false);
});

test("Groq network and malformed-response failures reject for guided fallback", async () => {
  const originalFetch = globalThis.fetch;
  const provider = selectProvider({ LLM_PROVIDER: "groq", GROQ_API_KEY: "test-key", GROQ_MODEL: "test-model" });
  try {
    globalThis.fetch = async () => { throw new Error("network down"); };
    await assert.rejects(provider.interview({ step: "goal", values: { role: "Analyst" }, targetRole: "Analyst" }));
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":42,"bullet":""}' } }] }), { status: 200 });
    await assert.rejects(provider.interview({ step: "goal", values: { role: "Analyst" }, targetRole: "Analyst" }));
    globalThis.fetch = async () => new Response("rate limited", { status: 429 });
    await assert.rejects(provider.interview({ step: "goal", values: { role: "Analyst" }, targetRole: "Analyst" }));
  } finally { globalThis.fetch = originalFetch; }
});
