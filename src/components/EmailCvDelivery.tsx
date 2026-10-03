"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { CandidateProfile } from "@/lib/schema";

type Status = "ready" | "sending" | "success" | "failure";
const validEmail = z.string().trim().max(240).email();
export function EmailCvDelivery({ profile, onEmailChange }: { profile: CandidateProfile; onEmailChange: (email: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("ready");
  const [correcting, setCorrecting] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const locked = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const capability = new AbortController();
    fetch("/api/email-cv", { cache: "no-store", signal: capability.signal }).then(async (response) => {
      if (response.ok && mounted.current) setEnabled((await response.json()).enabled === true);
    }).catch(() => { /* Printing stays available if capability lookup fails. */ });
    return () => { mounted.current = false; capability.abort(); request.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLButtonElement>(".email-send")?.focus();
    return () => { element?.close(); trigger.current?.focus(); };
  }, [open]);

  const begin = () => { setStatus("ready"); setCorrecting(false); setEmail(profile.personal.email); setEmailError(""); setOpen(true); };
  const saveEmail = () => {
    const parsed = validEmail.safeParse(email);
    if (!parsed.success) { setEmailError("Enter a valid email address."); return; }
    onEmailChange(parsed.data); setCorrecting(false); setEmailError(""); setStatus("ready");
  };
  const send = async () => {
    if (locked.current || status === "success") return;
    if (!validEmail.safeParse(profile.personal.email).success) { setCorrecting(true); setEmailError("Update your profile with a valid email address before sending."); return; }
    locked.current = true; setStatus("sending");
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/email-cv", { method: "POST", cache: "no-store", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ profile }) });
      if (!response.ok || (await response.json()).sent !== true) throw new Error("Delivery unavailable");
      if (mounted.current) setStatus("success");
    } catch { if (mounted.current) setStatus("failure"); }
    finally { clearTimeout(timer); locked.current = false; request.current = null; }
  };
  if (!enabled) return null;
  return <>
    <button ref={trigger} className="button secondary" onClick={begin}>Email My CV</button>
    {open && <dialog ref={dialog} className="email-dialog no-print" aria-labelledby="email-title" aria-describedby="email-privacy" onCancel={(event) => { event.preventDefault(); if (!locked.current) setOpen(false); }}>
      <h2 id="email-title">{status === "success" ? "CV sent" : "Email your CV"}</h2>
      {status !== "success" && <><p>Send your CV to</p><strong className="email-recipient">{profile.personal.email || "Add your email address"}</strong>
        {correcting ? <div className="email-correction"><label className="field"><span>Profile email</span><input type="email" maxLength={240} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="text-button" onClick={saveEmail}>Update profile email</button><p className="hint">This changes the email shown on your CV too.</p>{emailError && <p role="alert">{emailError}</p>}</div>
          : <button className="text-button" disabled={status === "sending"} onClick={() => { setEmail(profile.personal.email); setCorrecting(true); }}>Correct profile email</button>}
      </>}
      <p id="email-privacy" className="hint">Sending your CV will share your email address and CV file with our email delivery provider so it can deliver the message.</p>
      <div role="status" aria-live="polite" aria-atomic="true">
        {status === "sending" && <p>Preparing and sending your CV…</p>}
        {status === "success" && <p>Check your inbox. If you do not see it, check your spam or junk folder.</p>}
        {status === "failure" && <p>We couldn&apos;t send your CV right now. Check your inbox before trying again. You can still use Print / Save PDF.</p>}
      </div>
      <div className="email-actions">
        {status !== "success" && <button className="button primary email-send" disabled={status === "sending" || correcting} onClick={send}>{status === "sending" ? "Sending…" : "Send My CV"}</button>}
        <button className="button secondary" disabled={status === "sending"} onClick={() => setOpen(false)}>{status === "success" ? "Done" : "Cancel"}</button>
      </div>
    </dialog>}
  </>;
}
