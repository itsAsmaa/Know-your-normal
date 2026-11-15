// Exported from engine.py (source of truth) - do not edit by hand.
export const ENGINE = {
 "CALIBRATION_DAYS": 30,
 "RECENT_DAYS": 3,
 "CAREER_LIMIT_MSV": 600,
 "METRICS": [
  {
   "key": "resting_hr",
   "label": "Resting heart rate",
   "unit": "bpm",
   "system": "Heart",
   "bad": "up",
   "min_std": 1.5,
   "agg": "mean"
  },
  {
   "key": "hrv_ms",
   "label": "Heart rate variability",
   "unit": "ms",
   "system": "Heart",
   "bad": "down",
   "min_std": 3.0,
   "agg": "mean"
  },
  {
   "key": "systolic_bp",
   "label": "Systolic blood pressure",
   "unit": "mmHg",
   "system": "Heart",
   "bad": "up",
   "min_std": 3.0,
   "agg": "mean"
  },
  {
   "key": "exercise_min",
   "label": "Exercise",
   "unit": "min",
   "system": "Bone & muscle",
   "bad": "down",
   "min_std": 10.0,
   "agg": "mean"
  },
  {
   "key": "sleep_h",
   "label": "Sleep",
   "unit": "h",
   "system": "Sleep",
   "bad": "down",
   "min_std": 0.3,
   "agg": "mean"
  },
  {
   "key": "mood",
   "label": "Mood",
   "unit": "out of 5",
   "system": "Mood",
   "bad": "down",
   "min_std": 0.4,
   "agg": "mean"
  },
  {
   "key": "negative_emotion_pct",
   "label": "Negative emotions",
   "unit": "%",
   "system": "Mood",
   "bad": "up",
   "min_std": 5.0,
   "agg": "mean"
  },
  {
   "key": "body_temp_c",
   "label": "Body temperature",
   "unit": "°C",
   "system": "Immune",
   "bad": "up",
   "min_std": 0.2,
   "agg": "last"
  },
  {
   "key": "radiation_msv",
   "label": "Radiation dose",
   "unit": "mSv/day",
   "system": "Radiation",
   "bad": "up",
   "min_std": 0.15,
   "agg": "last"
  }
 ],
 "SYSTEMS": [
  "Heart",
  "Bone & muscle",
  "Sleep",
  "Mood",
  "Immune",
  "Radiation"
 ],
 "ACTIONS": {
  "Heart": {
   "0": "No action needed.",
   "1": "Your heart numbers are drifting from your normal. Re-measure after 10 minutes of rest, drink water, and log any symptoms such as dizziness or chest discomfort.",
   "2": "This is a sustained change from your normal. Contact the flight surgeon today and hold intense exercise until cleared."
  },
  "Bone & muscle": {
   "0": "No action needed.",
   "1": "Exercise is below your normal. Without daily resistive exercise, bone and muscle loss speed up in microgravity, so get back on your schedule.",
   "2": "You've missed several days of exercise. Schedule make-up resistive sessions and tell the flight surgeon."
  },
  "Sleep": {
   "0": "No action needed.",
   "1": "Sleep is below your normal. Protect your sleep window: dim the lights early and avoid screens before rest.",
   "2": "Sleep has dropped well below your normal. Tell the flight surgeon and ask mission control to adjust your work schedule."
  },
  "Mood": {
   "0": "No action needed.",
   "1": "Your mood is lower than your normal. Take a break, call family, or talk with a crewmate.",
   "2": "Your mood has been low for several days. Book a private conference with the mission psychologist."
  },
  "Immune": {
   "0": "No action needed.",
   "1": "Your temperature is above your normal. Re-check in 4 hours, rest and drink water.",
   "2": "You have a fever. Limit close contact with the crew, log your symptoms, and contact the flight surgeon."
  },
  "Radiation": {
   "0": "No action needed.",
   "1": "The dose rate was recently above normal. Check space-weather alerts and limit time in lightly shielded areas.",
   "2": "The dose rate has spiked, likely from a solar particle event. Go to the storm shelter now and follow the radiation flight rule."
  }
 },
 "LEVEL_NAME": {
  "0": "Within your normal",
  "1": "Watch",
  "2": "Act now"
 }
} as const;
