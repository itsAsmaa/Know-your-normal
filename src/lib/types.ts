export type Emotion =
  | 'neutral' | 'calm' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgust' | 'surprised';

export type MetricKey =
  | 'resting_hr' | 'hrv_ms' | 'systolic_bp' | 'exercise_min' | 'sleep_h' | 'mood'
  | 'negative_emotion_pct' | 'body_temp_c' | 'radiation_msv';

export type SystemName = 'Heart' | 'Bone & muscle' | 'Sleep' | 'Mood' | 'Immune' | 'Radiation';

export type Level = 0 | 1 | 2;

/** One daily record, same columns as data/crew_daily.csv. */
export interface Row {
  astronaut: string;
  mission_day: number;
  resting_hr: number;
  hrv_ms: number;
  systolic_bp: number;
  sleep_h: number;
  mood: number;
  exercise_min: number;
  body_temp_c: number;
  radiation_msv: number;
  negative_emotion_pct: number;
  top_emotions: string | null;
  emo: Record<Emotion, number> | null;
  /** 'demo' = one of the 270 supplied records, 'checkin' = added in this browser. */
  source: 'demo' | 'checkin';
}
