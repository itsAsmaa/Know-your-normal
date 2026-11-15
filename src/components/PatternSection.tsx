import {
  CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { SKLEARN_REFERENCE } from '../data/sklearnReference';
import { downloadCsv, slug } from '../lib/browser';
import { CALIBRATION_DAYS, METRICS } from '../lib/engine';
import type { Analysis } from '../lib/engine';
import { pyFixed } from '../lib/format';
import type { ChartPalette } from '../theme';
import { dayTicks, niceDomain } from './charts';
import { ChartCard, LegendItem } from './ui';

interface Props { a: Analysis; day: number; palette: ChartPalette; crewAgreement: { match: number; total: number } }

export function PatternSection({ a, day, palette, crewAgreement }: Props) {
  const name = a.astronaut;
  const ref = SKLEARN_REFERENCE[name];
  const demoDays = new Set(a.person.filter((r) => r.source === 'demo').map((r) => r.mission_day));
  const data = a.pattern.filter((p) => p.day <= day).map((p) => {
    const sk = demoDays.has(p.day) ? ref?.scores[String(p.day)] : undefined;
    return { day: p.day, score: p.score, unusual: p.unusual, sk: sk ? sk[0] : null, skUnusual: sk ? sk[1] : null };
  });
  const flagged = data.filter((d) => d.unusual && d.day > CALIBRATION_DAYS).map((d) => d.day);
  const comparable = a.pattern.filter((p) => demoDays.has(p.day) && ref?.scores[String(p.day)]);
  const agree = comparable.filter((p) => ref.scores[String(p.day)][1] === p.unusual).length;
  const all = data.flatMap((d) => (d.sk === null ? [d.score] : [d.score, d.sk])).concat(a.threshold);
  const { domain, ticks } = niceDomain(Math.min(...all) - 0.01, Math.max(...all) + 0.01);

  return (
    <>
      <p className="lede">
        An Isolation Forest learns how {name}'s {METRICS.length} readings usually fit together during the calibration days. It
        scores every day by how unusual the whole combination looks, so it can catch a problem even when no single number crosses
        a line. Days above the dashed line are flagged.
      </p>
      <ChartCard
        eyebrow={`${METRICS.length} readings · daily pattern model`}
        title="Isolation Forest unusualness score"
        onCsv={() => downloadCsv(`${slug(name)}-pattern-scores-to-day-${day}.csv`, data.map((d) => ({
          astronaut: name, mission_day: d.day,
          browser_score: Number(d.score.toFixed(6)), browser_threshold: Number(a.threshold.toFixed(6)), browser_unusual: d.unusual,
          sklearn_reference_score: d.sk, sklearn_reference_unusual: d.skUnusual, synthetic: true,
        })))}
        footer={(
          <>
            <LegendItem swatch={palette.series} label="Browser model score" kind="line" />
            <LegendItem swatch={palette.flag} label="Unusual day" kind="dot" />
            <LegendItem swatch={palette.threshold} label={`Threshold ${pyFixed(a.threshold, 3)} (99.5th percentile of jittered normal days)`} kind="dash" />
            {ref && <LegendItem swatch={palette.reference} label="scikit-learn reference (supplied days)" kind="dash" />}
          </>
        )}
      >
        <div className="chart-box" role="img" aria-label={`Unusualness score by mission day for ${name}. Unusual days after calibration: ${flagged.join(', ') || 'none'}.`}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="day" type="number" domain={[1, day]} ticks={dayTicks(day)} tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.grid} tickLine={false} />
              <YAxis domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(2)} tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.grid} tickLine={false} width={44} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof data)[number];
                  return (
                    <div className="tip">
                      <div className="tip-title">Day {p.day}{p.unusual ? ' · unusual' : ''}</div>
                      <div>Browser score <strong>{p.score.toFixed(3)}</strong></div>
                      {p.sk !== null && <div className="muted">scikit-learn {p.sk.toFixed(3)}{p.skUnusual ? ' (flagged)' : ''}</div>}
                    </div>
                  );
                }}
              />
              <ReferenceLine y={a.threshold} stroke={palette.threshold} strokeDasharray="6 4" ifOverflow="extendDomain" />
              {ref && (
                <Line dataKey="sk" stroke={palette.reference} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls={false} />
              )}
              <Line
                dataKey="score" stroke={palette.series} strokeWidth={2} isAnimationActive={false}
                activeDot={{ r: 4 }}
                dot={(props: { cx?: number; cy?: number; index?: number; payload?: { unusual: boolean } }) => (
                  props.payload?.unusual && props.cx !== undefined && props.cy !== undefined
                    ? <circle key={`u-${props.index}`} cx={props.cx} cy={props.cy} r={4.5} fill={palette.flag} stroke={palette.surface} strokeWidth={1.5} />
                    : <g key={`n-${props.index}`} />
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <p className="small">
        Unusual days so far: <strong>{flagged.length ? flagged.join(', ') : 'none'}</strong>
      </p>
      <div className="callout callout-info">
        <p>
          <strong>Browser model, not scikit-learn.</strong> This page runs its own deterministic Isolation Forest written in
          TypeScript, set up like engine.py: 300 trees, 256-sample subsets, trained on 3,000 jittered copies of the astronaut's
          first {CALIBRATION_DAYS} days, threshold at the 99.5th percentile of a separate jittered sample. Its random draws differ
          from scikit-learn, so scores differ slightly. On the supplied data, its flags agree with the scikit-learn reference on{' '}
          <strong>{agree} of {comparable.length}</strong> days for {name} and <strong>{crewAgreement.match} of {crewAgreement.total}</strong> crew-days overall.
          The pattern check is a demo signal only, not a diagnosis.
        </p>
      </div>
    </>
  );
}
