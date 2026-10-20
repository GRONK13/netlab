import { LABS } from '@netlab/labs';
import { ArrowRight, Check, Timer } from 'lucide-react';
import type { Me } from '../api.ts';
import { DeviceGlyph } from '../components/DeviceIcon.tsx';
import { LedMeter } from '../components/LevelCard.tsx';

const pad = (n: number) => String(n).padStart(2, '0');

export function Dashboard({ me }: { me: Me }) {
  const done = new Map(me.completions.map((c) => [c.labId, c]));
  const next = LABS.find((l) => !done.has(l.id));
  const first = me.user.displayName.split(/\s+/)[0];
  const lv = me.level;

  return (
    <div className="page">
      <header className="page-head">
        <p className="label-caps">Workbench</p>
        <h1>Hello, {first}.</h1>
      </header>

      <section className="status-panel" aria-label="Your progress">
        <div className="stat">
          <span className="label-caps">Level</span>
          <span className="stat-big mono">{pad(lv.level)}</span>
          <span className="stat-sub">{lv.rank}</span>
        </div>
        <div className="stat grow">
          <span className="label-caps">{lv.next === null ? 'Max level reached' : `Progress to level ${lv.level + 1}`}</span>
          <LedMeter lit={Math.round(lv.progress * 20)} total={20} label="Level progress" />
          <span className="stat-sub mono">
            {lv.xp} / {lv.next ?? lv.xp} XP
          </span>
        </div>
        <div className="stat">
          <span className="label-caps">Labs done</span>
          <span className="stat-big mono">
            {pad(done.size)}
            <small>/{pad(LABS.length)}</small>
          </span>
          <span className="stat-sub">{LABS.length - done.size} to go</span>
        </div>
      </section>

      {next && (
        <a href={`#/lab/${next.id}`} className="next-up">
          <div>
            <span className="label-caps accent">{done.size === 0 ? 'Start here' : 'Up next'}</span>
            <h2>{next.title}</h2>
            <p className="muted">{next.summary}</p>
          </div>
          <span className="btn accent">
            {done.size === 0 ? 'Start lab' : 'Continue'} <ArrowRight size={16} />
          </span>
        </a>
      )}

      <section>
        <div className="section-head">
          <h2>Labs</h2>
          <span className="mono muted small">
            {done.size}/{LABS.length} complete
          </span>
        </div>
        <ol className="lab-table">
          {LABS.map((lab, i) => {
            const c = done.get(lab.id);
            return (
              <li key={lab.id}>
                <a href={`#/lab/${lab.id}`} className={`lab-line${c ? ' done' : ''}`}>
                  <span className="lab-idx mono">{pad(i + 1)}</span>
                  <span className="lab-name">
                    <strong>{lab.title}</strong>
                    <span className="muted">{lab.summary}</span>
                  </span>
                  <span className="lab-domain">{lab.ccnaDomain}</span>
                  <span className={`tag ${lab.difficulty.toLowerCase()}`}>{lab.difficulty}</span>
                  <span className="lab-xp mono">{c ? `+${c.xpAwarded}` : lab.xp} XP</span>
                  <span className="lab-state">
                    {c ? (
                      <span className="done-mark">
                        <Check size={14} strokeWidth={3} /> Done
                      </span>
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <a href="#/trainer" className="sandbox-line">
        <span className="line-icon" aria-hidden="true">
          <Timer size={26} />
        </span>
        <span>
          <strong>Subnetting trainer</strong>
          <span className="muted">
            {me.moduleSteps.some((s) => s.step === 'trainer')
              ? 'Target hit. Keep drilling to beat your personal best.'
              : 'Ten timed problems. Get 8 right within 5 minutes to earn 50 XP.'}
          </span>
        </span>
        <ArrowRight size={18} />
      </a>

      <a href="#/sandbox" className="sandbox-line">
        <span className="sandbox-icons" aria-hidden="true">
          <DeviceGlyph kind="router" size={36} />
          <DeviceGlyph kind="switch" size={36} />
          <DeviceGlyph kind="server" size={36} />
        </span>
        <span>
          <strong>Sandbox</strong>
          <span className="muted">Build any network you like with routers, switches, hubs, PCs, laptops, servers and printers. No grading.</span>
        </span>
        <ArrowRight size={18} />
      </a>
    </div>
  );
}
