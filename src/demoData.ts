import csvText from './data/crew_daily.csv?raw';
import { parseCsv } from './lib/data';

/** The 270 supplied records from data/crew_daily.csv (synthetic). */
export const DEMO_ROWS = parseCsv(csvText, 'demo');
