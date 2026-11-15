/**
 * Parity and scenario checks: TypeScript engine vs. the Python engine (engine.py).
 * Run: npm run verify
 */
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/lib/data';
import { analyze, CALIBRATION_DAYS, evaluate, firstFlagDay, reportText, SYSTEMS } from '../src/lib/engine';
import type { Analysis } from '../src/lib/engine';

const ref = JSON.parse(readFileSync(new URL('./python_reference.json', import.meta.url), 'utf8'));
const rows = parseCsv(readFileSync(new URL('../src/data/crew_daily.csv', import.meta.url), 'utf8'));

let failures = 0;
let checks = 0;
const check = (ok: boolean, msg: string) => {
  checks++;
  if (!ok) { failures++; console.log('  FAIL', msg); }
};
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

console.log(`Records loaded: ${rows.length}`);
check(rows.length === 270, 'expected 270 supplied records');

const names = [...new Set(rows.map((r) => r.astronaut))].sort();
const analyses: Record<string, Analysis> = {};
let statusDays = 0, statusMatch = 0, reportMatch = 0, flagMatch = 0, flagDays = 0;
const stripModelLines = (t: string) => t.split('\n')
  .filter((l) => !l.startsWith('Pattern check') && !l.startsWith('Synthetic demo data'))
  .join('\n').trimEnd();

for (const name of names) {
  const a = analyze(rows.filter((r) => r.astronaut === name), name);
  analyses[name] = a;
  const R = ref[name];
  for (const [k, [mean, std]] of Object.entries(R.baseline) as [string, [number, number]][]) {
    check(close((a.base.mean as any)[k], mean) && close((a.base.std as any)[k], std), `${name} baseline ${k}`);
  }
  for (let d = CALIBRATION_DAYS + 1; d <= 90; d++) {
    const r = evaluate(a, d);
    const rd = R.days[String(d)];
    statusDays++;
    const sameSystems = SYSTEMS.every((s) => r.systems[s].level === rd.systems[s]);
    const sameMetrics = SYSTEMS.every((s) => r.systems[s].metrics.every((mr) => {
      const [v, , , z, lvl] = rd.metrics[mr.metric.key];
      return close(mr.value, v) && close(mr.z, z) && mr.level === lvl;
    }));
    const sameDrivers = JSON.stringify(r.drivers.map(([k]) => k)) === JSON.stringify(rd.drivers.map((x: [string, number]) => x[0]));
    if (r.overall === rd.overall && sameSystems && sameMetrics && sameDrivers) statusMatch++;
    else console.log(`  status mismatch ${name} day ${d}`);
    if (stripModelLines(reportText(r)) === stripModelLines(rd.report)) reportMatch++;
    else console.log(`  report mismatch ${name} day ${d}`);
  }
  for (const p of a.pattern) {
    const refDay = R.days[String(p.day)];
    const skUnusual = refDay ? refDay.unusual : undefined;
    if (skUnusual !== undefined) { flagDays++; if (skUnusual === p.unusual) flagMatch++; }
  }
  check(firstFlagDay(a, 'negative_emotion_pct', 90) === R.first_flag_emotion, `${name} first emotion flag`);
  check(firstFlagDay(a, 'mood', 90) === R.first_flag_mood, `${name} first mood flag`);
}
check(statusMatch === statusDays, 'all statuses match Python');
check(reportMatch === statusDays, 'all report texts match Python');
console.log(`Rule statuses, values, z-scores and drivers identical to Python: ${statusMatch}/${statusDays} astronaut-days`);
console.log(`Flight-surgeon report text identical to Python (excluding model line): ${reportMatch}/${statusDays}`);
console.log(`Isolation Forest flag agreement with scikit-learn (days 31-90): ${flagMatch}/${flagDays}`);

// ---- Planted scenarios -------------------------------------------------------
const lvl = (name: string, day: number, s: (typeof SYSTEMS)[number]) => evaluate(analyses[name], day).systems[s].level;
console.log('\nScenarios');
const L = 'Cmdr. Lina', K = 'Eng. Karim', M = 'Spec. Maya';

// Lina: heart drift from day 70
const linaHeart = Array.from({ length: 60 }, (_, i) => lvl(L, 31 + i, 'Heart'));
const linaFirst = 31 + linaHeart.findIndex((x) => x > 0);
check(linaHeart.slice(0, 39).every((x) => x === 0), 'Lina heart green through day 69');
check(lvl(L, 90, 'Heart') === 2, 'Lina heart act now on day 90');
const l90 = evaluate(analyses[L], 90).systems.Heart.metrics;
console.log(`  Lina: heart first leaves normal on day ${linaFirst}; day 90 = Act now `
  + `(resting HR ${l90[0].value.toFixed(0)} vs normal ${l90[0].mean.toFixed(0)}, HRV ${l90[1].value.toFixed(0)} vs ${l90[1].mean.toFixed(0)})`);

// Karim: isolation stress + exercise
check(lvl(K, 54, 'Mood') === 0 && lvl(K, 54, 'Sleep') === 0, 'Karim normal on day 54');
check(lvl(K, 90, 'Mood') === 2 && lvl(K, 90, 'Sleep') === 2 && lvl(K, 90, 'Bone & muscle') === 2, 'Karim mood/sleep/bone act now day 90');
check(lvl(K, 80, 'Bone & muscle') === 0 && lvl(K, 83, 'Bone & muscle') === 2, 'Karim exercise drop flagged by day 83');
const ke = firstFlagDay(analyses[K], 'negative_emotion_pct', 90), km = firstFlagDay(analyses[K], 'mood', 90);
check(ke === 61 && km === 64, 'Karim early warning: emotion day 61, mood day 64');
console.log(`  Karim: emotion check flags day ${ke}, self-rated mood day ${km}; day 90 Mood/Sleep/Bone & muscle = Act now`);

// Maya: late fever
check(lvl(M, 87, 'Immune') === 0, 'Maya immune normal day 87');
check(lvl(M, 88, 'Immune') === 1 && lvl(M, 89, 'Immune') === 2 && lvl(M, 90, 'Immune') === 2, 'Maya fever: watch day 88, act 89-90');
const mt = (d: number) => analyses[M].person.find((r) => r.mission_day === d)!.body_temp_c;
console.log(`  Maya: temperature ${mt(87)} / ${mt(88)} / ${mt(89)} / ${mt(90)} °C on days 87-90 -> Immune Within / Watch / Act / Act`);

// Shared radiation spike
for (const n of names) {
  check(lvl(n, 60, 'Radiation') === 0, `${n} radiation normal day 60`);
  check(lvl(n, 61, 'Radiation') === 2 && lvl(n, 62, 'Radiation') === 2, `${n} radiation act now days 61-62`);
  check(lvl(n, 63, 'Radiation') === 1 && lvl(n, 64, 'Radiation') === 1 && lvl(n, 65, 'Radiation') === 0, `${n} radiation watch 63-64, normal 65`);
}
console.log('  Radiation: all three crew Act now on days 61-62, Watch on 63-64, back to normal on 65');

console.log(`\n${checks - failures}/${checks} checks passed${failures ? ` - ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
