import { CALIBRATION_DAYS, CAREER_LIMIT_MSV } from '../lib/engine';

export function HowItWorks({ records, checkins }: { records: number; checkins: number }) {
  return (
    <>
      <div className="method-grid">
        <article className="card method">
          <span className="eyebrow">01 · Personal normal</span>
          <h3>Compare each person with themselves.</h3>
          <p>
            The average and usual spread (sample standard deviation) of every reading come from that crew member's first{' '}
            {CALIBRATION_DAYS} simulated mission days. A minimum spread per reading stops very steady readings from over-alerting.
          </p>
          <code>z = (reading − personal mean) / personal spread</code>
        </article>
        <article className="card method">
          <span className="eyebrow">02 · Alert rules</span>
          <h3>Watch at 2 SD. Act at 3 SD.</h3>
          <p>
            Sustained readings use the average of the last 3 days; body temperature and radiation use today's reading.
            Two readings off in the same body system raise it to Act now. Temperature: Watch at 37.5 °C (or 2.5 SD), Act at 38 °C.
          </p>
        </article>
        <article className="card method">
          <span className="eyebrow">03 · Radiation</span>
          <h3>Dose rate, recent window, mission total.</h3>
          <p>
            Watch when any of the last 3 days reaches 2× the personal normal dose rate; Act when today reaches 4×. The mission
            total is shown next to NASA's {CAREER_LIMIT_MSV} mSv career limit (NASA-STD-3001) as context only, not an exposure recommendation.
          </p>
        </article>
        <article className="card method">
          <span className="eyebrow">04 · Pattern check</span>
          <h3>Learn combinations, not one number.</h3>
          <p>
            An Isolation Forest scores how unusual each day's combination of 9 readings is for that person. The browser runs a
            deterministic TypeScript version set up like the scikit-learn model in engine.py, so scores can differ slightly from it.
          </p>
        </article>
        <article className="card method">
          <span className="eyebrow">05 · Emotion check</span>
          <h3>A second view of mood.</h3>
          <p>
            The share of negative emotions from the daily check-in sits next to self-rated mood. It stands in for the emotion
            analyzer from Asmaa's graduation project (Birzeit University, ENCS5300). Values in this demo are synthetic.
          </p>
        </article>
        <article className="card method">
          <span className="eyebrow">06 · Data & limits</span>
          <h3>Local synthetic demo, no telemetry.</h3>
          <p>
            The supplied sample has {records} simulated daily records for three crew members over 90 days, with planted scenarios.
            New check-ins ({checkins} saved here) live only in this browser's localStorage. "Reset demo data" restores the supplied sample.
          </p>
        </article>
      </div>
      <div className="callout callout-warn">
        <p>
          <strong>Prototype limitations.</strong> Not a medical device, not clinical guidance, and not an official NASA product.
          There is no live telemetry, network service or medical interpretation. The alert logic demonstrates personal-baseline
          comparison only; anyone with health concerns should talk to a qualified medical professional.
        </p>
      </div>
    </>
  );
}
