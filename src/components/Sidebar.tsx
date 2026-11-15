import {
  Activity, BarChart3, ClipboardPlus, Info, LayoutDashboard, Smile, Users, Waypoints, X,
} from 'lucide-react';
import { CALIBRATION_DAYS } from '../lib/engine';
import type { Level } from '../lib/types';
import { initials } from './CrewTable';

export const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trends', label: 'Health trends', icon: BarChart3 },
  { id: 'emotion', label: 'Emotion check', icon: Smile },
  { id: 'pattern', label: 'Pattern check', icon: Waypoints },
  { id: 'checkin', label: 'Daily check-in', icon: ClipboardPlus },
  { id: 'crew', label: 'Crew comparison', icon: Users },
  { id: 'method', label: 'How it works', icon: Info },
];

interface Props {
  astronauts: string[];
  selected: string;
  onSelect: (n: string) => void;
  day: number;
  maxDay: number;
  onDay: (d: number) => void;
  overall: Record<string, Level>;
  checkins: number;
  open: boolean;
  onClose: () => void;
}

export function Logo() {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" className="logo">
      <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <ellipse cx="20" cy="20" rx="17" ry="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" transform="rotate(-24 20 20)" />
      <polyline points="7,22 14,22 17,15 21,27 24,19 26,22 33,22" fill="none" stroke="#f0a54a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar({ astronauts, selected, onSelect, day, maxDay, onDay, overall, checkins, open, onClose }: Props) {
  const minDay = CALIBRATION_DAYS + 1;
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Mission controls">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand-name">Know Your Normal</div>
          <div className="brand-sub">Crew health · Simulation</div>
        </div>
        <button type="button" className="icon-btn close-btn" onClick={onClose} aria-label="Close controls"><X size={18} /></button>
      </div>

      <div className="side-label">Mission control</div>
      <label className="side-field">
        <span className="side-caption">Crew member</span>
        <select value={selected} onChange={(e) => onSelect(e.target.value)}>
          {astronauts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <ul className="crew-list">
        {astronauts.map((n) => (
          <li key={n}>
            <button type="button" className={`crew-item ${n === selected ? 'active' : ''}`} onClick={() => onSelect(n)} aria-pressed={n === selected}>
              <span className="avatar">{initials(n)}</span>
              <span className="crew-meta">
                <span className="crew-n">{n}</span>
                <span className="crew-s">Simulated crew member</span>
              </span>
              <span className={`status-dot lvl-bg-${overall[n] ?? 0}`} title={['Within normal', 'Watch', 'Act now'][overall[n] ?? 0]} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="side-label">Mission replay</div>
      <div className="replay">
        <div className="replay-day" aria-live="polite">
          <span className="replay-prefix">Day</span>
          <span className="replay-num">{day}</span>
          <span className="replay-of">/ {maxDay}</span>
        </div>
        <input
          type="range" min={minDay} max={maxDay} step={1} value={day}
          onChange={(e) => onDay(Number(e.target.value))}
          aria-label="Mission day to replay"
        />
        <div className="replay-scale"><span>Day {minDay}</span><span>Day {maxDay}</span></div>
        <div className="replay-buttons">
          <button type="button" className="btn btn-side" onClick={() => onDay(Math.max(minDay, day - 1))} disabled={day <= minDay}>− 1 day</button>
          <button type="button" className="btn btn-side" onClick={() => onDay(Math.min(maxDay, day + 1))} disabled={day >= maxDay}>+ 1 day</button>
          <button type="button" className="btn btn-side" onClick={() => onDay(maxDay)} disabled={day >= maxDay}>Latest</button>
        </div>
        <p className="side-help">Replay any day after calibration. Days 1–{CALIBRATION_DAYS} set this crew member's personal baseline.</p>
      </div>

      <nav className="side-nav" aria-label="Sections">
        {NAV.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} onClick={onClose}><Icon size={15} aria-hidden /> {label}</a>
        ))}
      </nav>

      <div className="side-foot">
        <div><Activity size={13} aria-hidden /> Local demo data</div>
        <div className="muted-side">No live connection · {checkins} check-in{checkins === 1 ? '' : 's'} saved in this browser</div>
      </div>
    </aside>
  );
}
