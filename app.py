"""Know Your Normal: Streamlit host for the web dashboard.

Shows the React dashboard (built into one file at dashboard/index.html with
`npm run build:streamlit`) as a full-page Streamlit app. The original Python
Streamlit prototype is still here: `streamlit run prototype_app.py`.

Synthetic demo data. Prototype, not a medical device or clinical guidance.
Not affiliated with or endorsed by NASA.

SI note: written with help from Claude (Anthropic), an SI tool, for NASA Space Apps 2026.
"""
from pathlib import Path

import streamlit as st

st.set_page_config(
    page_title="Know Your Normal · Crew Health Simulation (Prototype)",
    page_icon="🛰️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Let the dashboard fill the whole browser window.
st.markdown(
    """
    <style>
      header[data-testid="stHeader"], [data-testid="stToolbar"], footer { display: none !important; }
      [data-testid="stMainBlockContainer"], .block-container { padding: 0 !important; max-width: 100% !important; }
      [data-testid="stAppViewContainer"] > section, [data-testid="stMain"] { padding: 0 !important; }
      [data-testid="stVerticalBlock"] { gap: 0 !important; }
      iframe { display: block; width: 100% !important; height: 100vh !important; border: 0; }
    </style>
    """,
    unsafe_allow_html=True,
)

DASHBOARD = Path(__file__).parent / "dashboard" / "index.html"
if hasattr(st, "iframe"):
    st.iframe(DASHBOARD, height=900)
else:  # older Streamlit versions
    import streamlit.components.v1 as components
    components.html(DASHBOARD.read_text(encoding="utf-8"), height=900, scrolling=True)
