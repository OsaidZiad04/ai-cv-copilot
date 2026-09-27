"use client";

import { useEffect, useRef, useState } from "react";
import { CvDocument } from "@/components/CvDocument";
import { ProfileEditor } from "@/components/ProfileEditor";
import { demoProfiles } from "@/lib/demo";
import { fallbackSummary, hasUnsupportedNumbers } from "@/lib/cv";
import { applyStep, guidedReply, interviewSteps } from "@/lib/interview";
import { readinessChecks } from "@/lib/review";
import { candidateProfileSchema, emptyProfile, type CandidateProfile } from "@/lib/schema";

type Phase = "landing" | "interview" | "profile" | "workspace";
type Mode = "groq" | "mock" | "guided";
type View = "preview" | "edit" | "review";
type SavedState = { phase: Phase; stepIndex: number; profile: CandidateProfile; mode: Mode; aiEnabled: boolean; view: View };
const storageKey = "ai-cv-copilot-session-v1";

function ModeBadge({ mode }: { mode: Mode }) {
  return <span className={`mode-badge mode-${mode}`}><span className="status-dot" />{mode === "groq" ? "AI Enhanced" : mode === "mock" ? "Demo Mode" : "Guided Mode"}</span>;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [mode, setMode] = useState<Mode>("guided");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [view, setView] = useState<View>("preview");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedState;
        const validated = candidateProfileSchema.safeParse(parsed.profile);
        if (validated.success && ["landing", "interview", "profile", "workspace"].includes(parsed.phase)) {
          setProfile(validated.data); setPhase(parsed.phase); setStepIndex(Math.max(0, Math.min(6, parsed.stepIndex)));
          setMode(parsed.mode); setAiEnabled(parsed.aiEnabled); setView(parsed.view);
        }
      }
    } catch { sessionStorage.removeItem(storageKey); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(storageKey, JSON.stringify({ phase, stepIndex, profile, mode, aiEnabled, view } satisfies SavedState));
  }, [phase, stepIndex, profile, mode, aiEnabled, view, hydrated]);

  const reset = () => {
    sessionStorage.removeItem(storageKey); setPhase("landing"); setProfile(emptyProfile()); setStepIndex(0);
    setDraft({}); setReply(""); setNotice(""); setView("preview"); setMode("guided"); setAiEnabled(true);
  };
  const start = (enabled: boolean) => {
    setProfile(emptyProfile()); setStepIndex(0); setDraft({}); setReply(""); setNotice("");
    setAiEnabled(enabled); setMode(enabled ? "mock" : "guided"); setPhase("interview");
  };
  const loadDemo = (index: number) => {
    setProfile(structuredClone(demoProfiles[index].profile)); setMode("mock"); setAiEnabled(false); setPhase("workspace"); setView("preview"); setNotice("Demo profile loaded. Replace it with your own information before exporting.");
  };

  const submitStep = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice("");
    const step = interviewSteps[stepIndex];
    let improvedBullet = "";
    let nextMode: Mode = "guided";
    let nextReply = guidedReply(step.id, draft);
    if (aiEnabled) {
      try {
        const response = await fetch("/api/interview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step: step.id, values: draft, targetRole: profile.careerGoal.role }) });
        if (!response.ok) throw new Error("Interview unavailable");
        const data = await response.json();
        if (typeof data.reply !== "string" || typeof data.bullet !== "string") throw new Error("Invalid interview response");
        nextReply = data.reply;
        improvedBullet = hasUnsupportedNumbers(data.bullet, Object.values(draft).join(" ")) ? "" : data.bullet;
        nextMode = data.mode === "groq" ? "groq" : data.mode === "mock" ? "mock" : "guided";
      } catch { setNotice("We switched to Guided Mode so you can keep going."); }
    }
    const nextProfile = applyStep(profile, step.id, draft, improvedBullet);
    setProfile(nextProfile); setMode(nextMode); setReply(nextReply); setDraft({});
    if (stepIndex === interviewSteps.length - 1) setPhase("profile");
    else setStepIndex(stepIndex + 1);
    pending.current = false; setBusy(false);
  };

  const generate = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice("");
    let summary = fallbackSummary(profile);
    if (aiEnabled) {
      try {
        const response = await fetch("/api/summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
        if (!response.ok) throw new Error("Summary unavailable");
        const data = await response.json();
        if (typeof data.summary !== "string") throw new Error("Invalid summary");
        summary = hasUnsupportedNumbers(data.summary, JSON.stringify(profile)) ? fallbackSummary(profile) : data.summary;
        setMode(data.mode === "groq" ? "groq" : data.mode === "mock" ? "mock" : "guided");
      } catch { setMode("guided"); setNotice("Guided Mode created your summary. You can edit it at any time."); }
    }
    setProfile({ ...profile, summary }); setPhase("workspace"); setView("preview");
    pending.current = false; setBusy(false);
  };

  const step = interviewSteps[stepIndex];
  return <div className="app-shell">
    <header className="site-header no-print"><div className="brand"><span className="brand-mark">CV<span>.</span></span><span>AI CV Copilot</span></div><div className="header-actions">{phase !== "landing" && <ModeBadge mode={mode} />}{phase !== "landing" && <button className="header-link" onClick={reset}>End session</button>}</div></header>
    {phase === "landing" && <main className="landing">
      <div className="landing-copy"><span className="eyebrow"><span className="eyebrow-line" /> YOUR CAREER, IN FOCUS</span><h1>Make your first<br /><em>impression count.</em></h1><p className="lead">Build a professional first CV through a short guided conversation. Show what you have done, even if you have not had a formal job yet.</p>
        <div className="landing-actions"><button className="button primary" onClick={() => start(true)}>Start My CV <span aria-hidden="true">↗</span></button><button className="button secondary" onClick={() => start(false)}>Build Without AI</button></div>
        <div className="privacy-note"><span aria-hidden="true">◇</span><p><strong>Your privacy matters.</strong> Your information is used only to help generate your CV during this session. Avoid entering information you do not want processed.</p></div>
      </div>
      <div className="landing-visual" aria-hidden="true"><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-card"><div className="visual-top"><span>YOUR NEXT CHAPTER</span><span>01 / 04</span></div><div className="visual-name">Your story,<br />well told<span>.</span></div><div className="visual-rule" /><div className="visual-row"><span>01</span><div><strong>Talk it through</strong><small>A few thoughtful questions</small></div><span>↗</span></div><div className="visual-row"><span>02</span><div><strong>Shape the details</strong><small>Skills backed by evidence</small></div><span>↗</span></div><div className="visual-row"><span>03</span><div><strong>Leave ready</strong><small>A clean CV you can share</small></div><span>↗</span></div></div><div className="visual-caption">FROM FIRST THOUGHT TO FIRST DRAFT</div></div>
      <div className="demo-strip"><div><span className="eyebrow">FOR EVENT TEAMS</span><strong>Need a quick walkthrough?</strong></div><div className="demo-actions">{demoProfiles.map((demo, i) => <button key={demo.label} onClick={() => loadDemo(i)}>{demo.label} <span>↗</span></button>)}</div><span className="demo-label">DEMO DATA</span></div>
    </main>}

    {phase === "interview" && <main className="flow-layout no-print"><aside className="flow-sidebar"><span className="eyebrow">BUILD YOUR STORY</span><h2>A better CV starts with a conversation.</h2><p>We will work through the essentials, one step at a time. You can refine every line later.</p><div className="step-list">{interviewSteps.map((item, i) => <div className={`step-nav ${i === stepIndex ? "active" : ""} ${i < stepIndex ? "done" : ""}`} key={item.id}><span>{String(i + 1).padStart(2, "0")}</span>{item.eyebrow.split(" / ")[1]}</div>)}</div></aside>
      <section className="flow-main"><div className="flow-top"><span>YOUR CV INTERVIEW</span><span>STEP {stepIndex + 1} OF {interviewSteps.length}</span></div><div className="progress"><div style={{ width: `${((stepIndex + 1) / interviewSteps.length) * 100}%` }} /></div>
        <div className="conversation"><div className="assistant-avatar">C<span>✦</span></div><div className="conversation-body"><span className="speaker">CV COPILOT</span>{reply && <p className="previous-reply">{reply}</p>}<h1>{step.prompt}</h1><p className="hint">{step.helper}</p></div></div>
        <form className="answer-card" onSubmit={submitStep}><div className="answer-head"><span className="eyebrow">{step.eyebrow}</span><span>YOUR RESPONSE</span></div><div className="field-grid">{step.fields.map((field) => <label className="field" key={field.key}><span>{field.label} {field.optional && <small>OPTIONAL</small>}</span>{field.multiline ? <textarea rows={3} maxLength={2000} value={draft[field.key] || ""} placeholder={field.placeholder} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} /> : <input maxLength={500} type={field.key === "email" ? "email" : "text"} required={!field.optional} value={draft[field.key] || ""} placeholder={field.placeholder} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} />}</label>)}</div>
          <div className="form-footer"><span>{step.id === "project" || step.id === "experience" ? "You can skip optional details." : "You can edit this later."}</span><button className="button primary" disabled={busy} type="submit">{busy ? "Thinking…" : stepIndex === 6 ? "Review Profile" : "Continue"} <span aria-hidden="true">→</span></button></div></form>
        {notice && <p role="status" className="notice">{notice}</p>}
      </section></main>}

    {phase === "profile" && <main className="review-profile no-print"><span className="eyebrow">INTERVIEW COMPLETE</span><h1>Your story is taking shape.</h1><p className="lead">Here is what we captured. Review the key details, then create your first draft. Everything remains editable.</p><div className="profile-grid"><div className="profile-card"><span>01 / DIRECTION</span><strong>{profile.careerGoal.role || "Open to opportunities"}</strong><p>{profile.careerGoal.opportunity || profile.careerGoal.field || "Early career"}</p></div><div className="profile-card"><span>02 / EDUCATION</span><strong>{profile.education[0]?.major || "Your education"}</strong><p>{profile.education[0]?.institution || "Add in editor"}</p></div><div className="profile-card"><span>03 / EVIDENCE</span><strong>{profile.projects.length} project{profile.projects.length === 1 ? "" : "s"} · {profile.experience.length} experience</strong><p>Projects and activities count.</p></div></div><div className="profile-actions"><button className="button secondary" onClick={() => { setPhase("interview"); setStepIndex(0); }}>Start interview again</button><button className="button primary" disabled={busy} onClick={generate}>{busy ? "Generating CV…" : "Create My CV"} <span>→</span></button></div>{notice && <p role="status" className="notice">{notice}</p>}</main>}

    {phase === "workspace" && <main className="workspace"><div className="workspace-heading no-print"><div><span className="eyebrow">YOUR FIRST DRAFT</span><h1>Make it yours.</h1><p>Review every detail, then print or save your CV as a PDF.</p></div><div className="workspace-actions"><button className="button secondary" onClick={() => { setView("edit"); setTimeout(() => document.querySelector(".workspace-body")?.scrollIntoView({ behavior: "smooth" }), 0); }}>Edit CV</button><button className="button primary" onClick={() => window.print()}>Print / Save PDF <span>↗</span></button></div></div>
      {notice && <p role="status" className="notice no-print">{notice}</p>}
      <div className="workspace-body"><div className="workspace-toolbar no-print"><div className="tabs" role="tablist" aria-label="CV workspace views">{(["preview", "edit", "review"] as const).map((tab) => <button role="tab" aria-selected={view === tab} className={view === tab ? "selected" : ""} key={tab} onClick={() => setView(tab)}>{tab === "review" ? "Review Mode" : tab === "edit" ? "Edit Details" : "CV Preview"}</button>)}</div><span>ATS CLEAN TEMPLATE</span></div>
        {view === "preview" && <div className="preview-layout"><div className="preview-side no-print"><span className="eyebrow">READY TO SHARE</span><h2>Simple. Clear. Yours.</h2><p>This one-column layout is designed to read well on screen and on A4 paper.</p><div className="tip-card"><strong>Saving a PDF?</strong><p>Choose “Save as PDF” in your browser’s print window. Use A4 paper and turn off browser headers and footers for the cleanest result.</p></div><button className="text-button" onClick={() => setView("review")}>Open CV Readiness Check →</button></div><CvDocument profile={profile} /></div>}
        {view === "edit" && <ProfileEditor profile={profile} onChange={(next) => { const valid = candidateProfileSchema.safeParse(next); if (valid.success) setProfile(valid.data); else setNotice("That entry is too long. Please shorten it."); }} />}
        {view === "review" && <div className="review-layout"><div className="review-panel no-print"><span className="eyebrow">HUMAN REVIEW MODE</span><h2>CV Readiness Check</h2><p>Review guidance for mentors and career volunteers. These are factual checks, not a score.</p><div className="target-role"><span>TARGET ROLE</span><strong>{profile.careerGoal.role || "Not specified"}</strong></div>{readinessChecks(profile).length ? <ul className="check-list">{readinessChecks(profile).map((check, i) => <li key={i}><span>!</span>{check}</li>)}</ul> : <div className="all-clear">No common gaps found. A human reviewer should still check wording and relevance.</div>}<button className="text-button" onClick={() => setView("edit")}>Edit details →</button></div><CvDocument profile={profile} /></div>}
      </div><div className="completion-bar no-print"><span>Your data stays in this browser session. End the session to clear it from this app.</span><button className="header-link" onClick={reset}>End & clear session</button></div>
      <div className="print-only"><CvDocument profile={profile} /></div>
    </main>}
    <footer className="site-footer no-print"><span>AI CV COPILOT</span><span>Built for a better first step.</span></footer>
  </div>;
}
