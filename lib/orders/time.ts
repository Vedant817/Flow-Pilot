export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function businessDateTime(instant: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function parseBusinessDateTime(date: string, time: string): Date {
  const invalid = () => Object.assign(
    new Error('Invalid order date or time'), { status: 400 }
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw invalid();
  }
  const instant = new Date(`${date}T${time}:00+05:30`);
  if (!Number.isFinite(instant.getTime())) throw invalid();
  const normalized = businessDateTime(instant);
  if (normalized.date !== date || normalized.time !== time) throw invalid();
  return instant;
}
