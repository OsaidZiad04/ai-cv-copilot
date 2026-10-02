# Pre-Event vNext — v1.0.1 comparison

**Decision: POST-EVENT ONLY.** This is an isolated product experiment based on production `v1.0.1` (`b11b09bc1462f49e04e0fabf2abfea86febfdfb8`). It is not a production patch or release recommendation for October 3. The local flows and automated gates passed, but the integrated revision UI and mentor prioritization have not had an event-device or mentor usability test, and a browser-generated PDF could not be captured in this environment.

## Student experience

| | v1.0.1 | Pre-Event vNext |
|---|---|---|
| First CV path | Seven interview screens, profile review, CV workspace | Same seven screens and workspace |
| Weak evidence | Existing project/skill fields and readiness check | One optional inline skill example prompt, an inline contribution cue, and a sparse-profile activity cue |
| Strong evidence | Existing questions | Inline cues stay absent when a contribution and exact skill examples are already present |
| No employment | Guided reply points to projects and activities | Same, with a supplied club/training action surfaced for mentor discussion |

Local observations: a technical student with a described Python/FastAPI project received no additional project or skill prompt; a student listing Figma without a project received one optional skill prompt. The latter remained skippable and no additional screen appeared. Screenshots: [strong path](screenshots/desktop-strong-no-followup.png), [mobile follow-up](screenshots/mobile-evidence-prompt.png), [mobile interview](screenshots/mobile-interview.png).

## Evidence quality

The new `EvidenceNote` sidecar records an optional skill → self-described example relationship in browser session state. It does not enter the CV automatically or provider input. Existing project capture, O01 preservation, and factuality guards remain in place. A local reviewer can see candidate-supplied action text without treating it as verified or objectively strongest.

This is a modest improvement in **elicitation**, not proven improvement in the exported CV: an answer to the optional skill prompt must still be added to CV details by the candidate if they want it printed. The existing Guided bullet can repeat a technology already present in a candidate contribution (observed: “with Python and FastAPI using Python, FastAPI”); vNext does not resolve this baseline wording issue. No content quality advantage over v1.0.1 was measured with students.

## Interview length

Both versions retain seven numbered screens. vNext adds zero required fields and at most one inline skill example prompt at the skills screen; the contribution and sparse-profile cues are inline text. The prompt is chosen locally and can be skipped. No timed participant study was run, so time per candidate and queue impact remain unknown. Normal local Guided and Mock flows reached the CV workspace without an extra navigation step.

## Mentor experience

v1.0.1 exposes a full CV Readiness Check. vNext shows target role, one candidate-supplied action (first available by field order, selectable), and at most three immediately visible review priorities. Remaining checks are in a disclosure. Each issue has a direct edit link; the example link focused `projects-0-contribution` by keyboard, and “Back to review brief” restored focus to the originating control. This was observed at 1440px; the brief also had no horizontal overflow at 375px. Screenshots: [desktop brief](screenshots/desktop-mentor.png), [focused editor](screenshots/desktop-focused-edit.png), [mobile brief](screenshots/mobile-mentor.png).

The prioritization is a deterministic heuristic. It can miss unusual action verbs or infer only that a skill is literally mentioned; it does not assess competence. A QA case exposed “Sketched” being missed, which was corrected and tested. Human mentors have not yet assessed whether the priority order helps them finish in 60 seconds.

## Revision safety

v1.0.1 keeps edits but does not track which source revision produced a summary or bullet. vNext records local source revisions for generated summary/project/experience wording. Changing relevant facts preserves the chosen wording and labels it for review. Keep, Edit manually, Preview Guided rewrite, and explicit AI rewrite are distinct actions; a preview must be accepted to replace text. Manual edits are never silently replaced. Refresh, same-name reorder, project deletion, malformed saved metadata, and late proposal acceptance are covered by imported P3 regression cases. Screenshots: [needs review](screenshots/desktop-needs-review.png), [preview](screenshots/desktop-preview.png).

This adds substantial UI and state complexity. The status records whether facts changed; it does **not** verify candidate claims or certify CV wording. Demo/legacy wording with no source revision remains marked unknown in the editor, while the global warning appears only for known changed revisions.

## LLM usage

The existing normal automatic budget is unchanged: zero calls in Guided Mode; up to three AI calls for project, experience, and summary when those inputs qualify. Evidence prompts, mentor review, and revision detection use zero AI calls. “Preview AI rewrite” can make one **additional, explicitly requested** call through the existing `/api/interview` route; a failed or malformed response offers Guided wording. No new provider, model, endpoint, request field, or paid dependency was added. This count follows the request paths and tests; a live Groq call was deliberately not made for this local experiment.

## Performance

No before/after participant timing or production latency measurement was collected. The interview screen count and normal AI call count are unchanged. The additional browser-side evidence scan runs over candidate-entered profile text; the reviewer tasks and freshness checks are local. On the local 1440px and 375px checks, `document.documentElement.scrollWidth` stayed within the viewport and browser error logs were empty. Final automated run: lint 21 source files; typecheck exit 0; tests 99 passed/0 failed (about 1.25 seconds in that run); Next production build exit 0 (about 8 seconds). These are build/test durations, not student completion times.

## Complexity added

- Local evidence note in saved session, one bounded interview question, and contextual Guided reply.
- Freshness provenance model and compare/Keep/Edit/Rewrite UI for generated wording.
- Mentor task triage, selectable example, direct field IDs/focus restoration, and responsive styles.
- Synthetic Wave 2 fixture, 60 P3 regression cases, and five integration-focused review tests (99 tests total with existing suite).

No schema, provider, database, server storage, CV document component, print media rules, or dependency was changed. The [state evidence](artifacts/state-evidence.json) and [screenshots](screenshots/) are synthetic/local QA artifacts.

## New failure modes

- A user may read “Needs review” as a factuality verdict; the UI explicitly says it is only a source-revision reminder.
- The local action recognizer may miss a valid action verb or count an ambiguous one; reviewer judgment remains necessary.
- A skill example in the sidecar is visible to the mentor but absent from the PDF unless entered into CV details. This separation prevents unreviewed text from entering the CV, but adds a transfer step.
- More review state means more browser-session data and more paths to test across Back, edit, refresh, reorder, and reset.
- An explicit AI rewrite is an extra request and can fail; Guided preview remains available.
- The local browser's print dialog blocked automated PDF capture. The ATS document component and `@page`/`@media print` rules are byte-for-byte unchanged from v1.0.1, and static rendering tests exclude review controls, but **A4 PDF visual output was not reverified for this branch**. Chrome/Edge headless printing failed in this environment.

## Reasons to use vNext tomorrow

- A mentor can see an action and three or fewer priorities immediately, then jump to a field and return with keyboard focus restored.
- A student with a weakly supported skill receives one relevant optional example prompt without another screen or AI call.
- Edits to source facts no longer leave generated wording silently treated as current.

These are local software observations; no student throughput or mentor benefit has been established in the event setting.

## Reasons to stay on v1.0.1

- v1.0.1 is the deployed, previously event-device-tested release; vNext adds new state and UI paths one day before the event.
- There is no measured improvement in finished CV quality or time per attendee.
- The new mentor heuristics need a real career mentor's review, and the browser PDF could not be visually rechecked here.
- The optional skill example is not automatically included in the final CV, so its practical value is still a hypothesis.

**Recommendation: POST-EVENT ONLY.** Keep v1.0.1 for the event. Review this branch with a mentor and test a real Chrome/Edge A4 PDF, then run a timed attendee comparison before considering a merge. No production merge, tag, or deployment is authorized by this document.
