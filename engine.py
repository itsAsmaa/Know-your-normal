"""Know Your Normal: personal-baseline health engine.

Each astronaut's first CALIBRATION_DAYS mission days define *their* normal
(the average and usual spread of every indicator). Every later day is compared
with that personal normal, not with a population average:

  * Rule check:    the last RECENT_DAYS are compared with the personal normal
                   (z-scores), per body system, with a plain next step.
  * Pattern check: an Isolation Forest trained on the astronaut's own normal
                   days flags days whose overall pattern looks unusual, even
                   when no single number crosses a line.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

CALIBRATION_DAYS = 30        # first N mission days define each astronaut's normal
RECENT_DAYS = 3              # compare the last N days with that normal
CAREER_LIMIT_MSV = 600       # NASA-STD-3001 career effective dose limit

LEVEL_NAME = {0: "Within your normal", 1: "Watch", 2: "Act now"}
LEVEL_ICON = {0: "🟢", 1: "🟡", 2: "🔴"}


@dataclass(frozen=True)
class Metric:
    key: str
    label: str
    unit: str
    system: str
    bad: str          # "up" or "down": the direction that is a concern
    min_std: float    # floor on the spread so very steady metrics don't over-alert
    agg: str = "mean" # recent window summary: "mean" (sustained) or "last" (acute)


METRICS = [
    Metric("resting_hr", "Resting heart rate", "bpm", "Heart", "up", 1.5),
    Metric("hrv_ms", "Heart rate variability", "ms", "Heart", "down", 3.0),
    Metric("systolic_bp", "Systolic blood pressure", "mmHg", "Heart", "up", 3.0),
    Metric("exercise_min", "Exercise", "min", "Bone & muscle", "down", 10.0),
    Metric("sleep_h", "Sleep", "h", "Sleep", "down", 0.3),
    Metric("mood", "Mood", "out of 5", "Mood", "down", 0.4),
    Metric("negative_emotion_pct", "Negative emotions", "%", "Mood", "up", 5.0),
    Metric("body_temp_c", "Body temperature", "°C", "Immune", "up", 0.2, agg="last"),
    Metric("radiation_msv", "Radiation dose", "mSv/day", "Radiation", "up", 0.15, agg="last"),
]
METRIC = {m.key: m for m in METRICS}
METRIC_KEYS = [m.key for m in METRICS]

SYSTEMS = ["Heart", "Bone & muscle", "Sleep", "Mood", "Immune", "Radiation"]
SYSTEM_ICON = {"Heart": "❤️", "Bone & muscle": "🦴", "Sleep": "😴",
               "Mood": "🧠", "Immune": "🛡️", "Radiation": "☢️"}

ACTIONS = {
    "Heart": {
        0: "No action needed.",
        1: "Your heart numbers are drifting from your normal. Re-measure after 10 minutes of rest, drink water, and log any symptoms such as dizziness or chest discomfort.",
        2: "This is a sustained change from your normal. Contact the flight surgeon today and hold intense exercise until cleared.",
    },
    "Bone & muscle": {
        0: "No action needed.",
        1: "Exercise is below your normal. Without daily resistive exercise, bone and muscle loss speed up in microgravity, so get back on your schedule.",
        2: "You've missed several days of exercise. Schedule make-up resistive sessions and tell the flight surgeon.",
    },
    "Sleep": {
        0: "No action needed.",
        1: "Sleep is below your normal. Protect your sleep window: dim the lights early and avoid screens before rest.",
        2: "Sleep has dropped well below your normal. Tell the flight surgeon and ask mission control to adjust your work schedule.",
    },
    "Mood": {
        0: "No action needed.",
        1: "Your mood is lower than your normal. Take a break, call family, or talk with a crewmate.",
        2: "Your mood has been low for several days. Book a private conference with the mission psychologist.",
    },
    "Immune": {
        0: "No action needed.",
        1: "Your temperature is above your normal. Re-check in 4 hours, rest and drink water.",
        2: "You have a fever. Limit close contact with the crew, log your symptoms, and contact the flight surgeon.",
    },
    "Radiation": {
        0: "No action needed.",
        1: "The dose rate was recently above normal. Check space-weather alerts and limit time in lightly shielded areas.",
        2: "The dose rate has spiked, likely from a solar particle event. Go to the storm shelter now and follow the radiation flight rule.",
    },
}


# --------------------------------------------------------------------------- #
# Data classes
# --------------------------------------------------------------------------- #
@dataclass
class MetricResult:
    metric: Metric
    value: float      # recent value (3-day mean, or today's value for acute metrics)
    mean: float       # personal normal
    std: float        # personal usual spread
    z: float          # signed z-score vs. personal normal
    level: int


@dataclass
class SystemResult:
    system: str
    level: int
    metrics: list[MetricResult]
    action: str
    extra: dict = field(default_factory=dict)


@dataclass
class DayResult:
    astronaut: str
    day: int
    overall: int
    systems: dict[str, SystemResult]
    unusual: bool
    pattern_score: float
    pattern_threshold: float
    drivers: list[tuple[str, float]]  # (metric key, z) most different from normal today
    top_emotions: str = ""            # top-2 emotion pair from today's emotion check


@dataclass
class Analysis:
    astronaut: str
    person: pd.DataFrame      # this astronaut's log, sorted by mission day
    base: pd.DataFrame        # index = metric key, columns = mean, std
    pattern: pd.DataFrame     # mission_day, score, unusual
    threshold: float


# --------------------------------------------------------------------------- #
# Core logic
# --------------------------------------------------------------------------- #
def personal_baseline(person: pd.DataFrame) -> pd.DataFrame:
    """Average and usual spread of each indicator over the calibration days."""
    cal = person[person["mission_day"] <= CALIBRATION_DAYS]
    rows = {}
    for m in METRICS:
        std = float(cal[m.key].std(ddof=1))
        rows[m.key] = {"mean": float(cal[m.key].mean()), "std": max(std, m.min_std)}
    return pd.DataFrame(rows).T


def _zscores(frame: pd.DataFrame, base: pd.DataFrame) -> pd.DataFrame:
    means = base.loc[METRIC_KEYS, "mean"].to_numpy()
    stds = base.loc[METRIC_KEYS, "std"].to_numpy()
    return (frame[METRIC_KEYS].astype(float) - means) / stds


def analyze(person: pd.DataFrame, astronaut: str = "") -> Analysis:
    """Learn one astronaut's normal and score every day with the pattern model."""
    person = person.sort_values("mission_day").reset_index(drop=True)
    if (person["mission_day"] <= CALIBRATION_DAYS).sum() < CALIBRATION_DAYS:
        raise ValueError(f"Need {CALIBRATION_DAYS} calibration days to learn a normal.")
    base = personal_baseline(person)

    z_all = _zscores(person, base).to_numpy()
    cal_mask = (person["mission_day"] <= CALIBRATION_DAYS).to_numpy()
    z_cal = z_all[cal_mask]

    # 30 calibration days is a small sample, so the forest is trained on jittered
    # copies of them (small noise in z units). The alert threshold is the 99.5th
    # percentile of scores on a separate jittered sample of normal days.
    rng = np.random.default_rng(0)

    def jitter(n: int) -> np.ndarray:
        picks = z_cal[rng.integers(0, len(z_cal), n)]
        return picks + rng.normal(0, 0.35, picks.shape)

    model = IsolationForest(n_estimators=300, max_samples=256, random_state=0)
    model.fit(jitter(3000))
    threshold = float(np.quantile(-model.score_samples(jitter(3000)), 0.995))
    scores = -model.score_samples(z_all)          # higher = more unusual

    pattern = pd.DataFrame({
        "mission_day": person["mission_day"],
        "score": scores,
        "unusual": scores > threshold,
    })
    return Analysis(astronaut, person, base, pattern, threshold)


def _metric_level(m: Metric, value: float, mean: float, z: float) -> int:
    concern = z if m.bad == "up" else -z
    if m.key == "body_temp_c":
        if value >= 38.0:
            return 2
        return 1 if (value >= 37.5 or concern >= 2.5) else 0
    return 2 if concern >= 3 else 1 if concern >= 2 else 0


def evaluate(a: Analysis, day: int) -> DayResult:
    """Status of every body system on a given mission day."""
    if day <= CALIBRATION_DAYS:
        raise ValueError("Pick a day after the calibration period.")
    upto = a.person[a.person["mission_day"] <= day]
    recent = upto[upto["mission_day"] > day - RECENT_DAYS]
    today = upto.iloc[-1]

    by_system: dict[str, list[MetricResult]] = {s: [] for s in SYSTEMS}
    for m in METRICS:
        mean, std = a.base.loc[m.key, "mean"], a.base.loc[m.key, "std"]
        value = float(today[m.key]) if m.agg == "last" else float(recent[m.key].mean())
        z = (value - mean) / std
        level = _metric_level(m, value, mean, z)
        by_system[m.system].append(MetricResult(m, value, mean, std, z, level))

    systems: dict[str, SystemResult] = {}
    for s, results in by_system.items():
        level = max(r.level for r in results)
        # Two or more indicators off in the same system = a pattern -> act now.
        if sum(r.level >= 1 for r in results) >= 2:
            level = 2
        extra = {}
        if s == "Radiation":
            rad = results[0]
            ratio_today = rad.value / rad.mean
            ratio_recent = float(recent["radiation_msv"].max()) / rad.mean
            level = 2 if ratio_today >= 4 else 1 if ratio_recent >= 2 else 0
            rad.level = level
            total = float(upto["radiation_msv"].sum())
            extra = {"mission_total_msv": total,
                     "pct_career_limit": 100 * total / CAREER_LIMIT_MSV}
        systems[s] = SystemResult(s, level, results, ACTIONS[s][level], extra)

    z_today = _zscores(today.to_frame().T, a.base).iloc[0]
    drivers = sorted(((k, float(v)) for k, v in z_today.items() if abs(v) >= 2),
                     key=lambda kv: -abs(kv[1]))[:3]
    prow = a.pattern[a.pattern["mission_day"] == int(today["mission_day"])].iloc[0]

    return DayResult(
        astronaut=a.astronaut,
        day=int(today["mission_day"]),
        overall=max(sr.level for sr in systems.values()),
        systems=systems,
        unusual=bool(prow["unusual"]),
        pattern_score=float(prow["score"]),
        pattern_threshold=a.threshold,
        drivers=drivers,
        top_emotions="" if pd.isna(today.get("top_emotions")) else str(today.get("top_emotions")),
    )


# --------------------------------------------------------------------------- #
# Formatting helpers
# --------------------------------------------------------------------------- #
def fmt(value: float, key: str) -> str:
    if key == "negative_emotion_pct":
        return f"{value:.0f}"
    if key in ("sleep_h", "body_temp_c", "mood"):
        return f"{value:.1f}"
    if key == "radiation_msv":
        return f"{value:.2f}"
    return f"{value:.0f}"


def report_text(r: DayResult) -> str:
    """Plain-text status report an astronaut can send to the flight surgeon."""
    lines = [
        "KNOW YOUR NORMAL - HEALTH STATUS REPORT",
        f"Astronaut: {r.astronaut}    Mission day: {r.day}",
        f"Overall: {LEVEL_NAME[r.overall].upper()}",
        "",
    ]
    for s in SYSTEMS:
        sr = r.systems[s]
        lines.append(f"{s}: {LEVEL_NAME[sr.level]}")
        for mr in sr.metrics:
            m = mr.metric
            lines.append(f"  - {m.label}: {fmt(mr.value, m.key)}{'' if m.unit == '%' else ' '}{m.unit} "
                         f"(your normal {fmt(mr.mean, m.key)} ± {fmt(mr.std, m.key)})")
        if s == "Mood" and r.top_emotions:
            lines.append(f"  - Today's emotion check (top 2): {r.top_emotions}")
        if "mission_total_msv" in sr.extra:
            lines.append(f"  - Mission total: {sr.extra['mission_total_msv']:.0f} mSv "
                         f"({sr.extra['pct_career_limit']:.0f}% of NASA's {CAREER_LIMIT_MSV} mSv career limit)")
        lines.append(f"  Next step: {sr.action}")
        lines.append("")
    lines.append("Pattern check (Isolation Forest): "
                 + ("UNUSUAL day for this astronaut" if r.unusual else "normal pattern")
                 + f" (score {r.pattern_score:.2f}, threshold {r.pattern_threshold:.2f})")
    lines += ["", "Prototype for NASA Space Apps 2026 - not a medical device."]
    return "\n".join(lines)
