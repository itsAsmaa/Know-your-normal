import { Timer } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { downloadCsv, slug } from '../lib/browser';
import { EMO_GROUP, EMO_GROUPS, EMOTIONS } from '../lib/data';
import { firstFlagDay, fmt } from '../lib/engine';
import type { Analysis } from '../lib/engine';
import type { ChartPalette } from '../theme';
import { dayTicks } from './charts';
import { ChartCard, LegendItem } from './ui';

interface Props { a: Analysis; day: number; palette: ChartPalette }

export function EmotionSection({ a, day, palette }: Props) {
  const name = a.astronaut;
  const emoRows = a.person.filter((r) => r.mission_day <= day && r.emo);
  const emoDay = firstFlagDay(a, 'negative_emotion_pct', day);
  const moodDay = firstFlagDay(a, 'mood', day);

  const grouped = emoRows.map((r) => {
    const g = { day: r.mission_day, Negative: 0, 'Neutral & calm': 0, Positive: 0 };
    for (const e of EMOTIONS) g[EMO_GROUP[e]] += r.emo![e];
    return g;
  });
  const last = emoRows[emoRows.length - 1];
  const mix = last
    ? EMOTIONS.map((e) => ({ emotion: e, share: last.emo![e], group: EMO_GROUP[e] })).sort((x, y) => y.share - x.share)
    : [];
  const lastRow = a.person.filter((r) => r.mission_day <= day).slice(-1)[0];

  let warning: string | null = null;
  if (emoDay && moodDay && emoDay < moodDay) {
    warning = `the emotion check flagged a change on day ${emoDay}, ${moodDay - emoDay} days before ${name}'s self-rated mood did (day ${moodDay}).`;
  } else if (emoDay && !moodDay) {
    warning = `the emotion check flagged a change on day ${emoDay}. ${name}'s self-rated mood hasn't flagged anything yet.`;
  }

  return (
    <>
      {warning ? (
        <div className="callout callout-good" role="status">
          <Timer size={18} aria-hidden />
          <p><strong>Early warning:</strong> {warning}</p>
        </div>
      ) : (
        <p className="muted small">
          No early-warning gap so far: {emoDay ? `the emotion check flagged day ${emoDay}` : 'the emotion check has not flagged a change'}
          {moodDay ? `, self-rated mood flagged day ${moodDay}` : ', and self-rated mood has not flagged a change'} (through day {day}).
        </p>
      )}
      {emoRows.length === 0 ? (
        <p className="muted">No emotion checks recorded yet.</p>
      ) : (
        <div className="emotion-grid">
          <ChartCard
            eyebrow="Grouped daily shares"
            title="Emotion mix over time"
            onCsv={() => downloadCsv(`${slug(name)}-emotion-mix-to-day-${day}.csv`, grouped.map((g) => ({
              astronaut: name, mission_day: g.day,
              negative_share: Number(g.Negative.toFixed(4)),
              neutral_calm_share: Number(g['Neutral & calm'].toFixed(4)),
              positive_share: Number(g.Positive.toFixed(4)),
              synthetic: true,
            })))}
            footer={EMO_GROUPS.map((g) => <LegendItem key={g} swatch={palette.groups[g]} label={g === 'Negative' ? 'Negative (sad, angry, fearful, disgust)' : g === 'Positive' ? 'Positive (happy, surprised)' : 'Neutral & calm'} />)}
          >
            <div className="chart-box" role="img" aria-label={`Share of negative, neutral and positive emotions in ${name}'s daily check-ins up to day ${day}.`}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={grouped} stackOffset="expand" margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="day" type="number" domain={[1, day]} ticks={dayTicks(day)} tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.grid} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.grid} tickLine={false} width={42} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof grouped)[number];
                      return (
                        <div className="tip">
                          <div className="tip-title">Day {p.day}</div>
                          {EMO_GROUPS.map((g) => <div key={g}>{g}: <strong>{Math.round(p[g] * 100)}%</strong></div>)}
                        </div>
                      );
                    }}
                  />
                  {EMO_GROUPS.map((g) => (
                    <Area key={g} dataKey={g} stackId="mix" type="linear" stroke={palette.surface} strokeWidth={1}
                      fill={palette.groups[g]} fillOpacity={0.92} isAnimationActive={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard
            eyebrow="Eight simulated categories"
            title={`Day ${last.mission_day} emotion detail`}
            onCsv={() => downloadCsv(`${slug(name)}-emotions-day-${last.mission_day}.csv`, mix.map((x) => ({
              astronaut: name, mission_day: last.mission_day, emotion: x.emotion, share: x.share, group: x.group, synthetic: true,
            })))}
            footer={(
              <span>
                Negative share {fmt(lastRow.negative_emotion_pct, 'negative_emotion_pct')}%
                {' '}(normal {fmt(a.base.mean.negative_emotion_pct, 'negative_emotion_pct')} ± {fmt(a.base.std.negative_emotion_pct, 'negative_emotion_pct')})
                {last.top_emotions ? <> · top 2: <strong>{last.top_emotions}</strong></> : null}
              </span>
            )}
          >
            <div className="chart-box" role="img" aria-label={`Emotion shares on day ${last.mission_day}: ${mix.map((x) => `${x.emotion} ${Math.round(x.share * 100)}%`).join(', ')}.`}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mix} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={palette.grid} horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.grid} tickLine={false} />
                  <YAxis type="category" dataKey="emotion" width={70} tick={{ fontSize: 12, fill: palette.axis }} stroke={palette.grid} tickLine={false} />
                  <Tooltip cursor={{ fill: palette.calib }} formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Share']} />
                  <Bar dataKey="share" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
                    {mix.map((x) => <Cell key={x.emotion} fill={palette.groups[x.group]} />)}
                    <LabelList dataKey="share" position="right" formatter={(v: number) => `${(v * 100).toFixed(1)}%`} style={{ fontSize: 11, fill: palette.axis }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      )}
      <p className="fine">
        Emotion values in this demo are pre-generated synthetic outputs; no microphone, camera or live emotion analyzer is used.
        The analyzer they stand in for comes from Asmaa's graduation project (Birzeit University, ENCS5300): an SVM + Random Forest
        ensemble on MFCC, chroma and mel-spectrogram features, trained on RAVDESS (83.7% accuracy on 8 emotions).
      </p>
    </>
  );
}
