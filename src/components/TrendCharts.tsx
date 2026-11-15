import {
  CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { downloadCsv, slug } from '../lib/browser';
import { CALIBRATION_DAYS, fmt, METRICS, unitSep } from '../lib/engine';
import type { Analysis, Metric } from '../lib/engine';
import type { ChartPalette } from '../theme';
import { dayTicks, niceDomain, tickFmt } from './charts';
import { ChartCard, LegendItem } from './ui';

interface Props { a: Analysis; day: number; palette: ChartPalette }

export function TrendCharts({ a, day, palette }: Props) {
  return (
    <div className="chart-grid">
      {METRICS.map((m) => <TrendChart key={m.key} a={a} m={m} day={day} palette={palette} />)}
    </div>
  );
}

function TrendChart({ a, m, day, palette }: Props & { m: Metric }) {
  const mean = a.base.mean[m.key];
  const std = a.base.std[m.key];
  const lo = mean - 2 * std;
  const hi = mean + 2 * std;
  const data = a.person.filter((r) => r.mission_day <= day).map((r) => ({ day: r.mission_day, value: r[m.key] }));
  const values = data.map((d) => d.value);
  const span = Math.max(...values, hi) - Math.min(...values, lo);
  const { domain, ticks } = niceDomain(Math.min(...values, lo) - span * 0.04, Math.max(...values, hi) + span * 0.04);
  const today = data[data.length - 1];
  const unit = `${unitSep(m.unit)}${m.unit}`;

  const exportCsv = () => downloadCsv(`${slug(a.astronaut)}-${m.key}-to-day-${day}.csv`, data.map((d) => ({
    astronaut: a.astronaut,
    mission_day: d.day,
    [m.key]: d.value,
    personal_normal_mean: Number(mean.toFixed(4)),
    personal_normal_low_2sd: Number(lo.toFixed(4)),
    personal_normal_high_2sd: Number(hi.toFixed(4)),
    calibration_day: d.day <= CALIBRATION_DAYS,
    synthetic: true,
  })));

  return (
    <ChartCard
      eyebrow={`${m.system} · ${m.unit}`}
      title={m.label}
      onCsv={exportCsv}
      footer={(
        <>
          <LegendItem swatch={palette.calib} label={`Calibration days 1–${CALIBRATION_DAYS}`} />
          <LegendItem swatch={palette.band} label={`Personal normal ±2 SD (${fmt(lo, m.key)}–${fmt(hi, m.key)})`} />
          <LegendItem swatch={palette.today} label={`Day ${today.day}: ${fmt(today.value, m.key)}${unit}`} kind="dot" />
        </>
      )}
    >
      <div className="chart-box" role="img"
        aria-label={`${m.label} for ${a.astronaut} by mission day. Personal normal range ${fmt(lo, m.key)} to ${fmt(hi, m.key)}${unit}. Day ${today.day}: ${fmt(today.value, m.key)}${unit}.`}>
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={palette.grid} vertical={false} />
            <ReferenceArea x1={1} x2={Math.min(CALIBRATION_DAYS, day)} fill={palette.calib} fillOpacity={1} ifOverflow="hidden" />
            <ReferenceArea y1={lo} y2={hi} fill={palette.band} fillOpacity={1} stroke={palette.bandEdge} strokeDasharray="3 3" ifOverflow="hidden" />
            <XAxis dataKey="day" type="number" domain={[1, day]} ticks={dayTicks(day)} tick={{ fontSize: 11, fill: palette.axis }}
              stroke={palette.grid} tickLine={false} />
            <YAxis domain={domain} ticks={ticks} tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.grid}
              tickLine={false} width={42} tickFormatter={tickFmt} />
            <Tooltip
              cursor={{ stroke: palette.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { day: number; value: number };
                return (
                  <div className="tip">
                    <div className="tip-title">Day {p.day}{p.day <= CALIBRATION_DAYS ? ' · calibration' : ''}</div>
                    <div><strong>{fmt(p.value, m.key)}{unit}</strong></div>
                    <div className="muted">Normal {fmt(lo, m.key)}–{fmt(hi, m.key)}{unit}</div>
                  </div>
                );
              }}
            />
            <Line dataKey="value" type="linear" stroke={palette.series} strokeWidth={2} dot={false}
              activeDot={{ r: 4, stroke: palette.surface, strokeWidth: 2 }} isAnimationActive={false} />
            <ReferenceDot x={today.day} y={today.value} r={5} fill={palette.today} stroke={palette.surface} strokeWidth={2} ifOverflow="visible" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
