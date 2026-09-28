# AI CV Copilot

Release candidate: **v0.2.0**. Headless Chrome QA covered 375px, 768px, and 1440px layouts and A4 PDF output. Phase 3 live Groq checks covered five fictional candidate scenarios. Complete a final check on the event devices before opening the CV corner.

AI CV Copilot helps students and fresh graduates turn a short guided conversation into an editable, one-column CV. It is designed for an event CV corner, where a provider outage must not stop a student from leaving with a usable draft.

> Screenshots: add landing, interview, editor, and A4 print screenshots after the event team captures them.

## What it does

- A seven-step, friendly interview captures contact details, career direction, education, projects, experience, skills, and optional extras.
- A validated `CandidateProfile` remains separate from the rendered ATS Clean CV.
- Groq can improve a project bullet, an experience or activity bullet, and the summary. Mock mode works without credentials; Guided Mode uses deterministic local wording.
- Students can edit all profile fields, the summary, and every bullet, add or remove entries, and clear optional sections.
- Review Mode shows the CV alongside factual readiness guidance, without a fabricated score.
- Browser print produces an A4 CV. Choose **Save as PDF** in Chrome or Edge, set paper to A4, and disable browser headers and footers.
- Two clearly marked demo profiles support event walkthroughs at `/?demo=1`; normal student visits do not show them.

## Architecture

This is one Next.js App Router application. The browser owns the session profile and unfinished step answers in `sessionStorage`; the server holds no database. Interview answers are mapped into structured fields deterministically in `src/lib/interview.ts`. The browser requests AI only for a project bullet with usable facts, an experience or activity bullet with details, and the final summary: at most about three Groq calls for a normal candidate, fewer when sections are empty. Other interview replies are deterministic. Successful bullet results are cached in the current browser session so back/continue with unchanged answers does not repeat a request. AI output is parsed and validated before use. The server responds with guided content on a provider error, malformed response, timeout, or missing configuration. A browser request failure also falls back locally. A duplicate submission is ignored, and ending a session cancels an in-flight request.

`LLMProvider` supports `GroqProvider`, `MockProvider`, and `GuidedProvider`. `GROQ_API_KEY` is read only inside API routes. `src/lib/llm-input.ts` builds narrow, task-specific model payloads that exclude names, contact details and personal links. No arbitrary candidate URL is fetched by the backend. React escapes rendered text, and CV links are limited to HTTP(S).

### Project structure

```text
src/app/                 Next.js screens, print CSS, API routes
src/components/          ATS Clean document and editable profile UI
src/lib/schema.ts        Zod profile and request validation
src/lib/interview.ts     Progressive interview and deterministic profile updates
src/lib/session.ts       Session restoration and duplicate-request guard
src/lib/llm-input.ts     Task-specific Groq payloads and instruction filtering
src/lib/http.ts          Bounded JSON request reading
src/lib/providers.ts     Provider interface, Groq, Mock, Guided
src/lib/cv.ts            CV wording fallback and section selection
src/lib/review.ts        Factual readiness checks
src/lib/demo.ts          Demo profiles
tests/                   Domain and rendering tests
scripts/lint.mjs         Source hygiene lint checks
```

## Requirements

- Node.js 20.9 or newer (Node 22 or 24 LTS recommended)
- npm
- Chrome or Edge for the best A4 print result

## Local installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

On PowerShell, copy the environment template with `Copy-Item .env.example .env.local`. Open `http://localhost:3000`. The default `.env.example` uses Mock Mode, so no API key is required.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | No | `mock` (default), `guided`, or `groq` |
| `GROQ_API_KEY` | Only for Groq | Server-side API key; never use `NEXT_PUBLIC_` |
| `GROQ_MODEL` | Only for Groq | Current Groq chat-completions model ID |

For Groq, set `LLM_PROVIDER=groq`, add your key, and choose an available model from the [Groq model list](https://console.groq.com/docs/models). The model is deliberately configurable because availability changes. The integration calls Groq's [OpenAI-compatible chat completions endpoint](https://console.groq.com/docs/api-reference). GPT-OSS 20B and 120B use [strict Structured Outputs](https://console.groq.com/docs/structured-outputs); other models use JSON Object Mode. The application still validates responses with Zod and keeps Guided fallback. In the Phase 3 A/B live comparison, `openai/gpt-oss-120b` gave the more consistent factual summaries; it is the current event recommendation if that model is available to your account. Keep `GROQ_MODEL` configurable and verify it on the actual event account.

To test without a key, use `LLM_PROVIDER=mock`. To avoid all provider calls, use `LLM_PROVIDER=guided` or choose **Build Without AI** on the landing screen. If Groq is missing a key/model, unavailable, rate limited, times out, or returns invalid JSON, the request continues in Guided Mode.

## Event Operator Guide

1. For a local event station, run `npm run build` and then `npm run start`, or open the deployed app. Open `/?demo=1` to load each demo profile before attendees arrive. Use `/` for students. Use `npm run dev` only while developing.
2. Start a short test CV with a project and check the status indicator after its bullet is improved. **AI Enhanced** means a successful Groq result was used; **Guided Mode** means deterministic wording is active. Mock mode intentionally displays Guided Mode to students.
3. If AI assistance is slow or unavailable, select **Continue without AI** during the interview, or **Build Without AI** on the start screen. Existing answers remain available.
4. After each candidate, select **End & clear session**. Check the browser tab before handing the station to the next person.
5. Select **Print / Save PDF**, choose **Save as PDF**, set A4 paper, and disable browser headers and footers. Review the saved file before sharing it.

## Commands

```bash
npm run dev        # local app
npm run lint       # TypeScript AST syntax/security hygiene checks
npm run typecheck  # strict TypeScript check
npm run test       # domain, full guided flow, and rendering tests
npm run build      # production build
npm run start      # serve the production build
```

The source hygiene linter checks parse errors and dangerous constructs such as `eval`, `dangerouslySetInnerHTML`, explicit `any`, `debugger`, and `console.log`. TypeScript provides the full type check separately.

## Deployment

Deploy the repository to Vercel as a Next.js project. For a no-key event deployment, set `LLM_PROVIDER=mock` or `guided`; neither requires paid services. For AI enhancement, set all three Groq variables in the deployment environment. Never commit `.env.local`, `.env`, or API keys. Test the PDF print flow in the browsers used at the event.

## Privacy model

The candidate profile and unfinished answers are held in the current browser tab's `sessionStorage`. On AI steps, relevant answers or the profile are sent to this app's API routes. In Groq mode, only task-specific professional evidence is forwarded to Groq: project facts and target role for a project bullet; experience or activity facts and target role for an experience bullet; or career goal, education, projects, experience, skills, training, certifications, volunteering, and awards for a summary. Bare graduation years are omitted from summary prompts when completion status is unclear. Full name, email, phone, location, LinkedIn and portfolio fields are excluded from Groq payloads; contact-like text inside professional free-text fields is filtered where recognizable. API routes process data in memory and do not save or log profile content. Review Groq's data terms before enabling it at an event. Ending the session clears this app's browser state and cancels an in-flight request. A browser tab or crash may retain session state until it is closed or reset, and browser print/PDF files are controlled by the device user. This is a session-based MVP, not a guarantee of data erasure from every system.

## Limitations

- The CV uses one English ATS Clean template. PDF export uses the browser print dialog rather than a server-generated PDF.
- The interview captures one primary education entry and one project/experience entry at a time. More can be added in the editor.
- AI text is instructed to preserve facts and validated structurally. Number, outcome-wording, and graduation-status guards catch some unsupported claims, but a human should verify all wording before sharing the CV.
- Headless Chrome visual and print checks and live Groq requests passed. The actual event devices, network, printer/PDF setup, and event account limits still need an operator check.
- Session state is local to one tab. There is no account, cloud sync, or server-side recovery.
- No job-description tailoring or multilingual experience is included in this MVP.

## Roadmap

After event feedback: Arabic interview with English CV output, additional ATS templates, job-description tailoring, QR event mode, anonymous event analytics, more provider adapters, and optional persistent accounts. Voice, OCR, scraping, and employer workflows are intentionally outside the MVP.
