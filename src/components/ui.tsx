import { Download } from 'lucide-react';
import type { ReactNode } from 'react';
import { LEVEL_NAME } from '../lib/engine';
import type { Level } from '../lib/types';

export function SectionHeader({ index, id, title, note }: { index: number; id: string; title: string; note?: string }) {
  return (
    <div className="section-head">
      <span className="section-index">{String(index).padStart(2, '0')}</span>
      <h2 id={id}>{title}</h2>
      {note && <span className="section-note">{note}</span>}
    </div>
  );
}

export function StatusChip({ level, compact = false }: { level: Level; compact?: boolean }) {
  return (
    <span className={`chip lvl-${level}`}>
      <span className="chip-dot" aria-hidden="true" />
      {compact ? ['Normal', 'Watch', 'Act now'][level] : LEVEL_NAME[level]}
    </span>
  );
}

export function CsvButton({ onClick, label = 'CSV' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-xs no-print" onClick={onClick} aria-label={`Download ${label} data as CSV`}>
      <Download size={13} aria-hidden="true" /> CSV
    </button>
  );
}

export function ChartCard({ eyebrow, title, onCsv, csvLabel, children, footer, className = '' }: {
  eyebrow: string; title: string; onCsv?: () => void; csvLabel?: string; children: ReactNode; footer?: ReactNode; className?: string;
}) {
  return (
    <figure className={`card chart-card ${className}`}>
      <div className="chart-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <figcaption className="chart-title">{title}</figcaption>
        </div>
        {onCsv && <CsvButton onClick={onCsv} label={csvLabel ?? title} />}
      </div>
      {children}
      {footer && <div className="chart-foot">{footer}</div>}
    </figure>
  );
}

export function LegendItem({ swatch, label, kind = 'box' }: { swatch: string; label: string; kind?: 'box' | 'line' | 'dot' | 'dash' }) {
  return (
    <span className="legend-item">
      <span className={`legend-swatch ${kind}`} style={kind === 'line' || kind === 'dash' ? { borderColor: swatch } : { background: swatch }} />
      {label}
    </span>
  );
}
