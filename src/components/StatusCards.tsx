import { BedDouble, Bone, Brain, HeartPulse, Radiation, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CAREER_LIMIT_MSV, fmt, SYSTEMS, unitSep } from '../lib/engine';
import type { DayResult } from '../lib/engine';
import { pyFixed } from '../lib/format';
import type { SystemName } from '../lib/types';
import { StatusChip } from './ui';

export const SYSTEM_ICONS: Record<SystemName, LucideIcon> = {
  Heart: HeartPulse,
  'Bone & muscle': Bone,
  Sleep: BedDouble,
  Mood: Brain,
  Immune: ShieldCheck,
  Radiation,
};

export function StatusCards({ r }: { r: DayResult }) {
  return (
    <div className="status-grid">
      {SYSTEMS.map((s) => {
        const sr = r.systems[s];
        const Icon = SYSTEM_ICONS[s];
        return (
          <article key={s} className={`card status-card edge-${sr.level}`} aria-label={`${s}: ${['within your normal', 'watch', 'act now'][sr.level]}`}>
            <header className="status-head">
              <span className="status-title"><Icon size={16} aria-hidden /> {s}</span>
              <StatusChip level={sr.level} />
            </header>
            <dl className="readings">
              {sr.metrics.map((mr) => {
                const m = mr.metric;
                const dir = mr.z >= 2 ? 'up' : mr.z <= -2 ? 'down' : '';
                return (
                  <div key={m.key} className="reading">
                    <dt>
                      {m.label}
                      <span className="normal">Your normal {fmt(mr.mean, m.key)} ± {fmt(mr.std, m.key)}</span>
                    </dt>
                    <dd>
                      <span className={`value ${mr.level ? `lvl-text-${mr.level}` : ''}`}>{fmt(mr.value, m.key)}</span>
                      <span className="unit">{unitSep(m.unit)}{m.unit}</span>
                      {dir && (
                        <span className="arrow" aria-label={dir === 'up' ? 'above your normal' : 'below your normal'}>
                          {dir === 'up' ? '▲' : '▼'}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {s === 'Mood' && r.topEmotions && (
              <p className="aside">Today's emotion check: <strong>{r.topEmotions}</strong></p>
            )}
            {sr.extra.missionTotalMsv !== undefined && (
              <p className="aside">
                Mission total: <strong>{pyFixed(sr.extra.missionTotalMsv, 0)} mSv</strong>
                <span className="muted"> · {pyFixed(sr.extra.pctCareerLimit!, 0)}% of NASA's {CAREER_LIMIT_MSV} mSv career limit (reference only)</span>
              </p>
            )}
            <div className="next-step">
              <span className="eyebrow">Next step</span>
              <p>{sr.action}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
