import {
  AlertTriangle, Copy, FileDown, FileText, Menu, Moon, Printer, RotateCcw, Sun, TriangleAlert, Waypoints, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CheckInForm } from './components/CheckInForm';
import { CrewTable } from './components/CrewTable';
import { EmotionSection } from './components/EmotionSection';
import { HowItWorks } from './components/HowItWorks';
import { PatternSection } from './components/PatternSection';
import { Logo, Sidebar } from './components/Sidebar';
import { StatusCards } from './components/StatusCards';
import { TrendCharts } from './components/TrendCharts';
import { SectionHeader } from './components/ui';
import { SKLEARN_REFERENCE } from './data/sklearnReference';
import { DEMO_ROWS } from './demoData';
import {
  clearCheckins, downloadText, isFramed, loadCheckins, loadTheme, saveCheckins, saveTheme, slug,
} from './lib/browser';
import { rowsToCsv } from './lib/data';
import {
  analyze, CALIBRATION_DAYS, evaluate, LEVEL_NAME, METRIC, overallMessage, reportText,
} from './lib/engine';
import type { Analysis } from './lib/engine';
import { pyFixed, pySigned } from './lib/format';
import type { Level, Row } from './lib/types';
import { PALETTE } from './theme';

export default function App() {
  const [checkins, setCheckins] = useState<Row[]>(() => loadCheckins());
  const rows = useMemo(() => [...DEMO_ROWS, ...checkins], [checkins]);
  const astronauts = useMemo(() => [...new Set(rows.map((r) => r.astronaut))].sort(), [rows]);
  const [name, setName] = useState(() => astronauts[0]);
  const analyses = useMemo(() => {
    const out: Record<string, Analysis> = {};
    for (const n of astronauts) out[n] = analyze(rows.filter((r) => r.astronaut === n), n);
    return out;
  }, [rows, astronauts]);

  const a = analyses[name];
  const maxDay = a.person[a.person.length - 1].mission_day;
  const [dayState, setDay] = useState<number>(maxDay);
  const day = Math.min(Math.max(dayState, CALIBRATION_DAYS + 1), maxDay);
  const r = useMemo(() => evaluate(a, day), [a, day]);

  const crew = useMemo(() => astronauts.map((n) => {
    const an = analyses[n];
    return evaluate(an, Math.min(day, an.person[an.person.length - 1].mission_day));
  }), [analyses, astronauts, day]);
  const overallByName = Object.fromEntries(crew.map((c) => [c.astronaut, c.overall])) as Record<string, Level>;

  const crewAgreement = useMemo(() => {
    let match = 0;
    let total = 0;
    for (const n of astronauts) {
      const ref = SKLEARN_REFERENCE[n];
      if (!ref) continue;
      const demoDays = new Set(analyses[n].person.filter((x) => x.source === 'demo').map((x) => x.mission_day));
      for (const p of analyses[n].pattern) {
        const sk = ref.scores[String(p.day)];
        if (!sk || !demoDays.has(p.day)) continue;
        total += 1;
        if (sk[1] === p.unusual) match += 1;
      }
    }
    return { match, total };
  }, [analyses, astronauts]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);
  const palette = PALETTE[theme];

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const [exportDialog, setExportDialog] = useState<{ filename: string; text: string } | null>(null);
  useEffect(() => {
    const onToast = (e: Event) => setToast((e as CustomEvent<string>).detail);
    const onFallback = (e: Event) => setExportDialog((e as CustomEvent<{ filename: string; text: string }>).detail);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setExportDialog(null); setMenuOpen(false); } };
    window.addEventListener('kyn:toast', onToast);
    window.addEventListener('kyn:export-fallback', onFallback);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('kyn:toast', onToast);
      window.removeEventListener('kyn:export-fallback', onFallback);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  const copyExport = async () => {
    if (!exportDialog) return;
    try {
      await navigator.clipboard.writeText(exportDialog.text);
      setToast(`Copied ${exportDialog.filename} to the clipboard.`);
    } catch {
      setToast('Copy was blocked here. Select the text and copy it instead.');
    }
  };

  const selectAstronaut = (n: string) => { setName(n); setMenuOpen(false); };

  const saveCheckin = (row: Row) => {
    const next = [...checkins, row];
    const ok = saveCheckins(next);
    setCheckins(next);
    setDay(row.mission_day);
    setToast(ok
      ? `Simulated check-in saved for ${row.astronaut}, mission day ${row.mission_day}. Stored in this browser only.`
      : `Check-in added for this session, but this browser blocked local storage, so it won't be kept after a reload.`);
  };

  const resetDemo = () => {
    clearCheckins();
    setCheckins([]);
    setDay(90);
    setConfirmReset(false);
    setToast(`Demo data restored: the ${DEMO_ROWS.length} supplied records, no saved check-ins.`);
  };

  const downloadReport = () => { void downloadText(`flight-surgeon-report_${slug(name)}_day-${r.day}.txt`, reportText(r)); };
  const exportAll = () => { void downloadText('know-your-normal_all-records.csv', rowsToCsv(rows), 'text/csv'); };

  const drivers = r.drivers.map(([k, z]) => `${METRIC[k].label.toLowerCase()} (${pySigned(z, 1)} SD)`).join(', ');
  const nameChecks = checkins.filter((c) => c.astronaut === name).length;

  return (
    <div className="app">
      <Sidebar
        astronauts={astronauts} selected={name} onSelect={selectAstronaut}
        day={day} maxDay={maxDay} onDay={setDay} overall={overallByName}
        checkins={checkins.length} open={menuOpen} onClose={() => setMenuOpen(false)}
      />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open mission controls">
            <Menu size={20} />
          </button>
          <div className="topbar-brand"><Logo /><span>Know Your Normal</span></div>
          <nav className="crumbs" aria-label="Location">
            <span>Simulated mission</span><span aria-hidden="true">/</span><span className="crumb-strong">Crew health monitor</span>
          </nav>
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={downloadReport} title="Download flight-surgeon text report">
              <FileText size={15} aria-hidden /><span className="btn-label">Report</span>
            </button>
            {!isFramed && (
              <button type="button" className="btn btn-ghost" onClick={() => window.print()} title="Print or save as PDF">
                <Printer size={15} aria-hidden /><span className="btn-label">Print / PDF</span>
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-pressed={theme === 'dark'} title="Toggle dark mode">
              {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
              <span className="btn-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            {confirmReset ? (
              <span className="confirm">
                <button type="button" className="btn btn-danger" onClick={resetDemo}>Confirm reset</button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
              </span>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)} title="Remove saved check-ins and restore the supplied data">
                <RotateCcw size={15} aria-hidden /><span className="btn-label">Reset demo data</span>
              </button>
            )}
          </div>
        </header>

        <div className="mobile-controls" aria-label="Quick controls">
          <select value={name} onChange={(e) => selectAstronaut(e.target.value)} aria-label="Crew member">
            {astronauts.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <div className="mobile-day">
            <span>Day <strong>{day}</strong></span>
            <input type="range" min={CALIBRATION_DAYS + 1} max={maxDay} value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Mission day to replay" />
          </div>
        </div>

        <main className="content">
          <div className="print-only print-head">
            Know Your Normal · {name} · mission day {r.day} · synthetic demo data · prototype, not clinical guidance
          </div>
          <div className="meta-row">
            <span><span className="pulse" aria-hidden="true" />90-day crew simulation · {DEMO_ROWS.length} supplied daily records{checkins.length ? ` + ${checkins.length} local check-in${checkins.length === 1 ? '' : 's'}` : ''}</span>
            <span>Prototype / synthetic data</span>
          </div>

          <section className="hero" id="overview" aria-labelledby="hero-title">
            <div>
              <div className="kicker">Personal baseline monitoring <span className="tag">Day {String(r.day).padStart(3, '0')}</span></div>
              <h1 id="hero-title">Know your <em>normal.</em></h1>
              <p className="lede">
                Daily readings for <strong>{name}</strong>, compared with their own first {CALIBRATION_DAYS} mission days, not with an average person.
                {nameChecks > 0 && <> Includes {nameChecks} simulated check-in{nameChecks === 1 ? '' : 's'} saved in this browser.</>}
              </p>
            </div>
            <aside className={`overall-card edge-${r.overall}`} aria-live="polite">
              <div className="eyebrow">Overall status</div>
              <div className={`overall-level lvl-text-${r.overall}`}>{LEVEL_NAME[r.overall]}</div>
              <p>{overallMessage(name, r)}</p>
              <div className="overall-foot"><span>Mission day {r.day} of {maxDay} · replay</span><span>{CALIBRATION_DAYS}-day baseline</span></div>
            </aside>
          </section>

          <div className="callout callout-warn disclaimer" role="note">
            <AlertTriangle size={18} aria-hidden />
            <p>
              <strong>Simulation only.</strong> All readings are synthetic and for demonstration. This prototype is not a medical device and
              its results are not clinical guidance. It is not affiliated with or endorsed by NASA, and nothing here is live telemetry.
            </p>
          </div>

          <section className="section" aria-labelledby="status-title">
            <SectionHeader index={1} id="status-title" title="System status" note="Values are 3-day averages; temperature and radiation use today's reading" />
            <StatusCards r={r} />
            <div className={`callout ${r.unusual ? 'callout-warn' : 'callout-neutral'} pattern-callout`}>
              {r.unusual ? <TriangleAlert size={18} aria-hidden /> : <Waypoints size={18} aria-hidden />}
              <p>
                <strong>Pattern check:</strong>{' '}
                {r.unusual
                  ? <>today's combination of readings is unusual for {name}.{drivers && <> Most different from normal: {drivers}.</>}</>
                  : <>today's combination of readings looks normal for {name}.</>}
              </p>
              <div className="score-pill" title="Browser Isolation Forest score / threshold">
                <span className="score-num">{pyFixed(r.patternScore, 3)}</span>
                <span className="score-sub">threshold {pyFixed(r.patternThreshold, 3)}</span>
              </div>
            </div>
          </section>

          <section className="section" aria-labelledby="trends">
            <SectionHeader index={2} id="trends" title="Health trends" note="Each reading against this person's own range · CSV on every chart" />
            <TrendCharts a={a} day={day} palette={palette} />
          </section>

          <section className="section" aria-labelledby="emotion">
            <SectionHeader index={3} id="emotion" title="Emotion check" note="Synthetic daily emotion-analyzer output" />
            <EmotionSection a={a} day={day} palette={palette} />
          </section>

          <section className="section" aria-labelledby="pattern">
            <SectionHeader index={4} id="pattern" title="Pattern check" note="Combined deviation from the personal baseline" />
            <PatternSection a={a} day={day} palette={palette} crewAgreement={crewAgreement} />
          </section>

          <section className="section no-print" aria-labelledby="checkin">
            <SectionHeader index={5} id="checkin" title="Daily check-in" note="New entries are stored only in this browser" />
            <CheckInForm key={`${name}-${maxDay}`} a={a} newDay={maxDay + 1} onSave={saveCheckin} />
          </section>

          <section className="section" aria-labelledby="crew">
            <SectionHeader index={6} id="crew" title="Crew comparison" note={`Each person against their own baseline · day ${day}`} />
            <CrewTable results={crew} selected={name} onSelect={selectAstronaut} day={day} />
          </section>

          <section className="section" aria-labelledby="method">
            <SectionHeader index={7} id="method" title="How the monitor works" note="Method notes and limits" />
            <HowItWorks records={DEMO_ROWS.length} checkins={checkins.length} />
          </section>

          <footer className="footer">
            <div className="footer-brand">
              <Logo />
              <span><strong>Know Your Normal</strong> · crew health monitor · simulation · prototype · Team Palestine Sunbirds
                {isFramed && <> · Print / save as PDF works when the app runs on its own page.</>}</span>
            </div>
            <div className="footer-actions no-print">
              <button type="button" className="btn btn-ghost" onClick={exportAll}><FileDown size={15} aria-hidden /> All records (CSV)</button>
              <button type="button" className="btn btn-primary" onClick={downloadReport}><FileText size={15} aria-hidden /> Flight-surgeon text report</button>
            </div>
          </footer>
        </main>
      </div>

      {exportDialog && (
        <div className="modal-scrim" onClick={() => setExportDialog(null)}>
          <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 id="export-title">{exportDialog.filename}</h3>
              <button type="button" className="icon-btn" onClick={() => setExportDialog(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <p className="muted small">File downloads aren't available in this view. Copy the contents and paste them into a file instead.</p>
            <textarea readOnly value={exportDialog.text} rows={14} aria-label={`Contents of ${exportDialog.filename}`} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setExportDialog(null)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={copyExport}><Copy size={15} aria-hidden /> Copy</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
