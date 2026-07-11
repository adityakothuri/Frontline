// A calm, time-aware greeting for the personalized home screen. Pure and
// testable — pass a date to check boundaries; defaults to now.
export function timeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
