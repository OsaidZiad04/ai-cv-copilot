"use client";

import { useEffect, useRef, useState } from "react";
import { CvDocument } from "@/components/CvDocument";
import { ProfileEditor } from "@/components/ProfileEditor";
import { DemoControls } from "@/components/DemoControls";
import { demoProfiles } from "@/lib/demo";
import { fallbackSummary, hasUnsupportedGraduationClaim, hasUnsupportedNumbers, hasUnsupportedOutcomeClaim } from "@/lib/cv";
import { applyStep, guidedReply, interviewSteps, questionForStep, valuesForStep } from "@/lib/interview";
import { readinessChecks } from "@/lib/review";
import { candidateProfileSchema, emptyProfile, type CandidateProfile } from "@/lib/schema";
import { restoreSession, sessionKey, SubmissionGate, type SavedSession } from "@/lib/session";
import { enhancementCacheKey, isDemoMode, toBulletLlmInput, toSummaryLlmInput } from "@/lib/llm-input";

type Phase = "landing" | "interview" | "profile" | "workspace";
type Mode = "groq" | "mock" | "guided";
type View = "preview" | "edit" | "review";
function ModeBadge({ mode }: { mode: Mode }) {
  return <span className={`mode-badge mode-${mode}`}><span className="status-dot" />{mode === "groq" ? "AI Enhanced" : "Guided Mode"}</span>;
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
  const [operatorMode, setOperatorMode] = useState(false);
  const [enhancements, setEnhancements] = useState<Record<string, string>>({});
  const gate = useRef(new SubmissionGate());
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    setOperatorMode(isDemoMode(window.location.search));
    try {
      const parsed = restoreSession(sessionStorage.getItem(sessionKey));
      if (parsed) {
        setProfile(parsed.profile); setPhase(parsed.phase); setStepIndex(parsed.stepIndex);
        setMode(parsed.mode); setAiEnabled(parsed.aiEnabled); setView(parsed.view);
        setDraft(parsed.draft); setReply(parsed.reply); setEnhancements(parsed.enhancements);
      } else sessionStorage.removeItem(sessionKey);
    } catch { /* Private browsing may block session storage. The in-memory flow still works. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (phase === "landing") sessionStorage.removeItem(sessionKey);
      else sessionStorage.setItem(sessionKey, JSON.stringify({ phase, stepIndex, profile, mode, aiEnabled, view, draft, reply, enhancements } satisfies SavedSession));
    } catch { /* Continue in memory if storage is unavailable. */ }
  }, [phase, stepIndex, profile, mode, aiEnabled, view, draft, reply, enhancements, hydrated]);

  const cancelPending = () => { gate.current.cancel(); controller.current?.abort(); controller.current = null; setBusy(false); };
  const postJson = async (path: string, body: unknown) => {
    const requestController = new AbortController();
    controller.current = requestController;
    const timeout = setTimeout(() => requestController.abort(), 15000);
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: requestController.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Request unavailable");
      return await response.json();
    } finally {
      clearTimeout(timeout);
      if (controller.current === requestController) controller.current = null;
    }
  };

  const reset = () => {
    cancelPending();
    try { sessionStorage.removeItem(sessionKey); } catch { /* Session storage can be unavailable. */ }
    setPhase("landing"); setProfile(emptyProfile()); setStepIndex(0);
    setDraft({}); setReply(""); setNotice(""); setView("preview"); setMode("guided"); setAiEnabled(true); setEnhancements({});
  };
  const start = (enabled: boolean) => {
    cancelPending(); setProfile(emptyProfile()); setStepIndex(0); setDraft({}); setReply(""); setNotice(""); setEnhancements({});
    setAiEnabled(enabled); setMode("guided"); setPhase("interview");
  };
  const loadDemo = (index: number) => {
    cancelPending(); setProfile(structuredClone(demoProfiles[index].profile)); setMode("mock"); setAiEnabled(false); setEnhancements({}); setPhase("workspace"); setView("preview"); setNotice("Demo profile loaded. Replace it with your own information before exporting.");
  };

  const submitStep = async (event: React.FormEvent) => {
    event.preventDefault();
    const submission = gate.current.begin(500);
    if (submission === null) return;
    setBusy(true); setNotice("");
    const step = interviewSteps[stepIndex];
    const values = { ...draft };
    let improvedBullet = "";
    let nextMode: Mode = "guided";
    let nextReply = guidedReply(step.id, values);
    try {
      const safeInput = toBulletLlmInput(step.id, values, profile.careerGoal.role);
      const cacheKey = enhancementCacheKey(step.id, values, profile.careerGoal.role);
      if (aiEnabled && safeInput && cacheKey && enhancements[cacheKey]) {
        improvedBullet = enhancements[cacheKey];
        nextMode = "groq";
      } else if (aiEnabled && safeInput) {
        try {
          const data = await postJson("/api/interview", { step: step.id, values, targetRole: profile.careerGoal.role });
          if (!gate.current.isCurrent(submission)) return;
          if (typeof data.reply !== "string" || typeof data.bullet !== "string") throw new Error("Invalid interview response");
          nextReply = data.reply;
          improvedBullet = hasUnsupportedNumbers(data.bullet, JSON.stringify(safeInput)) || hasUnsupportedOutcomeClaim(data.bullet, JSON.stringify(safeInput)) ? "" : data.bullet;
          nextMode = data.mode === "groq" && improvedBullet.trim() ? "groq" : "guided";
          if (nextMode === "groq" && cacheKey) setEnhancements((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${step.id}:`))), [cacheKey]: improvedBullet }));
          if (data.fallback || (data.mode === "groq" && !improvedBullet)) {
            setAiEnabled(false);
            setNotice("AI assistance is temporarily unavailable. Guided Mode is active.");
          }
        } catch {
          if (!gate.current.isCurrent(submission)) return;
          setAiEnabled(false);
          setNotice("AI assistance is temporarily unavailable. Guided Mode is active.");
        }
      }
      if (!gate.current.isCurrent(submission)) return;
      const nextProfile = applyStep(profile, step.id, values, improvedBullet);
      const validated = candidateProfileSchema.safeParse(nextProfile);
      if (!validated.success) { setNotice("Please shorten an answer before continuing."); return; }
      setProfile(validated.data); setMode(nextMode); setReply(nextReply);
      if (stepIndex === interviewSteps.length - 1) { setDraft({}); setPhase("profile"); }
      else { setStepIndex(stepIndex + 1); setDraft(valuesForStep(validated.data, interviewSteps[stepIndex + 1].id)); }
    } finally {
      if (gate.current.finish(submission)) setBusy(false);
    }
  };

  const generate = async () => {
    const submission = gate.current.begin();
    if (submission === null) return;
    setBusy(true); setNotice("");
    let summary = fallbackSummary(profile);
    try {
      if (aiEnabled) {
        try {
          const data = await postJson("/api/summary", profile);
          if (!gate.current.isCurrent(submission)) return;
          if (typeof data.summary !== "string") throw new Error("Invalid summary");
          const summaryEvidence = JSON.stringify(toSummaryLlmInput(profile));
          const accepted = !hasUnsupportedNumbers(data.summary, summaryEvidence) && !hasUnsupportedOutcomeClaim(data.summary, summaryEvidence) && !hasUnsupportedGraduationClaim(data.summary, profile);
          summary = accepted && data.summary.trim() ? data.summary : fallbackSummary(profile);
          setMode(data.mode === "groq" && accepted && data.summary.trim() ? "groq" : "guided");
          if (data.fallback || !accepted) {
            setAiEnabled(false);
            setNotice("AI wording was unavailable. Guided Mode created an editable summary.");
          }
        } catch {
          if (!gate.current.isCurrent(submission)) return;
          setAiEnabled(false);
          setMode("guided"); setNotice("AI assistance is temporarily unavailable. Guided Mode created an editable summary.");
        }
      }
      if (!gate.current.isCurrent(submission)) return;
      setProfile({ ...profile, summary }); setPhase("workspace"); setView("preview");
    } finally {
      if (gate.current.finish(submission)) setBusy(false);
    }
  };

  const back = () => {
    if (stepIndex === 0 || busy) return;
    gate.current.cancel();
    const previous = stepIndex - 1;
    setStepIndex(previous); setDraft(valuesForStep(profile, interviewSteps[previous].id)); setReply(""); setNotice("");
  };

  const switchToGuided = () => {
    cancelPending(); setAiEnabled(false); setMode("guided");
    setNotice("Guided Mode is active. You can continue with your answers.");
  };

  const step = interviewSteps[stepIndex];
  return <div className="app-shell">
    <header className="site-header no-print"><div className="brand"><span className="brand-mark">CV<span>.</span></span><span>AI CV Copilot</span></div><div className="header-actions">{phase !== "landing" && <ModeBadge mode={mode} />}{phase !== "landing" && <button className="header-link" onClick={reset}>End session</button>}</div></header>
    {phase === "landing" && <main className="landing">
      <div className="landing-copy"><span className="eyebrow"><span className="eyebrow-line" /> YOUR CAREER, IN FOCUS</span><h1>Make your first<br /><em>impression count.</em></h1><p className="lead">Build a professional first CV through a short guided conversation. Show what you have done, even if you have not had a formal job yet.</p>
        <div className="landing-actions"><button className="button primary" onClick={() => start(true)}>Start My CV <span aria-hidden="true">↗</span></button><button className="button secondary" onClick={() => start(false)}>Build Without AI</button></div>
        <div className="privacy-note"><span aria-hidden="true">◇</span><p><strong>Your privacy matters.</strong> Your CV stays in this browser session. When AI assistance is available, selected professional details may be sent to the configured AI provider. Contact fields are excluded from those requests. Avoid entering information you do not want processed.</p></div>
      </div>
      <div className="landing-visual" aria-hidden="true"><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-card"><div className="visual-top"><span>YOUR NEXT CHAPTER</span><span>01 / 04</span></div><div className="visual-name">Your story,<br />well told<span>.</span></div><div className="visual-rule" /><div className="visual-row"><span>01</span><div><strong>Talk it through</strong><small>A few thoughtful questions</small></div><span>↗</span></div><div className="visual-row"><span>02</span><div><strong>Shape the details</strong><small>Skills backed by evidence</small></div><span>↗</span></div><div className="visual-row"><span>03</span><div><strong>Leave ready</strong><small>A clean CV you can share</small></div><span>↗</span></div></div><div className="visual-caption">FROM FIRST THOUGHT TO FIRST DRAFT</div></div>
      <DemoControls enabled={operatorMode} onLoad={loadDemo} />
    </main>}

    {phase === "interview" && <main className="flow-layout no-print"><aside className="flow-sidebar"><span className="eyebrow">BUILD YOUR STORY</span><h2>A better CV starts with a conversation.</h2><p>We will work through the essentials, one step at a time. You can refine every line later.</p><div className="step-list">{interviewSteps.map((item, i) => <div className={`step-nav ${i === stepIndex ? "active" : ""} ${i < stepIndex ? "done" : ""}`} key={item.id}><span>{String(i + 1).padStart(2, "0")}</span>{item.eyebrow.split(" / ")[1]}</div>)}</div></aside>
      <section className="flow-main"><div className="flow-top"><span>YOUR CV INTERVIEW</span><span>STEP {stepIndex + 1} OF {interviewSteps.length}</span></div><div className="progress"><div style={{ width: `${((stepIndex + 1) / interviewSteps.length) * 100}%` }} /></div>{aiEnabled && <div className="mode-switch"><button className="text-button" type="button" onClick={switchToGuided}>Continue without AI</button></div>}{notice && <p role="status" className="notice">{notice}</p>}
        <div className="conversation"><div className="assistant-avatar">C<span>✦</span></div><div className="conversation-body"><span className="speaker">CV COPILOT</span>{reply && <p className="previous-reply">{reply}</p>}<h1>{questionForStep(step.id, profile)}</h1><p className="hint">{step.helper}</p></div></div>
        <form className="answer-card" onSubmit={submitStep}><div className="answer-head"><span className="eyebrow">{step.eyebrow}</span><span>YOUR RESPONSE</span></div><div className="field-grid">{step.fields.map((field) => <label className="field" key={field.key}><span>{field.label} {field.optional && <small>OPTIONAL</small>}</span>{field.multiline ? <textarea rows={3} maxLength={2000} value={draft[field.key] || ""} placeholder={field.placeholder} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} /> : <input maxLength={step.id === "extras" ? 2000 : ["linkedin", "portfolio", "link"].includes(field.key) ? 500 : 240} type={field.key === "email" ? "email" : "text"} required={!field.optional} value={draft[field.key] || ""} placeholder={field.placeholder} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} />}</label>)}</div>
          <div className="form-footer"><span>{step.id === "project" || step.id === "experience" ? "You can skip optional details." : "You can edit this later."}</span><div className="form-actions">{stepIndex > 0 && <button className="button secondary" type="button" disabled={busy} onClick={back}>Back</button>}<button className="button primary" disabled={busy} type="submit">{busy ? "Working on it…" : stepIndex === 6 ? "Review Profile" : "Continue"} <span aria-hidden="true">→</span></button></div></div></form>
      </section></main>}

    {phase === "profile" && <main className="review-profile no-print"><span className="eyebrow">INTERVIEW COMPLETE</span><h1>Your story is taking shape.</h1><p className="lead">Here is what we captured. Review the key details, then create your first draft. Everything remains editable.</p><div className="profile-grid"><div className="profile-card"><span>01 / DIRECTION</span><strong>{profile.careerGoal.role || "Open to opportunities"}</strong><p>{profile.careerGoal.opportunity || profile.careerGoal.field || "Early career"}</p></div><div className="profile-card"><span>02 / EDUCATION</span><strong>{profile.education[0]?.major || "Your education"}</strong><p>{profile.education[0]?.institution || "Add in editor"}</p></div><div className="profile-card"><span>03 / EVIDENCE</span><strong>{profile.projects.length} project{profile.projects.length === 1 ? "" : "s"} · {profile.experience.length} experience</strong><p>Projects and activities count.</p></div></div>{aiEnabled && <button className="text-button" onClick={switchToGuided}>Continue without AI</button>}<div className="profile-actions"><button className="button secondary" disabled={busy} onClick={() => { gate.current.cancel(); const last = interviewSteps.length - 1; setPhase("interview"); setStepIndex(last); setDraft(valuesForStep(profile, interviewSteps[last].id)); setReply(""); }}>Edit interview answers</button><button className="button primary" disabled={busy} onClick={generate}>{busy ? "Generating CV…" : "Create My CV"} <span>→</span></button></div>{notice && <p role="status" className="notice">{notice}</p>}</main>}

    {phase === "workspace" && <main className="workspace"><div className="workspace-heading no-print"><div><span className="eyebrow">YOUR FIRST DRAFT</span><h1>Make it yours.</h1><p>Review every detail, then print or save your CV as a PDF.</p></div><div className="workspace-actions"><button className="button secondary" onClick={() => { setView("edit"); setTimeout(() => document.querySelector(".workspace-body")?.scrollIntoView({ behavior: "smooth" }), 0); }}>Edit CV</button><button className="button primary" onClick={() => window.print()}>Print / Save PDF <span>↗</span></button></div></div>
      {notice && <p role="status" className="notice no-print">{notice}</p>}
      <div className="workspace-body"><div className="workspace-toolbar no-print"><div className="tabs" role="tablist" aria-label="CV workspace views">{(["preview", "edit", "review"] as const).map((tab) => <button role="tab" aria-selected={view === tab} className={view === tab ? "selected" : ""} key={tab} onClick={() => setView(tab)}>{tab === "review" ? "Review Mode" : tab === "edit" ? "Edit Details" : "CV Preview"}</button>)}</div><span>ATS CLEAN TEMPLATE</span></div>
        {view === "preview" && <div className="preview-layout"><div className="preview-side no-print"><span className="eyebrow">READY TO SHARE</span><h2>Simple. Clear. Yours.</h2><p>This one-column layout is designed to read well on screen and on A4 paper.</p><div className="tip-card"><strong>Saving a PDF?</strong><p>Choose “Save as PDF” in your browser’s print window. Use A4 paper and turn off browser headers and footers for the cleanest result.</p></div><button className="text-button" onClick={() => setView("review")}>Open CV Readiness Check →</button></div><CvDocument profile={profile} /></div>}
        {view === "edit" && <ProfileEditor profile={profile} onChange={(next) => { const valid = candidateProfileSchema.safeParse(next); if (valid.success) setProfile(valid.data); else setNotice("That entry is too long. Please shorten it."); }} />}
        {view === "review" && <div className="review-layout"><div className="review-panel no-print"><span className="eyebrow">HUMAN REVIEW MODE</span><h2>CV Readiness Check</h2><p>Review guidance for mentors and career volunteers. These are factual checks, not a score.</p><div className="target-role"><span>TARGET ROLE</span><strong>{profile.careerGoal.role || "Not specified"}</strong></div>{readinessChecks(profile).length ? <ul className="check-list">{readinessChecks(profile).map((check, i) => <li key={i}><span>!</span>{check}</li>)}</ul> : <div className="all-clear">No common gaps found. A human reviewer should still check wording and relevance.</div>}<button className="text-button" onClick={() => setView("edit")}>Edit details →</button></div><CvDocument profile={profile} /></div>}
      </div><div className="completion-bar no-print"><span>This app keeps your draft in this browser session. End the session to clear it from the app.</span><button className="header-link" onClick={reset}>End & clear session</button></div>
      <div className="print-only"><CvDocument profile={profile} /></div>
    </main>}
    <footer className="site-footer no-print"><span>AI CV COPILOT</span><span>Built for a better first step.</span></footer>
  </div>;
}
