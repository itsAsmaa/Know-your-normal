import { downloadCsv } from '../lib/browser';
import { LEVEL_NAME, SYSTEMS } from '../lib/engine';
import type { DayResult } from '../lib/engine';
import { ChartCard, StatusChip } from './ui';

interface Props { results: DayResult[]; selected: string; onSelect: (name: string) => void; day: number }

export const initials = (name: string) => name.split(' ').slice(-1)[0][0];

export function CrewTable({ results, selected, onSelect, day }: Props) {
  return (
    <ChartCard
      eyebrow={`Selected replay day ${day} · each person vs. their own baseline`}
      title="Crew status at a glance"
      onCsv={() => downloadCsv(`crew-comparison-day-${day}.csv`, results.map((r) => ({
        astronaut: r.astronaut, mission_day: r.day, overall: LEVEL_NAME[r.overall],
        ...Object.fromEntries(SYSTEMS.map((s) => [s, LEVEL_NAME[r.systems[s].level]])),
        pattern_check: r.unusual ? 'Unusual' : 'Normal', synthetic: true,
      })))}
    >
      <div className="table-scroll">
        <table className="crew-table">
          <thead>
            <tr>
              <th scope="col">Crew member</th>
              {SYSTEMS.map((s) => <th key={s} scope="col">{s}</th>)}
              <th scope="col">Pattern</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.astronaut} className={r.astronaut === selected ? 'is-selected' : ''}>
                <th scope="row">
                  <button type="button" className="crew-name" onClick={() => onSelect(r.astronaut)}
                    aria-current={r.astronaut === selected ? 'true' : undefined}>
                    <span className="avatar">{initials(r.astronaut)}</span>
                    <span>{r.astronaut}<span className="muted small"> · day {r.day}</span></span>
                  </button>
                </th>
                {SYSTEMS.map((s) => <td key={s}><StatusChip level={r.systems[s].level} compact /></td>)}
                <td><span className={`pattern-tag ${r.unusual ? 'is-unusual' : ''}`}>{r.unusual ? 'Unusual' : 'Normal'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
