"""Generate a simulated 90-day health log for a 3-person crew.

The data is synthetic (hackathon demo). Each astronaut has their own normal,
and a few realistic problems are planted so the alerts have something to find:

  - Cmdr. Lina   : heart drift from day 70 (resting HR up, HRV down, BP up)
  - Eng. Karim   : isolation stress from day 55 (sleep and mood drop),
                   then mostly skipped exercise from day 81
  - Spec. Maya   : fever from day 88 (possible infection / immune change)
  - Whole crew   : solar particle event on days 61-62 (radiation spike)

It also simulates the daily output of our graduation project's emotion
analyzer (probabilities for 8 emotions from a short daily check-in). Karim's
emotion mix shifts toward sad and fearful as his isolation stress grows.

Run:  python generate_data.py   ->  writes data/crew_daily.csv
"""
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 7
MISSION_DAYS = 90
OUT = Path(__file__).parent / "data" / "crew_daily.csv"

# Each astronaut's personal normal (they differ on purpose).
CREW = {
    "Cmdr. Lina": dict(resting_hr=58, hrv_ms=62, systolic_bp=114, sleep_h=6.9,
                       mood=4.2, exercise_min=125, body_temp_c=36.6),
    "Eng. Karim": dict(resting_hr=64, hrv_ms=47, systolic_bp=119, sleep_h=6.6,
                       mood=4.0, exercise_min=135, body_temp_c=36.7),
    "Spec. Maya": dict(resting_hr=61, hrv_ms=55, systolic_bp=111, sleep_h=7.1,
                       mood=4.4, exercise_min=120, body_temp_c=36.5),
}

# Day-to-day variation.
NOISE = dict(resting_hr=1.8, hrv_ms=4.0, systolic_bp=4.0, sleep_h=0.45,
             mood=0.45, exercise_min=12, body_temp_c=0.12)

BASE_DOSE_MSV = 1.1  # simulated deep-space daily dose (mSv/day)

# Emotion analyzer output (8 RAVDESS emotions, as in the ENCS5300 analyzer).
EMOTIONS = ["neutral", "calm", "happy", "sad", "angry", "fearful", "disgust", "surprised"]
NEGATIVE_EMOTIONS = {"sad", "angry", "fearful", "disgust"}
EMO_ALPHA = {  # Dirichlet weights = each astronaut's usual emotion mix
    "Cmdr. Lina": dict(neutral=6, calm=5, happy=4, sad=1.0, angry=0.6, fearful=0.5, disgust=0.4, surprised=0.8),
    "Eng. Karim": dict(neutral=6, calm=4, happy=4, sad=1.2, angry=0.8, fearful=0.6, disgust=0.4, surprised=0.8),
    "Spec. Maya": dict(neutral=5, calm=5, happy=5, sad=0.9, angry=0.5, fearful=0.5, disgust=0.4, surprised=1.0),
}


def generate(seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    erng = np.random.default_rng(seed + 1)  # separate stream for emotion outputs
    days = np.arange(1, MISSION_DAYS + 1)

    # Radiation is shared: the whole crew is in the same vehicle.
    dose = BASE_DOSE_MSV + rng.normal(0, 0.06, MISSION_DAYS)
    dose[60], dose[61] = 14.5, 9.8  # solar particle event, days 61-62

    rows = []
    for name, base in CREW.items():
        for i, d in enumerate(days):
            r = {k: base[k] + rng.normal(0, NOISE[k]) for k in base}

            if name == "Cmdr. Lina" and d >= 70:
                t = (d - 70) / 20  # ramps 0 -> 1 over days 70-90
                r["resting_hr"] += 12 * t
                r["hrv_ms"] -= 20 * t
                r["systolic_bp"] += 15 * t

            if name == "Eng. Karim":
                if d >= 55:
                    t = min((d - 55) / 25, 1.0)
                    r["sleep_h"] -= 1.9 * t
                    r["mood"] -= 2.1 * t
                if d >= 81:
                    r["exercise_min"] = rng.choice([0, 0, 15, 30, 45])

            if name == "Spec. Maya" and d >= 88:
                r["body_temp_c"] += {88: 1.0, 89: 1.6, 90: 1.4}[d]
                r["resting_hr"] += 9
                r["sleep_h"] -= 0.8

            alpha = dict(EMO_ALPHA[name])
            if name == "Eng. Karim" and d >= 55:
                t = min((d - 55) / 25, 1.0)
                alpha.update(sad=alpha["sad"] + 6 * t, fearful=alpha["fearful"] + 2 * t,
                             angry=alpha["angry"] + 1 * t, happy=max(alpha["happy"] - 3 * t, 0.5),
                             calm=max(alpha["calm"] - 3 * t, 0.5))
            if name == "Spec. Maya" and d >= 88:
                alpha.update(sad=alpha["sad"] + 1.5, calm=alpha["calm"] - 1)
            probs = erng.dirichlet([alpha[e] for e in EMOTIONS])
            top2 = [EMOTIONS[j] for j in np.argsort(probs)[::-1][:2]]
            negative = sum(p for e, p in zip(EMOTIONS, probs) if e in NEGATIVE_EMOTIONS)

            rows.append({
                "astronaut": name,
                "mission_day": int(d),
                "resting_hr": round(r["resting_hr"]),
                "hrv_ms": round(r["hrv_ms"]),
                "systolic_bp": round(r["systolic_bp"]),
                "sleep_h": round(max(r["sleep_h"], 2.0), 1),
                "mood": int(np.clip(round(r["mood"]), 1, 5)),
                "exercise_min": int(max(round(r["exercise_min"]), 0)),
                "body_temp_c": round(r["body_temp_c"], 1),
                "radiation_msv": round(max(dose[i] + rng.normal(0, 0.03), 0.5), 2),
                "negative_emotion_pct": round(100 * negative, 1),
                "top_emotions": " + ".join(top2),
                **{f"emo_{e}": round(float(p), 3) for e, p in zip(EMOTIONS, probs)},
            })
    return pd.DataFrame(rows)


def save(df: pd.DataFrame, path: Path = OUT) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return path


if __name__ == "__main__":
    out = save(generate())
    print(f"Wrote {out}")
