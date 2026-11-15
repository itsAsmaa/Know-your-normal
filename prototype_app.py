"""Know Your Normal: original Python Streamlit prototype.

Run:  streamlit run prototype_app.py

SI note: written with help from Claude (Anthropic), an SI tool, for NASA Space Apps 2026.
"""
import altair as alt
import pandas as pd
import streamlit as st

from engine import (CALIBRATION_DAYS, CAREER_LIMIT_MSV, LEVEL_ICON, LEVEL_NAME,
                    METRIC, METRICS, SYSTEM_ICON, SYSTEMS, analyze, evaluate, fmt,
                    report_text)
from generate_data import EMOTIONS, OUT as DATA_PATH, generate, save

st.set_page_config(page_title="Know Your Normal", page_icon="🛰️", layout="wide")

BADGE_COLOR = {0: "green", 1: "orange", 2: "red"}

# Emotion check (from Asmaa's graduation project): 8 emotions -> 3 groups.
EMO_COLS = [f"emo_{e}" for e in EMOTIONS]
EMO_GROUP = {"neutral": "Neutral & calm", "calm": "Neutral & calm",
             "happy": "Positive", "surprised": "Positive",
             "sad": "Negative", "angry": "Negative", "fearful": "Negative", "disgust": "Negative"}
GROUPS = ["Negative", "Neutral & calm", "Positive"]          # stack order, negative on the baseline
GROUP_RANGE = ["#eb6834", "#2a78d6", "#1baf7a"]              # validated categorical slots


# --------------------------------------------------------------------------- #
# Data
# --------------------------------------------------------------------------- #
@st.cache_data
def load_data() -> pd.DataFrame:
    if not DATA_PATH.exists():
        save(generate())
    return pd.read_csv(DATA_PATH)


@st.cache_resource(show_spinner=False)
def get_analysis(person: pd.DataFrame, name: str):
    return analyze(person, name)


if "log" not in st.session_state:
    st.session_state.log = load_data()


def add_checkin(name: str, new_day: int) -> None:
    """Form callback: append today's check-in and jump to that day."""
    row = {"astronaut": name, "mission_day": new_day}
    for m in METRICS:
        row[m.key] = st.session_state[f"in_{name}_{m.key}"]
    st.session_state.log = pd.concat(
        [st.session_state.log, pd.DataFrame([row])], ignore_index=True)
    st.session_state.day = new_day
    st.session_state.flash = f"Check-in saved for {name}, mission day {new_day}."


log: pd.DataFrame = st.session_state.log

# --------------------------------------------------------------------------- #
# Sidebar
# --------------------------------------------------------------------------- #
with st.sidebar:
    st.header("🛰️ Crew")
    astronauts = sorted(log["astronaut"].unique())
    name = st.selectbox("Astronaut", astronauts, key="astronaut")
    person = log[log["astronaut"] == name].reset_index(drop=True)
    max_day = int(person["mission_day"].max())
    if st.session_state.get("day") is None or st.session_state.day > max_day:
        st.session_state.day = max_day
    day = st.slider("Mission day", CALIBRATION_DAYS + 1, max_day, key="day",
                    help="Slide back to replay the mission as the astronaut saw it.")
    st.caption(f"Days 1–{CALIBRATION_DAYS} are used to learn {name}'s normal.")

a = get_analysis(person, name)
r = evaluate(a, day)

with st.sidebar:
    st.download_button(
        "📄 Download report for the flight surgeon", report_text(r),
        file_name=f"status_{name.replace('. ', '_').replace(' ', '_')}_day{r.day}.txt",
        on_click="ignore", width="stretch")
    st.divider()
    st.caption("Simulated data for the NASA Space Apps 2026 demo. "
               "Prototype only, not a medical device.")

if msg := st.session_state.pop("flash", None):
    st.toast(msg, icon="✅")

# --------------------------------------------------------------------------- #
# Header + overall status
# --------------------------------------------------------------------------- #
st.title("🛰️ Know Your Normal")
st.caption("A daily health self-check for long-duration missions. Each astronaut is "
           "compared with **their own normal**, learned from their first "
           f"{CALIBRATION_DAYS} mission days, not with an average person.")

watch = [s for s in SYSTEMS if r.systems[s].level == 1]
act = [s for s in SYSTEMS if r.systems[s].level == 2]
if r.overall == 0:
    st.success(f"**{name}, mission day {r.day}: everything is within your normal.**", icon="🟢")
elif r.overall == 1:
    st.warning(f"**{name}, mission day {r.day}: keep an eye on {', '.join(watch)}.**", icon="🟡")
else:
    extra = f" Keep an eye on {', '.join(watch)}." if watch else ""
    st.error(f"**{name}, mission day {r.day}: act today on {', '.join(act)}.**{extra}", icon="🔴")

if r.unusual:
    drivers = ", ".join(f"{METRIC[k].label.lower()} ({z:+.1f} SD)" for k, z in r.drivers)
    st.info(f"**Pattern check:** today's combination of readings is unusual for {name}."
            + (f" Most different from normal: {drivers}." if drivers else ""), icon="🧩")
else:
    st.caption(f"🧩 Pattern check: today's combination of readings looks normal for {name}.")

# --------------------------------------------------------------------------- #
# Status cards
# --------------------------------------------------------------------------- #
st.caption("Values are 3-day averages (temperature and radiation: today's reading).")
for row_systems in (SYSTEMS[:3], SYSTEMS[3:]):
    for col, s in zip(st.columns(3), row_systems):
        sr = r.systems[s]
        with col.container(border=True):
            st.markdown(f"#### {SYSTEM_ICON[s]} {s}")
            st.badge(LEVEL_NAME[sr.level], icon=LEVEL_ICON[sr.level], color=BADGE_COLOR[sr.level])
            for mr in sr.metrics:
                m = mr.metric
                arrow = " ▲" if mr.z >= 2 else " ▼" if mr.z <= -2 else ""
                sep = "" if m.unit == "%" else " "
                st.markdown(f"{m.label}: **{fmt(mr.value, m.key)}{sep}{m.unit}{arrow}**  \n"
                            f":gray[your normal {fmt(mr.mean, m.key)} ± {fmt(mr.std, m.key)}]")
            if s == "Mood" and r.top_emotions:
                st.markdown(f"Today's emotion check: **{r.top_emotions}**")
            if "mission_total_msv" in sr.extra:
                st.markdown(f"Mission total: **{sr.extra['mission_total_msv']:.0f} mSv**  \n"
                            f":gray[{sr.extra['pct_career_limit']:.0f}% of NASA's "
                            f"{CAREER_LIMIT_MSV} mSv career limit]")
            st.markdown(f"**Next step:** {sr.action}")

# --------------------------------------------------------------------------- #
# Tabs
# --------------------------------------------------------------------------- #
tab_trends, tab_emotion, tab_pattern, tab_log, tab_crew, tab_about = st.tabs(
    ["📈 Trends", "🎭 Emotion check", "🧩 Pattern check", "📝 Log today's check-in",
     "👩‍🚀 Crew board", "ℹ️ How it works"])


def first_flag_day(key: str) -> int | None:
    """First mission day (up to the selected day) a single reading left the normal range."""
    system = METRIC[key].system
    for d in range(CALIBRATION_DAYS + 1, day + 1):
        mr = next(x for x in evaluate(a, d).systems[system].metrics if x.metric.key == key)
        if mr.level >= 1:
            return d
    return None


def trend_chart(key: str) -> alt.LayerChart:
    m = METRIC[key]
    mean, std = a.base.loc[key, "mean"], a.base.loc[key, "std"]
    d = (a.person[a.person["mission_day"] <= day][["mission_day", key]]
         .rename(columns={key: "value"}))
    d["lo"], d["hi"] = mean - 2 * std, mean + 2 * std
    x = alt.X("mission_day:Q", title=None, scale=alt.Scale(domain=[1, day]))
    y_scale = alt.Scale(zero=False)
    calib = (alt.Chart(pd.DataFrame({"start": [1], "end": [CALIBRATION_DAYS]}))
             .mark_rect(color="#9e9e9e", opacity=0.15)
             .encode(x="start:Q", x2="end:Q"))
    band = (alt.Chart(d).mark_area(color="#43a047", opacity=0.2)
            .encode(x=x, y=alt.Y("lo:Q", title=None, scale=y_scale), y2="hi:Q"))
    line = (alt.Chart(d).mark_line(color="#1e88e5")
            .encode(x=x, y=alt.Y("value:Q", title=None, scale=y_scale),
                    tooltip=[alt.Tooltip("mission_day:Q", title="Day"),
                             alt.Tooltip("value:Q", title=m.label)]))
    today = (alt.Chart(d.tail(1)).mark_point(color="#e53935", filled=True, size=70)
             .encode(x=x, y="value:Q"))
    return alt.layer(calib, band, line, today).properties(
        title=f"{m.label} ({m.unit}) by mission day", height=240)


with tab_trends:
    st.caption("Green band = your normal range (±2 SD). Grey area = calibration days. "
               "Red dot = the selected day.")
    keys = [m.key for m in METRICS]
    for i in range(0, len(keys), 2):
        for col, key in zip(st.columns(2), keys[i:i + 2]):
            col.altair_chart(trend_chart(key), width="stretch")

with tab_emotion:
    st.markdown(
        "**From Asmaa's graduation project.** Each day the astronaut records a short check-in. "
        "The real-time emotion analyzer from Asmaa's Birzeit University graduation project "
        "(ENCS5300) estimates eight emotions: neutral, calm, happy, sad, angry, fearful, disgust "
        "and surprised. The share of negative emotions is compared with the astronaut's own "
        "normal, next to their self-rated mood, so the app can catch a change even when "
        "someone says they're fine.")
    emo = a.person[a.person["mission_day"] <= day].dropna(subset=EMO_COLS)
    if emo.empty:
        st.info("No emotion checks recorded yet.")
    else:
        emo_day, mood_day = first_flag_day("negative_emotion_pct"), first_flag_day("mood")
        if emo_day and mood_day and emo_day < mood_day:
            st.success(f"**Early warning:** the emotion check flagged a change on day {emo_day}, "
                       f"{mood_day - emo_day} days before {name}'s self-rated mood did "
                       f"(day {mood_day}).", icon="⏱️")
        elif emo_day and not mood_day:
            st.success(f"**Early warning:** the emotion check flagged a change on day {emo_day}. "
                       f"{name}'s self-rated mood hasn't flagged anything yet.", icon="⏱️")

        color = alt.Color("group:N", title=None,
                          scale=alt.Scale(domain=GROUPS, range=GROUP_RANGE),
                          legend=alt.Legend(orient="top"))
        long = emo.melt(id_vars="mission_day", value_vars=EMO_COLS,
                        var_name="emotion", value_name="share")
        long["group"] = long["emotion"].str.removeprefix("emo_").map(EMO_GROUP)
        grouped = long.groupby(["mission_day", "group"], as_index=False)["share"].sum()
        grouped["order"] = grouped["group"].map({g: i for i, g in enumerate(GROUPS)})
        mix_chart = alt.Chart(grouped).mark_area(opacity=0.9).encode(
            x=alt.X("mission_day:Q", title="Mission day", scale=alt.Scale(domain=[1, day])),
            y=alt.Y("share:Q", stack="normalize", title="Share of daily check-in",
                    axis=alt.Axis(format="%")),
            color=color, order=alt.Order("order:Q"),
            tooltip=[alt.Tooltip("mission_day:Q", title="Day"),
                     alt.Tooltip("group:N", title="Emotions"),
                     alt.Tooltip("share:Q", title="Share", format=".0%")],
        ).properties(title="Emotion mix from daily check-ins", height=280)

        today_row = emo.iloc[-1]
        mix = pd.DataFrame({"emotion": EMOTIONS,
                            "share": [float(today_row[c]) for c in EMO_COLS]})
        mix["group"] = mix["emotion"].map(EMO_GROUP)
        bars = alt.Chart(mix).mark_bar(cornerRadiusEnd=4, size=16).encode(
            x=alt.X("share:Q", title="Share", axis=alt.Axis(format="%")),
            y=alt.Y("emotion:N", sort="-x", title=None),
            color=alt.Color("group:N", scale=alt.Scale(domain=GROUPS, range=GROUP_RANGE),
                            legend=None),
            tooltip=[alt.Tooltip("emotion:N", title="Emotion"),
                     alt.Tooltip("share:Q", title="Share", format=".0%")],
        ).properties(title=f"Day {int(today_row['mission_day'])} check-in", height=280)

        left, right = st.columns([2, 1])
        left.altair_chart(mix_chart, width="stretch")
        right.altair_chart(bars, width="stretch")
        with st.expander("Show emotion mix as a table"):
            table = (grouped.pivot(index="mission_day", columns="group", values="share")[GROUPS]
                     .mul(100).round(0).rename_axis("Mission day").reset_index())
            st.dataframe(table, hide_index=True, width="stretch")
    st.caption("Demo: the analyzer's outputs are simulated. The real analyzer is an SVM + "
               "Random Forest ensemble on MFCC, chroma and mel-spectrogram features, trained "
               "on RAVDESS (83.7% accuracy on 8 emotions). Its face module is built and ready "
               "to switch on.")

with tab_pattern:
    st.markdown(
        f"An **Isolation Forest** learns how {name}'s {len(METRICS)} readings usually fit together "
        f"during the calibration days. It scores every day by how unusual the whole "
        f"combination looks, so it can catch a problem even when no single number "
        f"crosses a line. Days above the dashed line are flagged.")
    p = a.pattern[a.pattern["mission_day"] <= day]
    pc = alt.Chart(p).encode(x=alt.X("mission_day:Q", title="Mission day"))
    chart = alt.layer(
        pc.mark_line(color="#5e35b1").encode(
            y=alt.Y("score:Q", title="Unusualness score", scale=alt.Scale(zero=False))),
        pc.transform_filter("datum.unusual").mark_point(color="#e53935", filled=True, size=70)
          .encode(y="score:Q", tooltip=[alt.Tooltip("mission_day:Q", title="Unusual day")]),
        alt.Chart(pd.DataFrame({"t": [a.threshold]}))
           .mark_rule(color="#e53935", strokeDash=[5, 4]).encode(y="t:Q"),
    ).properties(height=260)
    st.altair_chart(chart, width="stretch")
    flagged_days = p.loc[p["unusual"], "mission_day"].tolist()
    st.write("Unusual days so far: " + (", ".join(map(str, flagged_days)) if flagged_days else "none"))

with tab_log:
    new_day = max_day + 1
    normal = a.base["mean"]
    with st.form("checkin"):
        st.markdown(f"**Log mission day {new_day} for {name}.** "
                    "Fields start at your normal values. Change what's different today.")
        c1, c2 = st.columns(2)
        c1.number_input("Resting heart rate (bpm)", 30, 200, int(round(normal["resting_hr"])),
                        key=f"in_{name}_resting_hr")
        c1.number_input("Heart rate variability (ms)", 5, 200, int(round(normal["hrv_ms"])),
                        key=f"in_{name}_hrv_ms")
        c1.number_input("Systolic blood pressure (mmHg)", 70, 220, int(round(normal["systolic_bp"])),
                        key=f"in_{name}_systolic_bp")
        c1.number_input("Exercise (min)", 0, 300, int(round(normal["exercise_min"])),
                        key=f"in_{name}_exercise_min")
        c1.number_input("Negative emotions from emotion check (%)", 0.0, 100.0,
                        float(round(normal["negative_emotion_pct"])), 1.0, format="%.0f",
                        key=f"in_{name}_negative_emotion_pct",
                        help="Filled in by the emotion analyzer from your daily check-in. "
                             "Editable for the demo.")
        c2.number_input("Sleep (h)", 0.0, 14.0, round(float(normal["sleep_h"]), 1), 0.1,
                        format="%.1f", key=f"in_{name}_sleep_h")
        c2.slider("Mood (1 = very low, 5 = great)", 1, 5, int(round(normal["mood"])),
                  key=f"in_{name}_mood")
        c2.number_input("Body temperature (°C)", 34.0, 42.0, round(float(normal["body_temp_c"]), 1),
                        0.1, format="%.1f", key=f"in_{name}_body_temp_c")
        c2.number_input("Radiation dose from dosimeter (mSv/day)", 0.0, 300.0,
                        round(float(normal["radiation_msv"]), 2), 0.01, format="%.2f",
                        key=f"in_{name}_radiation_msv")
        st.form_submit_button("Save check-in", type="primary",
                              on_click=add_checkin, args=(name, new_day))

with tab_crew:
    st.caption("The whole crew at a glance on the selected mission day.")
    board = []
    for other in astronauts:
        op = log[log["astronaut"] == other].reset_index(drop=True)
        orr = evaluate(get_analysis(op, other), min(day, int(op["mission_day"].max())))
        board.append({"Astronaut": other, "Day": orr.day,
                      **{s: LEVEL_ICON[orr.systems[s].level] for s in SYSTEMS},
                      "Pattern": "🧩 unusual" if orr.unusual else "normal"})
    st.dataframe(pd.DataFrame(board), hide_index=True, width="stretch")

with tab_about:
    st.markdown(f"""
**The problem.** On long missions, astronauts carry much of the responsibility for spotting
health changes in themselves. Normal ranges built from average people miss changes that
are small for the population but big for one person.

**What the app does**
1. **Gathers** a short daily check-in: heart rate, heart rate variability, blood pressure,
   sleep, mood, exercise, body temperature and dosimeter reading, plus an **emotion check**
   from the real-time emotion analyzer built in Asmaa's graduation project (Birzeit
   University, ENCS5300), which estimates eight emotions from the check-in.
2. **Learns each astronaut's normal** from their first {CALIBRATION_DAYS} mission days
   (average and usual spread of every reading).
3. **Rule check:** compares the last 3 days with that normal. Yellow (Watch) at 2 SD,
   red (Act now) at 3 SD, or when two readings in the same body system drift together.
   Fever (≥ 38 °C) and radiation spikes (≥ 4× normal dose rate) are red right away.
4. **Pattern check:** an Isolation Forest trained on the astronaut's own normal days
   flags days whose overall combination of readings is unusual.
5. **Tells them what to do:** every status comes with a plain next step and a report
   they can send to the flight surgeon.

**Body systems covered:** heart (cardiovascular events), bone & muscle (exercise as the
countermeasure for bone loss), sleep and mood (behavioral health: self-rated mood plus the
share of negative emotions from the emotion check), immune (fever), and
radiation (dose-rate spikes and the mission total against NASA's {CAREER_LIMIT_MSV} mSv
career limit in NASA-STD-3001).

**Data.** The demo uses simulated data for a 3-person crew over 90 days, with planted
problems: a heart-rate drift, isolation stress with poor sleep and missed exercise,
a fever, and a solar particle event.

**Use of SI.** We used Claude (Anthropic), an SI tool, to help write the code, the
simulated data generator and the text. See the README for details.
""")
