// Warm one-line sub-messages under the Home greeting. Picked stably per day so
// the message stays put through a session instead of reshuffling every render.
const HOME_MESSAGES = [
  'How can we help today?',
  'Ready for your benefits?',
  'Let’s find your next step.',
  'Support is closer than you think.',
  'What do you need a hand with?',
  'One step at a time — we’ve got you.',
];

/** A stable pick for the given day (defaults to today). Pure and testable. */
export function dailyHomeMessage(date = new Date()): string {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return HOME_MESSAGES[dayIndex % HOME_MESSAGES.length];
}
