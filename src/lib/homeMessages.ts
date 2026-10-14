// Warm one-line sub-messages under the Home greeting. Picked stably per day so
// the message stays put through a session instead of reshuffling every render.
//
// All statements, no questions. Two of these used to ask "How can we help
// today?" and "What do you need a hand with?" — which is the exact question the
// start card now asks in 24pt serif immediately below them. The page was asking
// twice and answering once.
const HOME_MESSAGES = [
  'Let’s find your next step.',
  'Support is closer than you think.',
  'One step at a time — we’ve got you.',
  'You’ve earned every bit of this.',
  'Let’s see what’s near you today.',
  'Whatever you need, we’ll look together.',
];

/** A stable pick for the given day (defaults to today). Pure and testable. */
export function dailyHomeMessage(date = new Date()): string {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return HOME_MESSAGES[dayIndex % HOME_MESSAGES.length];
}
