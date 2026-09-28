# AI CV Copilot

Build a professional first CV through a short guided conversation, with optional AI help and a reliable no-key fallback.

**Status:** `v1.0.0-rc.1` event release candidate. The repository has passed local and live Groq checks; production deployment and event-device validation are still pending.

## Features

- Seven-step interview for student and early-career evidence, including projects and activities without formal employment.
- Structured, editable profile and one-column ATS Clean CV.
- Groq wording for a project bullet, an experience/activity bullet, and the professional summary when configured; no more than about three AI calls in a normal interview.
- Mock and deterministic Guided modes that work without a paid service or API key.
- CV Readiness Check with factual guidance, plus A4 browser Print / Save PDF.
- Two synthetic operator demos available only at `/?demo=1`.

## Product flow

Start → guided interview → profile review → CV preview and editing → human readiness check → print/save PDF → end and clear session.

## Architecture

This is one Next.js App Router application. The browser stores the candidate profile and unfinished answers in the current tab's `sessionStorage`. Server API routes validate bounded requests, select Groq/Mock/Guided, and process candidate data in memory. There is no database. Model payloads contain only task-specific professional evidence, and AI output is validated before it can affect the CV. Provider failures return Guided wording without a repeated automatic retry.

See [Team Handoff](docs/TEAM-HANDOFF.md) for the file map and design details. `GET /api/health` returns only `{"status":"ok"}`; it checks app availability, not provider health.

## Screenshots

All screenshots use synthetic demo data. No real candidate data should be committed.

| Screen | Screenshot |
| --- | --- |
| Landing | [Desktop](docs/screenshots/landing-desktop.png) · [Mobile](docs/screenshots/landing-mobile.png) |
| Interview | [Desktop](docs/screenshots/interview-desktop.png) · [Mobile](docs/screenshots/interview-mobile.png) |
| CV preview | [ATS Clean preview](docs/screenshots/cv-preview.png) |
| Review Mode | [CV Readiness Check](docs/screenshots/cv-readiness-check.png) |

## Local development

Requires Node.js 20.9+ and npm. Chrome or Edge is recommended for A4 printing.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env.local`. Open `http://localhost:3000`. The template defaults to Mock mode and needs no key.

## AI configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | No | `mock` (default), `guided`, or `groq` |
| `GROQ_API_KEY` | Groq only | Secret server-side key; never prefix with `NEXT_PUBLIC_` |
| `GROQ_MODEL` | Groq only | Current model ID; event recommendation: `openai/gpt-oss-120b` |

Groq uses its [chat completions API](https://console.groq.com/docs/api-reference). The supported GPT-OSS models use [strict Structured Outputs](https://console.groq.com/docs/structured-outputs); other models use JSON Object Mode with application validation. Confirm availability in the [Groq model list](https://console.groq.com/docs/models). `GROQ_MODEL` remains configurable.

## Guided Mode

Select **Build Without AI** on the start screen or **Continue without AI** during the interview. Setting `LLM_PROVIDER=guided` disables Groq server-wide after redeployment. Missing credentials, a 429, timeout, network failure, malformed response, or rejected wording also falls back to Guided content. Mock mode is for development and is labeled Guided Mode to students.

## Demo / operator mode

Normal attendee URL: `/`. Operator URL: `/?demo=1`. The operator URL reveals two labeled synthetic profiles. Demo mode is not authentication; clear it with **End & clear session** before the next student.

## Testing

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
```

The tests cover schemas, provider selection, model payload minimization, failures and fallback, factuality checks, CV rendering, session restoration, duplicate submissions, and operator controls. UI and PDF output still need a final check on actual event devices.

## Deployment

Import this GitHub repository into Vercel as a standard Next.js project; no custom configuration file is needed. Add the following **Production** environment variables in Vercel Project Settings:

```text
LLM_PROVIDER=groq
GROQ_API_KEY=<enter securely in Vercel; never commit>
GROQ_MODEL=openai/gpt-oss-120b
```

Deploy `main` and test the resulting HTTPS URL before sharing a QR code. Emergency configuration: set `LLM_PROVIDER=guided` and redeploy the latest production commit. The app remains usable without Groq. See the [Event Runbook](docs/EVENT-RUNBOOK.md) for checks and the exact operator action.

## Privacy

Candidate information stays in this browser tab's `sessionStorage` until session reset or tab-session end. On AI operations, selected professional evidence may be sent through this app's API routes to the configured provider. Full name and contact fields are excluded from Groq payloads; recognizable contact-like text in professional free text is filtered. The server does not intentionally save or log CV content. Students should review generated wording before sharing. A saved PDF and browser print history are outside the app's session-clearing control.

## Event usage and documentation

- [Event Operator Runbook](docs/EVENT-RUNBOOK.md): station checklist, Guided fallback, privacy explanation, and between-student reset.
- [Team Handoff](docs/TEAM-HANDOFF.md): architecture, source map, local setup, and deployment.
- [Contributing](CONTRIBUTING.md): branch and pull request workflow.

## Current limitations

English-only, one CV template, no accounts or cross-device recovery, and one primary project and experience collected during the interview. Browser print creates the PDF. AI factuality guards catch some unsupported claims, but a human reviewer must check the final CV. Production URL, event network, account limits, and device printing require an event-team check before launch.
