# Know Your Normal

A health self-check for astronauts on long-duration missions, built for the
NASA Space Apps Challenge 2026: *Create Health Monitoring Software for
Astronauts on Space Missions*.

The app compares each astronaut with **their own normal**, learned from their
first 30 mission days, instead of with an average person. Every day it shows a
green, yellow or red status for six body systems, with a plain next step.

## Run it

```bash
pip install -r requirements.txt
python generate_data.py      # optional: data/crew_daily.csv is already included
streamlit run app.py
```

## What it does

1. **Gathers** a daily check-in: resting heart rate, heart rate variability,
   blood pressure, sleep, mood, exercise, body temperature and dosimeter reading.
2. **Learns each astronaut's normal** (average and usual spread) from days 1–30.
3. **Rule check:** compares the last 3 days with that normal. Yellow at 2 SD,
   red at 3 SD, or when two readings in the same system drift together.
   Fever (≥ 38 °C) and radiation spikes (≥ 4× the normal dose rate) are red right away.
4. **Pattern check:** an Isolation Forest (scikit-learn), trained on the
   astronaut's own normal days, flags days whose overall combination of readings
   is unusual, even when no single number crosses a line.
5. **Tells them what to do:** each status has a next step, and the astronaut can
   download a report for the flight surgeon.

## Emotion check (from Asmaa's graduation project)

Mood isn't only self-reported. Each day the astronaut records a short check-in,
and the real-time emotion analyzer from Asmaa's Birzeit University graduation
project (ENCS5300) estimates eight emotions: neutral, calm, happy, sad, angry,
fearful, disgust and surprised. The share of negative emotions becomes a Mood
indicator, compared with the astronaut's own normal next to their self-rated mood.

In the demo, the analyzer catches Eng. Karim's isolation stress several days
before his self-rated mood does (see the **Emotion check** tab).

The real analyzer is an SVM + Random Forest ensemble on MFCC, chroma and
mel-spectrogram features, trained on RAVDESS (83.7% accuracy on 8 emotions). Its
face module is built and ready to switch on. In this demo its daily outputs are
simulated (`emo_*` columns and `negative_emotion_pct` in the data). To plug in the
real analyzer, write its 8 emotion probabilities for each check-in into those columns.

| Body system   | Readings                           | Space health risk covered |
|---------------|------------------------------------|---------------------------|
| Heart         | resting HR, HRV, systolic BP       | cardiovascular events     |
| Bone & muscle | exercise minutes                   | bone loss (countermeasure)|
| Sleep         | sleep hours                        | behavioral health         |
| Mood          | mood rating 1–5, negative emotions from the emotion check | isolation and confinement |
| Immune        | body temperature                   | immune changes / infection|
| Radiation     | daily dose, mission total          | space radiation (600 mSv NASA career limit, NASA-STD-3001) |

## Demo data

`generate_data.py` simulates 90 days for a 3-person crew, with planted problems:

- **Cmdr. Lina:** heart drift from day 70 (heart rate up, HRV down, blood pressure up)
- **Eng. Karim:** isolation stress from day 55 (sleep and mood drop), skipped exercise from day 81
- **Spec. Maya:** fever from day 88
- **Whole crew:** solar particle event on days 61–62

Use the **Mission day** slider to replay the mission and watch the alerts appear.

## Files

- `app.py` – Streamlit dashboard
- `engine.py` – baseline, rule check, Isolation Forest, report
- `generate_data.py` – simulated crew data
- `data/crew_daily.csv` – the generated data

Prototype only, not a medical device. All data is simulated.
