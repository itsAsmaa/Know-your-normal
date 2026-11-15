import type { Emotion, MetricKey, Row } from './types';

/** The 8 RAVDESS emotions, in the order used by generate_data.py. */
export const EMOTIONS: Emotion[] = ['neutral', 'calm', 'happy', 'sad', 'angry', 'fearful', 'disgust', 'surprised'];
export const NEGATIVE_EMOTIONS: Emotion[] = ['sad', 'angry', 'fearful', 'disgust'];

export type EmotionGroup = 'Negative' | 'Neutral & calm' | 'Positive';
export const EMO_GROUPS: EmotionGroup[] = ['Negative', 'Neutral & calm', 'Positive'];
export const EMO_GROUP: Record<Emotion, EmotionGroup> = {
  neutral: 'Neutral & calm', calm: 'Neutral & calm',
  happy: 'Positive', surprised: 'Positive',
  sad: 'Negative', angry: 'Negative', fearful: 'Negative', disgust: 'Negative',
};

const NUMERIC: MetricKey[] = ['resting_hr', 'hrv_ms', 'systolic_bp', 'sleep_h', 'mood', 'exercise_min',
  'body_temp_c', 'radiation_msv', 'negative_emotion_pct'];

export const CSV_COLUMNS = ['astronaut', 'mission_day', 'resting_hr', 'hrv_ms', 'systolic_bp', 'sleep_h', 'mood',
  'exercise_min', 'body_temp_c', 'radiation_msv', 'negative_emotion_pct', 'top_emotions',
  ...EMOTIONS.map((e) => `emo_${e}`)];

/** Parse crew_daily.csv (no quoted fields in this file). */
export function parseCsv(text: string, source: Row['source'] = 'demo'): Row[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0].split(',').map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const cell = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? '').trim() : '');
    const hasEmo = EMOTIONS.every((e) => cell(`emo_${e}`) !== '');
    const emo = hasEmo
      ? (Object.fromEntries(EMOTIONS.map((e) => [e, Number(cell(`emo_${e}`))])) as Record<Emotion, number>)
      : null;
    const row: Row = {
      astronaut: cell('astronaut'),
      mission_day: Number(cell('mission_day')),
      resting_hr: 0, hrv_ms: 0, systolic_bp: 0, sleep_h: 0, mood: 0, exercise_min: 0,
      body_temp_c: 0, radiation_msv: 0, negative_emotion_pct: 0,
      top_emotions: cell('top_emotions') || null,
      emo,
      source,
    };
    for (const k of NUMERIC) row[k] = Number(cell(k));
    return row;
  });
}

export function rowsToCsv(rows: Row[]): string {
  const out = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    out.push([
      r.astronaut, r.mission_day, r.resting_hr, r.hrv_ms, r.systolic_bp, r.sleep_h, r.mood, r.exercise_min,
      r.body_temp_c, r.radiation_msv, r.negative_emotion_pct, r.top_emotions ?? '',
      ...EMOTIONS.map((e) => (r.emo ? r.emo[e] : '')),
    ].join(','));
  }
  return out.join('\n') + '\n';
}
