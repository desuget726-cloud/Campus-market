const sessionTimestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatSessionTimestamp(value) {
  if (!value) return 'Unavailable';

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Unavailable';

  const parts = Object.fromEntries(
    sessionTimestampFormatter.formatToParts(timestamp).map(({ type, value: partValue }) => [type, partValue]),
  );
  if (!parts.month || !parts.day || !parts.year || !parts.hour || !parts.minute || !parts.dayPeriod) {
    return 'Unavailable';
  }

  return `${parts.month} ${parts.day}, ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()}`;
}
