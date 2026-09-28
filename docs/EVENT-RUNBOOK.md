# AI CV Copilot: Event Operator Runbook

Use the attendee HTTPS URL for students. Keep this guide available at the CV corner. The app works in Guided Mode when AI is unavailable.

## Before the event

1. Open the production attendee URL (`/`) on each event device. Confirm the start screen and **Start My CV** button appear. Check `/api/health` returns `{"status":"ok"}`; this checks the app, not Groq.
2. Check the internet connection. Run one synthetic test candidate with a project description. After the project bullet is used, **AI Enhanced** should appear if Groq is working. Earlier steps use Guided replies by design.
3. Finish the test CV, open **Review Mode**, and use **Print / Save PDF**. In Chrome or Edge, choose **Save as PDF**, A4 paper, and disable browser headers and footers. Open the saved PDF and check it before the event begins.
4. Select **End & clear session** after the test. Confirm the next student sees the blank start screen.

## Normal student workflow

1. Open the attendee URL or scan the event team's QR code.
2. Select **Start My CV** (or **Build Without AI**).
3. Complete the short interview.
4. Review the captured profile.
5. Select **Create My CV**.
6. Ask a mentor to check wording and the **CV Readiness Check**.
7. Select **Print / Save PDF** and review the saved file.
8. Select **End & clear session** before the next student.

## If AI fails or Groq limits are reached

The current candidate can continue in **Guided Mode** without restarting. Select **Continue without AI** during the interview if needed. The CV remains editable and printable. Do not repeatedly resubmit a failed request.

For an event-wide switch, a deployment owner should open **Vercel → Project → Settings → Environment Variables**, set the **Production** value of `LLM_PROVIDER` to `guided`, and **redeploy the latest production commit**. Environment changes affect new deployments; confirm `/api/health` and run a synthetic CV after redeploy. Keep the Groq key in Vercel's secret environment setting; do not paste it into chat or source code. To restore AI, set `LLM_PROVIDER=groq`, redeploy, and test a project bullet.

## Between students

Always select **End & clear session**. The app keeps a draft in the current browser tab until this action or the tab's session ends. Check that the next person sees the blank landing page. Downloaded PDFs and browser print history are controlled by the event device; handle them under the event team's privacy procedure.

## Demo

Open the operator URL `/?demo=1` to access the two labeled demo profiles. The normal attendee URL `/` does not show them. Demo mode is a convenience switch, not authentication. Never present demo data as a real candidate CV. Clear the demo session before handing the device to a student.

## Privacy explanation for students

“Your draft is kept in this browser session. If AI assistance is enabled, selected professional details may be sent to our configured AI provider; contact fields are excluded from those AI requests. Please review the CV before sharing it. We clear the app session between students.”
