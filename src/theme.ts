export interface ChartPalette {
  series: string;
  band: string;
  bandEdge: string;
  calib: string;
  grid: string;
  axis: string;
  today: string;
  threshold: string;
  flag: string;
  reference: string;
  surface: string;
  groups: Record<'Negative' | 'Neutral & calm' | 'Positive', string>;
}

// Categorical slots from the validated reference palette (light / dark steps).
export const PALETTE: Record<'light' | 'dark', ChartPalette> = {
  light: {
    series: '#2a78d6',
    band: 'rgba(42, 120, 214, 0.11)',
    bandEdge: 'rgba(42, 120, 214, 0.35)',
    calib: 'rgba(100, 116, 139, 0.12)',
    grid: '#e3e8ef',
    axis: '#5f6c82',
    today: '#d97706',
    threshold: '#c0392b',
    flag: '#e34948',
    reference: '#94a3b8',
    surface: '#ffffff',
    groups: { Negative: '#eb6834', 'Neutral & calm': '#2a78d6', Positive: '#1baf7a' },
  },
  dark: {
    series: '#3987e5',
    band: 'rgba(57, 135, 229, 0.18)',
    bandEdge: 'rgba(57, 135, 229, 0.45)',
    calib: 'rgba(148, 163, 184, 0.13)',
    grid: '#22324b',
    axis: '#93a3ba',
    today: '#f0a54a',
    threshold: '#e66767',
    flag: '#e66767',
    reference: '#64748b',
    surface: '#111c2e',
    groups: { Negative: '#d95926', 'Neutral & calm': '#3987e5', Positive: '#199e70' },
  },
};
