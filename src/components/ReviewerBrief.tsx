"use client";

import type { CandidateProfile } from "@/lib/schema";
import { reviewTasks, suppliedExamples, type ReviewTask } from "@/lib/review";

type Props = { profile: CandidateProfile; selected: string; onSelect: (key: string) => void; onEdit: (field: string, reference: string, returnId: string) => void; integrityTasks?: ReviewTask[]; evidenceNote?: string };
export function ReviewerBrief({ profile, selected, onSelect, onEdit, integrityTasks = [], evidenceNote }: Props) {
  const examples = suppliedExamples(profile);
  const example = examples.find(e => e.key === selected) || examples[0];
  const tasks = [...integrityTasks, ...reviewTasks(profile)];
  const taskCard = (task: ReviewTask) => <li key={task.id} className="review-task">
    <strong>{task.message}</strong><p>{task.reason}</p>
    <details><summary>See supplied source</summary><p className="review-source">{task.source}</p><small>Source text is self-described and needs human review.</small></details>
    <button id={`review-task-${task.id}`} className="text-button" onClick={() => onEdit(task.field, task.message, `review-task-${task.id}`)}>Edit this field →</button>
  </li>;
  return <div className="review-panel no-print">
    <span className="eyebrow">HUMAN REVIEW MODE</span><h2 id="review-brief-heading" tabIndex={-1}>Mentor review brief</h2>
    <p>Agree one next action with the candidate. These are local review prompts, not a score or factual verification.</p>
    <div className="target-role"><span>TARGET ROLE</span><strong>{profile.careerGoal.role || "Not specified"}</strong><small>{profile.careerGoal.opportunity || profile.careerGoal.field}</small><button className="text-button" onClick={() => onEdit("careerGoal-role", "Target role", "review-brief-heading")}>Edit target role →</button></div>
    <section className="review-example" aria-labelledby="example-heading"><h3 id="example-heading">Supplied action to discuss</h3>
      {example ? <><label className="field"><span>Choose an example with the candidate</span><select value={example.key} onChange={e => onSelect(e.target.value)}>{examples.map((e, i) => <option key={`${e.key}-${i}`} value={e.key}>{e.label}</option>)}</select></label><p className="review-source">{example.action}</p><p className="hint">Default: first available action in field order. Selection does not rank examples or prove proficiency.</p><button id="review-example-edit" className="text-button" onClick={() => onEdit(example.field, example.label, "review-example-edit")}>Edit this example →</button></> : <p>Choose an example to discuss. Activities, training, and coursework can count.</p>}
      {evidenceNote && <p className="review-source">Optional skill example: {evidenceNote}</p>}
    </section>
    <section aria-labelledby="tasks-heading"><h3 id="tasks-heading">Next review tasks</h3><p className="hint">Order: explicit date conflicts, action and skill context, then contact and readability. Showing up to three; all checks remain available below.</p>
      {tasks.length ? <ol className="review-tasks">{tasks.slice(0, 3).map(taskCard)}</ol> : <p className="all-clear">No common gaps found. A human reviewer should still check wording and relevance.</p>}
      {tasks.length > 3 && <details className="review-more"><summary>See all checks ({tasks.length}; {tasks.length - 3} more)</summary><ol className="review-tasks" start={4}>{tasks.slice(3).map(taskCard)}</ol></details>}
    </section>
    <p className="hint">Skill checks use exact text mentions in supplied facts. A mention is not evidence of competence; uncertainty needs a conversation. Read the full CV alongside this brief.</p>
  </div>;
}
