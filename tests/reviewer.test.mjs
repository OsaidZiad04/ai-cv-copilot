import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return resolveFilename.call(this, request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request, parent, ...rest);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
require.extensions[".tsx"] = require.extensions[".ts"];

const { emptyProfile } = require("../src/lib/schema.ts");
const { firstSkillGap, captureEvidenceNote, needsProjectContribution } = require("../src/lib/evidence.ts");
const { guidedReply } = require("../src/lib/interview.ts");
const { reviewTasks, suppliedExamples, reversedDates, skillMention } = require("../src/lib/review.ts");
const { ReviewerBrief } = require("../src/components/ReviewerBrief.tsx");
const { ProfileEditor } = require("../src/components/ProfileEditor.tsx");
const { CvDocument } = require("../src/components/CvDocument.tsx");
const { restoreSession } = require("../src/lib/session.ts");
const { initializeFreshness, recordWritten, reconcileFreshness, sourceFingerprint, acceptProposal, proposeGuided, freshness } = require("../src/lib/freshness.ts");
const { renderToStaticMarkup } = require("react-dom/server");
const React = require("react");
const fixture = JSON.parse(fs.readFileSync("research/wave2/results/v1.0.0-results.json", "utf8")).results;
const candidate = id => structuredClone(fixture.find(item => item.id === id).generatedProfile);

test("one optional skill question appears for unsupported skills and strong evidence avoids it", () => {
  const profile = emptyProfile();
  assert.equal(firstSkillGap(profile, { programming: "Python, R, C++" }), "Python");
  const note = captureEvidenceNote("Python", "Used Python in coursework");
  assert.equal(note.skill, "Python");
  assert.equal(firstSkillGap(profile, { programming: "Python, R, C++" }, note), "Python");
  assert.equal(captureEvidenceNote("Python", "   "), null);
  profile.projects = [{ name: "Survey", problem: "", built: "Used Python for class survey analysis", technologies: "Python", contribution: "Analyzed responses with Python", outcome: "", link: "", bullets: [] }];
  assert.equal(firstSkillGap(profile, { programming: "Python" }), null);
  assert.match(guidedReply("skills", { programming: "Python" }, profile), /earlier examples/);
  assert.match(guidedReply("skills", { programming: "Python", evidenceExample: "Used Python in coursework" }, emptyProfile()), /add that example/);
  assert.equal(needsProjectContribution({ built: "Built a survey", contribution: "" }), true);
  assert.equal(needsProjectContribution({ built: "Built a survey", contribution: "Designed questions" }), false);
});

test("evidence note is session local and does not enter CV or minimized provider input", () => {
  const profile = emptyProfile(); profile.skills.programming = "Python";
  const note = captureEvidenceNote("Python", "Used Python in coursework");
  const state = initializeFreshness(profile);
  const saved = JSON.stringify({ phase: "workspace", stepIndex: 6, profile, mode: "guided", aiEnabled: false, view: "preview", draft: {}, reply: "", enhancements: {}, freshness: state, evidenceNote: note });
  assert.deepEqual(restoreSession(saved).evidenceNote, note);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(CvDocument, { profile })), /Used Python in coursework/);
  assert.equal(restoreSession(null), null);
});

test("mentor tasks prioritize concrete inconsistencies and keep all tasks accessible", () => {
  const profile = candidate("18"); profile.skills.programming = "R, C, C++";
  assert.equal(reviewTasks(profile)[0].field, "experience-0-dates");
  assert.equal(reviewTasks(profile)[1].field, "education-0-graduation");
  const html = renderToStaticMarkup(React.createElement(ReviewerBrief, { profile, selected: "", onSelect: () => {}, onEdit: () => {} }));
  assert.equal((html.split('class="review-more"')[0].match(/class="review-task"/g) || []).length, 3);
  assert.match(html, /See all checks/);
  const editor = renderToStaticMarkup(React.createElement(ProfileEditor, { profile, onChange: () => {} }));
  for (const task of reviewTasks(profile)) assert.ok(editor.includes(`id="${task.field}"`), task.field);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(CvDocument, { profile })), /Mentor review brief|Edit this field|See all checks/);
});

test("mentor examples include activities without treating a bare club name as an action", () => {
  const profile = emptyProfile(); profile.volunteering = ["Literacy Club"];
  assert.equal(suppliedExamples(profile).length, 0);
  profile.volunteering.push("Prepared worksheets for a reading session");
  assert.equal(suppliedExamples(profile).length, 1);
  assert.equal(suppliedExamples(profile)[0].field, "volunteering");
  profile.volunteering.push("Sketched a student club poster in Figma");
  assert.equal(suppliedExamples(profile).length, 2);
  assert.equal(reviewTasks(profile).some(task => task.id === "example"), false);
  assert.equal(skillMention("R", ["Used RStudio"]), "absent");
  assert.equal(skillMention("R", ["I did not use R"]), "context");
  assert.equal(reversedDates("Aug 2026 - Jun 2025"), true);
  assert.equal(reversedDates("2025 - Present"), false);
});

test("explicit AI rewrite may replace a stale bullet, while ordinary edits retain manual wording", () => {
  const profile = candidate("21");
  let state = initializeFreshness(profile);
  const key = state.projects[0];
  state = recordWritten(profile, state, key, "groq");
  const next = structuredClone(profile); next.projects[0].contribution += " with classmates";
  state = reconcileFreshness(profile, next, state, { group: "projects", index: 0, kind: "edit" });
  assert.equal(freshness(next, state, key), "stale");
  const original = next.projects[0].bullets.join("\n");
  next.projects[0].bullets = ["My own wording from the candidate."];
  state = reconcileFreshness(profile, next, state, { group: "projects", index: 0, kind: "edit" });
  assert.equal(next.projects[0].bullets[0], "My own wording from the candidate.");
  const proposal = { ...proposeGuided(next, state, key, 7), after: ["Prepared survey questions with classmates."], origin: "groq" };
  assert.equal(acceptProposal(next, state, proposal, 8), null);
  const accepted = acceptProposal(next, state, proposal, 7);
  assert.equal(accepted.profile.projects[0].bullets[0], "Prepared survey questions with classmates.");
  assert.equal(accepted.state.artifacts[key].origin, "groq");
  assert.equal(freshness(accepted.profile, accepted.state, key), "current");
  assert.notEqual(sourceFingerprint(next, state, key), "");
  assert.notEqual(original, "My own wording from the candidate.");
});
