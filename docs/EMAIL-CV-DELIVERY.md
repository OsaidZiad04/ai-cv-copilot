# Email My CV — isolated delivery experiment

Branch: `feature/email-cv-delivery`, based directly on production `v1.0.1` (`b11b09b`). This document does not authorize a production merge. Groq, Guided Mode, the profile schema, and browser Print / Save PDF remain unchanged.

## Architecture

The browser sends `{ profile: CandidateProfile }` to `POST /api/email-cv` only after **Send My CV**. The server validates the profile/email, generates a text PDF in memory with `@react-pdf/renderer`, sends one fixed transactional message through Brevo, and releases the request data. No database, CV archive, public file, uploaded attachment, or additional LLM call exists.

`GET /api/email-cv` returns only an enabled boolean. The button is hidden when the toggle is false/missing or lookup fails. A true toggle with incomplete sender/key configuration shows the action but safely rejects sends. Correcting the address explicitly updates `profile.personal.email`, including the CV header and current browser session, before a send is possible. There is no separate recipient parameter.

Files: `src/components/EmailCvDelivery.tsx`, `src/lib/email-cv.ts`, `src/lib/pdf/`, `src/app/api/email-cv/route.ts`. Both document renderers use production `hasText` / `visibleSections`. The email PDF contains the same rendered evidence; it does not silently restore bullets deliberately cleared in the editor.

## Brevo setup and sender verification

Use a Brevo account with transactional email access, an API key, and a sender verified in its **Senders, Domains & Dedicated IPs** settings. Follow Brevo's account instructions to authenticate the sending domain where available. An accepted API request alone does not prove inbox delivery; check spam, bounce/block events, and account limits. Never paste credentials into chat, screenshots, commits, or a `NEXT_PUBLIC_` variable.

References: [transactional API](https://developers.brevo.com/reference/send-transac-email), [sending guide](https://developers.brevo.com/docs/send-a-transactional-email), [React PDF fonts](https://react-pdf.org/docs/v4/fonts), [in-memory rendering](https://react-pdf.org/docs/v4/node).

## Environment variables

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `CV_EMAIL_SEND_ENABLED` | Optional; default disabled | Only the exact value `true` enables delivery |
| `BREVO_API_KEY` | Sending only | Secret server API credential |
| `CV_EMAIL_FROM` | Sending only | Valid, verified sender email |
| `CV_EMAIL_FROM_NAME` | Optional | Sender display name; default `AI CV Copilot`, maximum 120 characters |

All four are server settings. AI settings (`LLM_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL`) are independent and need no change for this feature.

## Local testing

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
```

Put the four email settings securely in ignored `.env.local`, then restart the server. Use `/?demo=1`, load a synthetic candidate, and explicitly correct the profile email to an inbox you control. Verify the displayed address before sending. **Do not send to demo/example addresses or real students during QA.** Check subject, filename, attachment, selectable text, and evidence in the received message.

To test failure without contacting Brevo, set the key to blank in that local server's process environment while leaving the toggle true. Print, editing, review, refresh recovery, and reset should still work.

Generate reproducible synthetic developer QA artifacts:

```bash
node scripts/email-pdf-qa.mjs
python scripts/verify-email-pdfs.py --render
```

The second command requires `pypdf`, `pdfplumber`, and Poppler's `pdftoppm`. These are optional developer QA tools, not application dependencies. Only this explicitly invoked synthetic developer script writes PDF samples to disk. The production route never does. Automated Node tests need no Python installation.

## Preview setup — manual, branch scoped

After a branch push, confirm its Vercel deployment is **Preview**, never promote it. In Vercel → project → Settings → Environment Variables, add the four settings for **Preview only**, selecting branch `feature/email-cv-delivery` where supported. Enter the key using the secure settings UI. Do not select Production or alter any Groq setting. Redeploy that Preview to apply settings. Visit its URL, check `/api/health` and `/api/email-cv`, then repeat the synthetic inbox test. Remove/disable branch-specific Preview settings after the experiment if no longer needed.

Preview secrets have not been copied automatically. If a Preview inherits an enabled email setting, disable it for this branch until the team deliberately authorizes a test.

## Production setup — future approved release only

This branch is not a production deployment. If a later human-approved release adopts it, configure the four email variables for the intended environment, verify sender authentication/quota, deploy that approved commit, and repeat inbox/PDF/device QA. Do not enable publicly merely because local sending succeeds. Provider quotas are the hard external limit; verify the actual configured account's current plan and daily transactional allowance in Brevo. No quota number is promised in the UI.

## Privacy

Selecting email shares the candidate email and PDF with Brevo and the receiving mail service. The server temporarily receives the complete profile to render it; unlike Groq payloads, the PDF contains contact information. The short email body includes only a first-name greeting and a review reminder, not CV content. There is no intentional server logging or persistent storage of candidate data. The mail provider and recipient can retain messages/attachments under their policies. Ending a session clears the app draft; it cannot recall an accepted email or delete inbox/provider copies.

## Limits, failure behavior and abuse review

- Zod validates a profile and bounded valid profile email. Top-level unknown mail fields are rejected. No arbitrary HTML, sender, subject, CC/BCC, uploaded attachment or custom body is accepted.
- Body maximum: 256 KiB; serialized validated profile maximum: 60,000 characters; generated PDF maximum: 2 MB. Individual profile fields/arrays retain production limits.
- Slow body reading is bounded to 2 seconds; PDF generation plus send to 25 seconds; client waits at most 30 seconds. A platform may terminate a function earlier. Font files are bundled and traced; candidate URLs are never fetched.
- One explicit send gives one provider attempt, without automatic retry. Client locks immediately, disables controls while sending, and aborts its wait on unmount. A lost response/timeout can occur after provider acceptance: check the inbox before retrying.
- Best effort per-instance throttling retains only SHA-256 email/IP keys for 1 minute/10 minutes, maximum 1,000 entries. One recipient per minute, five sends per source per 10 minutes, and at most two active render/send requests per instance. Shared event networks may hit the source limit; use Print / Save PDF. This is not a distributed limit and does not prove mailbox ownership. Cold starts, multiple instances, direct non-browser requests or spoofable source headers can bypass it. Provider quota remains essential; review exposure before enabling publicly.
- Validation errors return friendly messages. Missing configuration, provider 4xx/429/5xx, timeouts and rendering failures never expose response bodies or keys. All responses use `Cache-Control: no-store`. CV state remains available.
- CPU work already inside the renderer is not forcibly cancelled by a timer. The handler stops waiting and never sends a late PDF, but render work can finish in memory. No mailbox verification, delivery receipt UI, durable idempotency, bounce management or cross-instance throttling is implemented.

## Disable / rollback

Set `CV_EMAIL_SEND_ENABLED=false` (or remove it) in the **specific environment** and redeploy/restart that environment. This is a deployment configuration switch, not an instant live remote switch. Both the button and send endpoint become unavailable. Existing Print / Save PDF remains usable. Roll back an approved deployment through Vercel only when separately authorized; this experiment has not changed production.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No button | Exact toggle value, environment scope, restart/redeploy, capability response |
| Invalid email | Correct and save the profile email first |
| Unavailable | Key presence, sender verification, account quota/block events, network; never show provider body to students |
| Wait before retry | Recipient/source throttle; check inbox and use Print meanwhile |
| API accepted but no inbox mail | Spam/junk, provider delivery events, bounce, recipient spelling |
| Font/runtime error | Build includes `assets/fonts/*.ttf`; Node runtime and renderer externalization settings |
| Unusual script/glyph | Latin/accented Latin and Arabic are tested; other scripts require further font QA |

The dependency audit currently reports five advisories in unchanged baseline packages (Next.js and its existing dependencies/build tooling). The PDF dependency introduced none in the checked lockfile. This experiment does not upgrade production dependencies; resolve applicability and a dedicated update before a broader release.
