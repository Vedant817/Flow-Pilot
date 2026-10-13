import { businessDateTime, parseBusinessDateTime } from '../lib/orders/time';

describe('order business timestamps', () => {
  it('preserves IST date/time across the UTC midnight boundary', () => {
    const instant = parseBusinessDateTime('2026-04-01', '00:15');
    expect(instant.toISOString()).toBe('2026-03-31T18:45:00.000Z');
    expect(businessDateTime(instant)).toEqual({ date: '2026-04-01', time: '00:15' });
  });

  it.each([
    ['2026-02-29', '09:00'],
    ['2026-04-31', '09:00'],
    ['2026-01-01', '24:00'],
    ['not-a-date', '09:00'],
  ])('rejects invalid date/time %s %s instead of silently using now', (date, time) => {
    expect(() => parseBusinessDateTime(date, time)).toThrow('Invalid order date or time');
  });

  it('accepts a valid leap day', () => {
    expect(businessDateTime(parseBusinessDateTime('2028-02-29', '12:00')))
      .toEqual({ date: '2028-02-29', time: '12:00' });
  });
});
