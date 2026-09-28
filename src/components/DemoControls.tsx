import { demoProfiles } from "@/lib/demo";

export function DemoControls({ enabled, onLoad }: { enabled: boolean; onLoad: (index: number) => void }) {
  if (!enabled) return null;
  return <div className="demo-strip"><div><span className="eyebrow">FOR EVENT TEAMS</span><strong>Need a quick walkthrough?</strong></div><div className="demo-actions">{demoProfiles.map((demo, i) => <button key={demo.label} onClick={() => onLoad(i)}>{demo.label} <span>↗</span></button>)}</div><span className="demo-label">DEMO DATA</span></div>;
}
