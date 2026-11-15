# Know Your Normal · web dashboard (prototype)

A React + Vite + TypeScript + Recharts version of the **Know Your Normal** astronaut-health
prototype (`app.py`, `engine.py`, `generate_data.py`). It compares each simulated crew member
with their own first 30 mission days and shows six body-system statuses with next steps.

> **Simulation only.** All 270 records are synthetic. This is a prototype, not a medical device,
> and its results are not clinical guidance. It is not affiliated with or endorsed by NASA, and
> nothing in it is live telemetry.

## Run it on Streamlit

`app.py` shows the dashboard as a full-page Streamlit app (Streamlit Community Cloud: repo
`itsAsmaa/Know-your-normal`, branch `main`, main file `app.py`). The dashboard itself is the
single-file build in `dashboard/index.html`; rebuild it with `npm run build:streamlit` and copy
`dist-streamlit/index.html` to `dashboard/index.html`. The original Python prototype is still
available: `streamlit run prototype_app.py`.

```bash
pip install -r requirements.txt
streamlit run app.py             # new dashboard
streamlit run prototype_app.py   # original Python prototype
```

## Run the web app directly

```bash
npm install
npm run dev        # local development server
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run verify     # TypeScript engine vs. Python engine + scenario checks
```

`dist/` is a static site: upload it to any static host (Netlify, GitHub Pages, Vercel). Open it
through a web server, not by double-clicking `index.html`.

## What's preserved from the Python prototype

- **Data:** `src/data/crew_daily.csv` is the supplied CSV (270 rows), parsed at runtime.
- **Rules:** `src/lib/engine.ts` is a line-by-line port of `engine.py`. Metric labels, units,
  minimum spreads and next-step text are exported from `engine.py` into
  `src/data/engineConstants.ts`, so they are identical.
  - Personal baseline: mean and sample SD of days 1–30, floored per reading.
  - Sustained readings: 3-day average; temperature and radiation: today's reading.
  - Watch at 2 SD, Act at 3 SD; two readings off in one system → Act now.
  - Temperature: Watch at 37.5 °C (or 2.5 SD), Act at 38 °C.
  - Radiation: Watch when any of the last 3 days is ≥ 2× normal, Act when today is ≥ 4×;
    mission total shown against the 600 mSv NASA-STD-3001 career limit (reference only).
  - Early warning: first day the emotion check vs. self-rated mood leave their normal range.
  - Report text: same as `report_text()` in `engine.py`.
- **Pattern check:** `src/lib/iforest.ts` is a deterministic browser Isolation Forest set up like
  engine.py (300 trees, 256-sample subsets, 3,000 jittered calibration copies, 99.5th-percentile
  threshold). **It is not scikit-learn**: its random draws differ, so scores differ slightly. The
  scikit-learn scores for the 270 supplied records are included (`src/data/sklearnReference.ts`)
  and drawn as a dashed reference line, and the app shows how often the flags agree.

## Checks (`npm run verify`)

- 270 records loaded.
- Rule statuses, values, z-scores and drivers identical to the Python engine: **180/180** astronaut-days (days 31–90 × 3).
- Flight-surgeon report text identical to Python (except the pattern-model line): **180/180**.
- Isolation Forest flags agree with scikit-learn on **177/180** post-calibration days.
- Scenarios: Lina's heart drift (Act now by day 90), Karim's isolation stress (emotion check day 61,
  mood day 64; sleep, mood and exercise Act now by day 90), Maya's fever (Watch day 88, Act 89–90),
  and the shared radiation spike (Act now days 61–62 for all three crew).

## Features

Crew selection, mission-day replay, status cards, trends with calibration shading and personal
range, emotion mix history and daily breakdown, pattern check, daily check-in saved to
localStorage, crew comparison, flight-surgeon text report, CSV export on every chart, all-records
CSV, print / save as PDF, dark mode, reset to the supplied data, and a mobile layout.

Inside the claude.ai artifact frame, file downloads go through the host's download prompt (or a
copy-to-clipboard dialog), and printing is hidden because the frame blocks it.

## Use of Super Intelligence (SI)

Built with help from Claude (Anthropic), an SI tool: the code, text and this README were written
with Claude and checked by the team. The data is simulated. The emotion analyzer the emotion check
stands in for comes from Asmaa's graduation project (Birzeit University, ENCS5300).
