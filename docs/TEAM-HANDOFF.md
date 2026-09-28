# AI CV Copilot: Team Handoff

AI CV Copilot helps students create an editable ATS Clean CV through a short guided interview. Its seven-step flow works without an AI key. Groq improves selected bullets and the summary when configured, while Guided Mode supplies deterministic wording on failures.

## Architecture in plain English

- The Next.js App Router serves one client workflow and two bounded, validated POST routes for AI operations. `GET /api/health` only confirms that the app responds.
- The browser holds the candidate profile, unfinished answers, and a small successful-bullet cache in `sessionStorage`. There is no database or server-side CV persistence.
- The interview maps answers into the Zod `CandidateProfile` regardless of AI availability. The model never owns critical application state.
- AI calls occur only for a project bullet, an experience/activity bullet, and the final summary. Server code filters payloads to relevant professional evidence, parses JSON, and returns Guided content on failure. Client guards reject some unsupported numbers, outcomes, and graduation claims. A mentor must still verify the final CV.
- The ATS Clean document renders from the structured profile. Browser print CSS produces the A4 PDF.

## Important files

| Area | Location |
| --- | --- |
| Workflow and session UI | `src/app/page.tsx` |
| Profile and request schemas | `src/lib/schema.ts` |
| Interview mapping and deterministic replies | `src/lib/interview.ts` |
| Provider interface, Groq, Mock, Guided | `src/lib/providers.ts` |
| AI payload minimization | `src/lib/llm-input.ts` |
| Bullet/summary fallback and factuality guards | `src/lib/cv.ts` |
| API request limits and routes | `src/lib/http.ts`, `src/app/api/` |
| Session restoration and submission guard | `src/lib/session.ts` |
| CV template, editor, readiness checks | `src/components/`, `src/lib/review.ts` |
| Responsive and A4 print styles | `src/app/globals.css` |
| Synthetic demos and tests | `src/lib/demo.ts`, `tests/` |

## Local development

Use Node.js 20.9+ and npm. Run `npm ci`, copy `.env.example` to `.env.local`, and run `npm run dev`. Mock is the default and needs no key. To test a production build locally, run `npm run build` and `npm run start`.

| Variable | Values | Use |
| --- | --- | --- |
| `LLM_PROVIDER` | `mock`, `guided`, `groq` | Selects the server provider; `guided` disables Groq calls |
| `GROQ_API_KEY` | Secret key | Required only for Groq; server-side only |
| `GROQ_MODEL` | Groq model ID | Required only for Groq; event recommendation: `openai/gpt-oss-120b` |

Never use `NEXT_PUBLIC_` for a secret. `.env.local` is ignored by Git. A missing key, timeout, 429, malformed response, or invalid model output leaves the candidate in Guided Mode. Mock mode is for development; it does not represent a live AI response.

## Branch, test, and review

Pull `main`, create a short feature branch, and keep changes focused. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` before opening a pull request. Include screenshots or print evidence when changing UI or CSS. Do not commit candidate personal data or keys. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Deployment

Import the GitHub repository into Vercel as a Next.js project. Standard Next.js settings suffice; no `vercel.json` or database is needed. In Vercel's **Production** environment, configure `LLM_PROVIDER=groq`, a secret `GROQ_API_KEY`, and `GROQ_MODEL=openai/gpt-oss-120b`. Deploy `main`, then test `/api/health`, the attendee and operator URLs, a synthetic Groq-enhanced CV, Guided fallback, and A4 print on event devices. To disable Groq for the whole event, change `LLM_PROVIDER` to `guided` and redeploy. Environment changes require a new deployment to reach serverless functions.

## Event modes and limitations

- Students use `/`; event staff may use `/?demo=1`. Demo mode is not access control. Clear the session between students.
- Browser print creates the PDF; there is no server PDF generation.
- The interview captures one primary project and one experience entry. More entries can be added in the editor.
- The app is English-only, has one ATS template, and has no account or cross-device recovery.
- Provider wording can still need human review. The event operator should verify the actual network, printer, and account limits before opening.

See [EVENT-RUNBOOK.md](EVENT-RUNBOOK.md) for the station workflow.
