import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { EMOTIONS, NEGATIVE_EMOTIONS } from '../lib/data';
import type { Analysis } from '../lib/engine';
import { pyFixed } from '../lib/format';
import type { Emotion, MetricKey, Row } from '../lib/types';

type FieldKey = Exclude<MetricKey, 'negative_emotion_pct'>;
interface Field { key: FieldKey; label: string; unit: string; min: number; max: number; step: number; digits: number; integer?: boolean }

// Ranges and defaults follow the check-in form in app.py.
const FIELDS: Field[] = [
  { key: 'resting_hr', label: 'Resting heart rate', unit: 'bpm', min: 30, max: 200, step: 1, digits: 0, integer: true },
  { key: 'hrv_ms', label: 'Heart rate variability', unit: 'ms', min: 5, max: 200, step: 1, digits: 0, integer: true },
  { key: 'systolic_bp', label: 'Systolic blood pressure', unit: 'mmHg', min: 70, max: 220, step: 1, digits: 0, integer: true },
  { key: 'exercise_min', label: 'Exercise', unit: 'min', min: 0, max: 300, step: 1, digits: 0, integer: true },
  { key: 'sleep_h', label: 'Sleep', unit: 'h', min: 0, max: 14, step: 0.1, digits: 1 },
  { key: 'mood', label: 'Mood (1 = very low, 5 = great)', unit: 'out of 5', min: 1, max: 5, step: 1, digits: 0, integer: true },
  { key: 'body_temp_c', label: 'Body temperature', unit: '°C', min: 34, max: 42, step: 0.1, digits: 1 },
  { key: 'radiation_msv', label: 'Radiation dose (dosimeter)', unit: 'mSv/day', min: 0, max: 300, step: 0.01, digits: 2 },
];

interface Props { a: Analysis; newDay: number; onSave: (row: Row) => void }

export function CheckInForm({ a, newDay, onSave }: Props) {
  const calibration = a.person.filter((r) => r.emo && r.mission_day <= 30);
  const defaults = useMemo(() => {
    const v = {} as Record<FieldKey, string>;
    for (const f of FIELDS) v[f.key] = pyFixed(a.base.mean[f.key], f.digits);
    const e = {} as Record<Emotion, string>;
    for (const em of EMOTIONS) {
      const mean = calibration.reduce((s, r) => s + r.emo![em], 0) / Math.max(calibration.length, 1);
      e[em] = pyFixed(mean * 100, 1);
    }
    return { v, e };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a]);
  const [values, setValues] = useState(defaults.v);
  const [emo, setEmo] = useState(defaults.e);
  const [errors, setErrors] = useState<string[]>([]);

  const emoNums = EMOTIONS.map((e) => Number(emo[e]));
  const emoTotal = emoNums.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
  const probs = EMOTIONS.map((_, i) => (emoTotal > 0 ? emoNums[i] / emoTotal : 0));
  const negative = NEGATIVE_EMOTIONS.reduce((s, e) => s + probs[EMOTIONS.indexOf(e)], 0);
  const top2 = EMOTIONS.map((e, i) => [e, probs[i]] as const).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([e]) => e);

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const errs: string[] = [];
    const row: Partial<Row> = { astronaut: a.astronaut, mission_day: newDay, source: 'checkin' };
    for (const f of FIELDS) {
      const raw = values[f.key].trim();
      const x = Number(raw);
      if (raw === '' || !Number.isFinite(x)) errs.push(`${f.label}: enter a number.`);
      else if (x < f.min || x > f.max) errs.push(`${f.label}: must be between ${f.min} and ${f.max} ${f.unit}.`);
      else if (f.integer && !Number.isInteger(x)) errs.push(`${f.label}: use a whole number.`);
      else (row as Record<string, unknown>)[f.key] = x;
    }
    if (emoNums.some((x) => !Number.isFinite(x) || x < 0)) errs.push('Emotion mix: every share must be 0 or more.');
    else if (emoTotal <= 0) errs.push('Emotion mix: at least one share must be above 0.');
    setErrors(errs);
    if (errs.length) return;
    row.emo = Object.fromEntries(EMOTIONS.map((e, i) => [e, Number(probs[i].toFixed(3))])) as Record<Emotion, number>;
    row.negative_emotion_pct = Number(pyFixed(100 * negative, 1));
    row.top_emotions = top2.join(' + ');
    onSave(row as Row);
  };

  return (
    <form className="card checkin" onSubmit={submit} noValidate>
      <div className="checkin-head">
        <span className="eyebrow">Log mission day {newDay} · {a.astronaut}</span>
        <span className="muted small">Fields start at {a.astronaut}'s normal. Change what's different today.</span>
      </div>
      <div className="field-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span className="field-label">{f.label}<span className="field-unit">{f.unit}</span></span>
            <input
              type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </label>
        ))}
        <div className="field derived" aria-live="polite">
          <span className="field-label">Negative emotions<span className="field-unit">%</span></span>
          <output>{emoTotal > 0 ? pyFixed(100 * negative, 1) : '–'}</output>
          <span className="field-hint">Calculated from the mix below (sad + angry + fearful + disgust)</span>
        </div>
      </div>
      <fieldset className="emo-fieldset">
        <legend>Emotion mix from the daily check-in <span className="muted">(% shares, normalized when saved)</span></legend>
        <div className="emo-grid">
          {EMOTIONS.map((e) => (
            <label key={e} className="field compact">
              <span className="field-label">{e}</span>
              <input type="number" inputMode="decimal" min={0} max={100} step={0.1} value={emo[e]}
                onChange={(ev) => setEmo({ ...emo, [e]: ev.target.value })} />
            </label>
          ))}
        </div>
        <p className="muted small">Top 2 after saving: <strong>{emoTotal > 0 ? top2.join(' + ') : '–'}</strong></p>
      </fieldset>
      {errors.length > 0 && (
        <ul className="form-errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <div className="checkin-foot">
        <span className="muted small">All values here are simulated. Saved only in this browser (localStorage). Not a medical record.</span>
        <div className="checkin-actions">
          <button type="button" className="btn btn-ghost" onClick={() => { setValues(defaults.v); setEmo(defaults.e); setErrors([]); }}>
            Reset fields
          </button>
          <button type="submit" className="btn btn-primary"><Save size={15} aria-hidden /> Save simulated check-in</button>
        </div>
      </div>
    </form>
  );
}
