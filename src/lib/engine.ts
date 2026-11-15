/**
 * Know Your Normal engine - a line-by-line TypeScript port of engine.py.
 * Constants, labels and next-step text are exported from engine.py itself
 * (src/data/engineConstants.ts), so the rules stay identical.
 */
import { ENGINE } from '../data/engineConstants';
import { gaussian, IsolationForest, mulberry32, quantile } from './iforest';
import { pyFixed } from './format';
import type { Level, MetricKey, Row, SystemName } from './types';

export interface Metric {
  key: MetricKey;
  label: string;
  unit: string;
  system: SystemName;
  bad: 'up' | 'down';
  min_std: number;
  agg: 'mean' | 'last';
}

export const CALIBRATION_DAYS: number = ENGINE.CALIBRATION_DAYS;
export const RECENT_DAYS: number = ENGINE.RECENT_DAYS;
export const CAREER_LIMIT_MSV: number = ENGINE.CAREER_LIMIT_MSV;
export const METRICS = ENGINE.METRICS as unknown as Metric[];
export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, Metric>;
export const METRIC_KEYS: MetricKey[] = METRICS.map((m) => m.key);
export const SYSTEMS = ENGINE.SYSTEMS as unknown as SystemName[];
const ACTIONS = ENGINE.ACTIONS as unknown as Record<SystemName, Record<'0' | '1' | '2', string>>;
export const LEVEL_NAME: Record<Level, string> = {
  0: ENGINE.LEVEL_NAME['0'], 1: ENGINE.LEVEL_NAME['1'], 2: ENGINE.LEVEL_NAME['2'],
};

// Pattern-check settings, same as engine.py.
const JITTER_N = 3000;
const JITTER_SD = 0.35;
const N_TREES = 300;
const MAX_SAMPLES = 256;
const THRESHOLD_Q = 0.995;

export interface Baseline {
  mean: Record<MetricKey, number>;
  std: Record<MetricKey, number>;
}

export interface PatternPoint { day: number; score: number; unusual: boolean }

export interface Analysis {
  astronaut: string;
  person: Row[];
  base: Baseline;
  pattern: PatternPoint[];
  threshold: number;
}

export interface MetricResult {
  metric: Metric;
  value: number;
  mean: number;
  std: number;
  z: number;
  level: Level;
}

export interface SystemResult {
  system: SystemName;
  level: Level;
  metrics: MetricResult[];
  action: string;
  extra: { missionTotalMsv?: number; pctCareerLimit?: number };
}

export interface DayResult {
  astronaut: string;
  day: number;
  overall: Level;
  systems: Record<SystemName, SystemResult>;
  unusual: boolean;
  patternScore: number;
  patternThreshold: number;
  drivers: [MetricKey, number][];
  topEmotions: string;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Average and usual spread (sample SD, floored by min_std) over the calibration days. */
export function personalBaseline(person: Row[]): Baseline {
  const cal = person.filter((r) => r.mission_day <= CALIBRATION_DAYS);
  const mean = {} as Record<MetricKey, number>;
  const std = {} as Record<MetricKey, number>;
  for (const m of METRICS) {
    const xs = cal.map((r) => r[m.key]);
    const mu = avg(xs);
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1));
    mean[m.key] = mu;
    std[m.key] = Math.max(sd, m.min_std);
  }
  return { mean, std };
}

export function zscores(row: Row, base: Baseline): number[] {
  return METRIC_KEYS.map((k) => (row[k] - base.mean[k]) / base.std[k]);
}

/** Learn one astronaut's normal and score every day with the pattern model. */
export function analyze(rows: Row[], astronaut: string): Analysis {
  const person = [...rows].sort((a, b) => a.mission_day - b.mission_day);
  if (person.filter((r) => r.mission_day <= CALIBRATION_DAYS).length < CALIBRATION_DAYS) {
    throw new Error(`Need ${CALIBRATION_DAYS} calibration days to learn a normal.`);
  }
  const base = personalBaseline(person);
  const zAll = person.map((r) => zscores(r, base));
  const zCal = zAll.filter((_, i) => person[i].mission_day <= CALIBRATION_DAYS);

  // 30 calibration days is a small sample, so (as in engine.py) the forest is trained
  // on jittered copies of them, and the threshold is the 99.5th percentile of scores
  // on a separate jittered sample of normal days.
  const rng = mulberry32(0);
  const jitter = (n: number) => {
    const picks = Array.from({ length: n }, () => zCal[Math.floor(rng() * zCal.length)]);
    return picks.map((p) => p.map((v) => v + JITTER_SD * gaussian(rng)));
  };
  const model = new IsolationForest(N_TREES, MAX_SAMPLES, 0).fit(jitter(JITTER_N));
  const threshold = quantile(jitter(JITTER_N).map((x) => model.score(x)), THRESHOLD_Q);
  const pattern = person.map((r, i) => {
    const score = model.score(zAll[i]);
    return { day: r.mission_day, score, unusual: score > threshold };
  });
  return { astronaut, person, base, pattern, threshold };
}

function metricLevel(m: Metric, value: number, z: number): Level {
  const concern = m.bad === 'up' ? z : -z;
  if (m.key === 'body_temp_c') {
    if (value >= 38.0) return 2;
    return value >= 37.5 || concern >= 2.5 ? 1 : 0;
  }
  return concern >= 3 ? 2 : concern >= 2 ? 1 : 0;
}

/** Status of every body system on a given mission day (engine.py: evaluate). */
export function evaluate(a: Analysis, day: number): DayResult {
  if (day <= CALIBRATION_DAYS) throw new Error('Pick a day after the calibration period.');
  const upto = a.person.filter((r) => r.mission_day <= day);
  const recent = upto.filter((r) => r.mission_day > day - RECENT_DAYS);
  const today = upto[upto.length - 1];

  const bySystem = Object.fromEntries(SYSTEMS.map((s) => [s, [] as MetricResult[]])) as Record<SystemName, MetricResult[]>;
  for (const m of METRICS) {
    const mean = a.base.mean[m.key];
    const std = a.base.std[m.key];
    const value = m.agg === 'last' ? today[m.key] : avg(recent.map((r) => r[m.key]));
    const z = (value - mean) / std;
    bySystem[m.system].push({ metric: m, value, mean, std, z, level: metricLevel(m, value, z) });
  }

  const systems = {} as Record<SystemName, SystemResult>;
  for (const s of SYSTEMS) {
    const results = bySystem[s];
    let level = Math.max(...results.map((r) => r.level)) as Level;
    // Two or more indicators off in the same system = a pattern -> act now.
    if (results.filter((r) => r.level >= 1).length >= 2) level = 2;
    let extra: SystemResult['extra'] = {};
    if (s === 'Radiation') {
      const rad = results[0];
      const ratioToday = rad.value / rad.mean;
      const ratioRecent = Math.max(...recent.map((r) => r.radiation_msv)) / rad.mean;
      level = ratioToday >= 4 ? 2 : ratioRecent >= 2 ? 1 : 0;
      rad.level = level;
      const total = upto.reduce((t, r) => t + r.radiation_msv, 0);
      extra = { missionTotalMsv: total, pctCareerLimit: (100 * total) / CAREER_LIMIT_MSV };
    }
    systems[s] = { system: s, level, metrics: results, action: ACTIONS[s][String(level) as '0' | '1' | '2'], extra };
  }

  const drivers = METRIC_KEYS
    .map((k) => [k, (today[k] - a.base.mean[k]) / a.base.std[k]] as [MetricKey, number])
    .filter(([, z]) => Math.abs(z) >= 2)
    .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
    .slice(0, 3);
  const p = a.pattern.find((pp) => pp.day === today.mission_day)!;

  return {
    astronaut: a.astronaut,
    day: today.mission_day,
    overall: Math.max(...SYSTEMS.map((s) => systems[s].level)) as Level,
    systems,
    unusual: p.unusual,
    patternScore: p.score,
    patternThreshold: a.threshold,
    drivers,
    topEmotions: today.top_emotions ?? '',
  };
}

/** First day (after calibration, up to `upToDay`) a single reading left its normal range. */
export function firstFlagDay(a: Analysis, key: MetricKey, upToDay: number): number | null {
  const system = METRIC[key].system;
  for (let d = CALIBRATION_DAYS + 1; d <= upToDay; d++) {
    const mr = evaluate(a, d).systems[system].metrics.find((x) => x.metric.key === key)!;
    if (mr.level >= 1) return d;
  }
  return null;
}

/** engine.py: fmt */
export function fmt(value: number, key: MetricKey): string {
  if (key === 'negative_emotion_pct') return pyFixed(value, 0);
  if (key === 'sleep_h' || key === 'body_temp_c' || key === 'mood') return pyFixed(value, 1);
  if (key === 'radiation_msv') return pyFixed(value, 2);
  return pyFixed(value, 0);
}

export const unitSep = (unit: string) => (unit === '%' ? '' : ' ');

/** engine.py: report_text, plus a browser-model note and synthetic-data disclaimer. */
export function reportText(r: DayResult): string {
  const lines = [
    'KNOW YOUR NORMAL - HEALTH STATUS REPORT',
    `Astronaut: ${r.astronaut}    Mission day: ${r.day}`,
    `Overall: ${LEVEL_NAME[r.overall].toUpperCase()}`,
    '',
  ];
  for (const s of SYSTEMS) {
    const sr = r.systems[s];
    lines.push(`${s}: ${LEVEL_NAME[sr.level]}`);
    for (const mr of sr.metrics) {
      const m = mr.metric;
      lines.push(`  - ${m.label}: ${fmt(mr.value, m.key)}${unitSep(m.unit)}${m.unit} `
        + `(your normal ${fmt(mr.mean, m.key)} ± ${fmt(mr.std, m.key)})`);
    }
    if (s === 'Mood' && r.topEmotions) lines.push(`  - Today's emotion check (top 2): ${r.topEmotions}`);
    if (sr.extra.missionTotalMsv !== undefined) {
      lines.push(`  - Mission total: ${pyFixed(sr.extra.missionTotalMsv, 0)} mSv `
        + `(${pyFixed(sr.extra.pctCareerLimit!, 0)}% of NASA's ${CAREER_LIMIT_MSV} mSv career limit)`);
    }
    lines.push(`  Next step: ${sr.action}`);
    lines.push('');
  }
  lines.push('Pattern check (browser Isolation Forest): '
    + (r.unusual ? 'UNUSUAL day for this astronaut' : 'normal pattern')
    + ` (score ${pyFixed(r.patternScore, 2)}, threshold ${pyFixed(r.patternThreshold, 2)})`);
  lines.push('', 'Prototype for NASA Space Apps 2026 - not a medical device.');
  lines.push('Synthetic demo data. Not clinical guidance. Not affiliated with or endorsed by NASA.');
  return lines.join('\n');
}

/** app.py: overall banner text. */
export function overallMessage(name: string, r: DayResult): string {
  const watch = SYSTEMS.filter((s) => r.systems[s].level === 1);
  const act = SYSTEMS.filter((s) => r.systems[s].level === 2);
  if (r.overall === 0) return `${name}, mission day ${r.day}: everything is within your normal.`;
  if (r.overall === 1) return `${name}, mission day ${r.day}: keep an eye on ${watch.join(', ')}.`;
  const extra = watch.length ? ` Keep an eye on ${watch.join(', ')}.` : '';
  return `${name}, mission day ${r.day}: act today on ${act.join(', ')}.${extra}`;
}
