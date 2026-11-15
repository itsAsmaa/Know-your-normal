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
// Softer palette (muted blue, bronze accent, coral / blue / mustard emotion groups).
export const PALETTE: Record<'light' | 'dark', ChartPalette> = {
  light: {
    series: '#3d6e9c',
    band: 'rgba(61, 110, 156, 0.09)',
    bandEdge: 'rgba(61, 110, 156, 0.28)',
    calib: 'rgba(123, 138, 155, 0.10)',
    grid: '#e8edf2',
    axis: '#7b8a9b',
    today: '#b88a45',
    threshold: '#b0473d',
    flag: '#c45a4e',
    reference: '#a7b3c1',
    surface: '#ffffff',
    groups: { Negative: '#e0896b', 'Neutral & calm': '#5b8cc6', Positive: '#cda34c' },
  },
  dark: {
    series: '#7ea6d1',
    band: 'rgba(126, 166, 209, 0.13)',
    bandEdge: 'rgba(126, 166, 209, 0.32)',
    calib: 'rgba(148, 163, 184, 0.10)',
    grid: '#25344a',
    axis: '#8796a8',
    today: '#d6a965',
    threshold: '#e59a90',
    flag: '#e59a90',
    reference: '#5d6f86',
    surface: '#172233',
    groups: { Negative: '#d98a6e', 'Neutral & calm': '#7096be', Positive: '#cfae5e' },
  },
};
