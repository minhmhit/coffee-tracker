import { NoaaOniAdapter } from '../adapters/noaa-oni.adapter';
import { OpenMeteoAdapter } from '../adapters/open-meteo.adapter';

describe('Monthly Climate Ingestion Suite (Step 1.3)', () => {
  describe('1. NoaaOniAdapter', () => {
    let adapter: NoaaOniAdapter;

    beforeEach(() => {
      adapter = new NoaaOniAdapter();
    });

    it('should parse NOAA ASCII format with correct season-to-month mapping', () => {
      const sampleAscii = `
 SEAS  YR   TOTAL   ANOM
  DJF 2024  28.15   1.85
  JFM 2024  28.20   1.54
  FMA 2024  28.25   1.12
  MAM 2024  28.10   0.75
  AMJ 2024  27.90   0.38
  MJJ 2024  27.60   0.12
  JJA 2024  27.20  -0.10
  JAS 2024  26.80  -0.25
  ASO 2024  26.50  -0.35
  SON 2024  26.30  -0.45
  OND 2024  26.15  -0.52
  NDJ 2024  26.05  -0.58
      `;

      const records = adapter.parseAscii(sampleAscii);

      expect(records.length).toBe(12);

      // Check month 1 (DJF)
      expect(records[0]).toEqual({
        monthDate: '2024-01-01',
        season: 'DJF',
        year: 2024,
        totalSst: 28.15,
        oniIndex: 1.85,
      });

      // Check month 6 (MJJ)
      expect(records[5]).toEqual({
        monthDate: '2024-06-01',
        season: 'MJJ',
        year: 2024,
        totalSst: 27.60,
        oniIndex: 0.12,
      });

      // Check month 12 (NDJ)
      expect(records[11]).toEqual({
        monthDate: '2024-12-01',
        season: 'NDJ',
        year: 2024,
        totalSst: 26.05,
        oniIndex: -0.58,
      });
    });

    it('should ignore header lines, comments, and empty lines', () => {
      const dirtyAscii = `
# Some NOAA comment
 SEAS  YR   TOTAL   ANOM

  DJF 2023  26.40  -0.42

INVALID_LINE
      `;

      const records = adapter.parseAscii(dirtyAscii);
      expect(records.length).toBe(1);
      expect(records[0].monthDate).toBe('2023-01-01');
      expect(records[0].oniIndex).toBe(-0.42);
    });
  });

  describe('2. OpenMeteoAdapter', () => {
    let adapter: OpenMeteoAdapter;

    beforeEach(() => {
      adapter = new OpenMeteoAdapter();
    });

    it('should aggregate daily precipitation into monthly sums', () => {
      const dates = [
        '2024-01-01',
        '2024-01-15',
        '2024-01-31',
        '2024-02-05',
        '2024-02-28',
      ];
      const precipitations = [10.5, 5.0, 4.5, 20.0, 30.2];

      const monthlySums = adapter.aggregateMonthlySums(dates, precipitations);

      expect(monthlySums.get('2024-01-01')).toBe(20.0);
      expect(monthlySums.get('2024-02-01')).toBe(50.2);
    });

    it('should compute baseline climatology means (2010–2020) per month', () => {
      const monthlySums = new Map<string, number>();

      // Two years for month 1 (Jan): 100mm and 200mm -> baseline mean should be 150mm
      monthlySums.set('2010-01-01', 100);
      monthlySums.set('2011-01-01', 200);

      // Two years for month 2 (Feb): 50mm and 70mm -> baseline mean should be 60mm
      monthlySums.set('2010-02-01', 50);
      monthlySums.set('2011-02-01', 70);

      // Outside baseline period (2024) -> should be excluded from baseline
      monthlySums.set('2024-01-01', 500);

      const baselineMeans = adapter.computeBaselineMeans(monthlySums, 2010, 2020);

      expect(baselineMeans.get(1)).toBe(150.0);
      expect(baselineMeans.get(2)).toBe(60.0);
      expect(baselineMeans.get(3)).toBe(0); // No data for March
    });

    it('should correctly compute rainfall anomalies against baseline', () => {
      const monthlySums = new Map<string, number>();
      monthlySums.set('2024-01-01', 180.0); // Actual 180mm
      monthlySums.set('2024-02-01', 30.0); // Actual 30mm (drought)

      const baselineMeans = new Map<number, number>();
      baselineMeans.set(1, 150.0); // Baseline Jan: 150mm -> Anomaly: +30mm
      baselineMeans.set(2, 60.0); // Baseline Feb: 60mm -> Anomaly: -30mm

      const anomalies = adapter.computeAnomalies(monthlySums, baselineMeans, 2018);

      expect(anomalies.get('2024-01-01')).toBe(30.0);
      expect(anomalies.get('2024-02-01')).toBe(-30.0);
    });
  });
});
