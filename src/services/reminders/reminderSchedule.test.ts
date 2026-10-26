import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEAD,
  SLOT_BUDGET,
  isRemindable,
  planAll,
  planForReminder,
  slotCost,
  type ReminderLead,
  type ReminderPreference,
  type ReminderSnapshot,
} from './reminderSchedule';

const VA_SOURCE = 'Official VA/gov data · updated Jun 18, 2026';

function snapshot(overrides: Partial<ReminderSnapshot> = {}): ReminderSnapshot {
  return {
    name: 'Fayetteville VA Medical Center',
    hours: 'Mon-Fri 08:00-16:30',
    category: 'healthcare',
    sourceLabel: VA_SOURCE,
    capturedAt: '2026-07-30T12:00:00.000Z',
    ...overrides,
  };
}

function preference(overrides: Partial<ReminderPreference> = {}): ReminderPreference {
  return {
    resourceId: 'va-1',
    lead: DEFAULT_LEAD,
    warnBeforeClosing: false,
    enabledAt: '2026-07-30T12:00:00.000Z',
    snapshot: snapshot(),
    ...overrides,
  };
}

/** Fire slots as `weekday:hh:mm`, which is what a scheduling bug shows up in. */
const slots = (plans: { weekday: number; hour: number; minute: number }[]) =>
  plans.map(
    (p) => `${p.weekday}:${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
  );

describe('isRemindable', () => {
  it('accepts hours we can parse', () => {
    expect(isRemindable('Mon-Fri 08:00-16:30', 'healthcare')).toBe(true);
    expect(isRemindable('Sat 09:00-11:00', 'food')).toBe(true);
  });

  it('rejects unknown hours — 81% of live rows', () => {
    expect(isRemindable(null, 'food')).toBe(false);
    expect(isRemindable('by appointment only', 'food')).toBe(false);
  });

  it('rejects 24/7 lines, which have no opening to wait for', () => {
    expect(isRemindable('Mon-Sun 00:00-23:59', 'emergency')).toBe(false);
  });

  it('rejects jobs, which have no visiting hours', () => {
    expect(isRemindable('Mon-Fri 09:00-17:00', 'jobs')).toBe(false);
  });
});

describe('planForReminder — openings', () => {
  it('fires one trigger per open day, at the chosen lead', () => {
    const { open } = planForReminder(preference({ lead: 30 }));
    // Mon–Fri = expo weekdays 2–6; 08:00 minus 30 minutes = 07:30.
    expect(slots(open)).toEqual(['2:07:30', '3:07:30', '4:07:30', '5:07:30', '6:07:30']);
  });

  it('fires exactly at opening when the lead is zero', () => {
    const { open } = planForReminder(preference({ lead: 0 }));
    expect(slots(open)).toEqual(['2:08:00', '3:08:00', '4:08:00', '5:08:00', '6:08:00']);
  });

  it('walks the lead back into the previous weekday', () => {
    const pref = preference({ lead: 60, snapshot: snapshot({ hours: 'Mon 00:30-04:00' }) });
    // Monday 00:30 minus an hour is Sunday 23:30 — expo weekday 1, not weekday 0.
    expect(slots(planForReminder(pref).open)).toEqual(['1:23:30']);
  });

  it('wraps off the start of the week without going negative', () => {
    const pref = preference({ lead: 60, snapshot: snapshot({ hours: 'Sun 00:30-04:00' }) });
    // Sunday 00:30 minus an hour lands on Saturday 23:30 — the modulo case.
    expect(slots(planForReminder(pref).open)).toEqual(['7:23:30']);
  });

  it('plans nothing when the resource is not remindable', () => {
    expect(planForReminder(preference({ snapshot: snapshot({ hours: null }) })).open).toEqual([]);
    expect(
      planForReminder(preference({ snapshot: snapshot({ hours: 'Mon-Sun 00:00-23:59' }) })).open,
    ).toEqual([]);
    expect(planForReminder(preference({ snapshot: snapshot({ category: 'jobs' }) })).open).toEqual(
      [],
    );
  });

  it('collapses day groups that resolve to the same moment', () => {
    // The format permits a day to appear twice; this must not double-fire.
    const pref = preference({
      lead: 0,
      snapshot: snapshot({ hours: 'Mon-Fri 09:00-17:00; Mon 09:00-17:00' }),
    });
    expect(slots(planForReminder(pref).open)).toEqual([
      '2:09:00',
      '3:09:00',
      '4:09:00',
      '5:09:00',
      '6:09:00',
    ]);
  });

  it('uses the first opening and last closing when a day has a lunch gap', () => {
    const pref = preference({
      lead: 0,
      warnBeforeClosing: true,
      snapshot: snapshot({ hours: 'Mon 09:00-12:00; Mon 13:00-17:00' }),
    });
    const { open, close } = planForReminder(pref);
    expect(slots(open)).toEqual(['2:09:00']);
    expect(open[0].body).toContain('Open now until 5 PM');
    expect(slots(close)).toEqual(['2:16:00']); // 17:00 minus an hour
  });
});

describe('planForReminder — closing warnings', () => {
  it('is silent unless asked for', () => {
    expect(planForReminder(preference({ warnBeforeClosing: false })).close).toEqual([]);
  });

  it('fires an hour before closing on every open day', () => {
    const { close } = planForReminder(preference({ warnBeforeClosing: true }));
    expect(slots(close)).toEqual(['2:15:30', '3:15:30', '4:15:30', '5:15:30', '6:15:30']);
  });

  it('is dropped when it would land at or before opening', () => {
    // A 09:00-11:00 pantry: an hour before closing is 10:00, which is fine.
    const twoHour = preference({
      warnBeforeClosing: true,
      snapshot: snapshot({ hours: 'Sat 09:00-11:00' }),
    });
    expect(slots(planForReminder(twoHour).close)).toEqual(['7:10:00']);

    // A 09:00-10:00 window would warn at 09:00 — the moment it opens. A "closes
    // in an hour" alert that fires as the doors open is a lie, so it is dropped.
    const oneHour = preference({
      warnBeforeClosing: true,
      snapshot: snapshot({ hours: 'Sat 09:00-10:00' }),
    });
    const oneHourPlan = planForReminder(oneHour);
    expect(oneHourPlan.close).toEqual([]);
    expect(oneHourPlan.open).toHaveLength(1); // the opening still stands
  });
});

describe('notification copy', () => {
  it('states the lead, the time, the source and the hedge', () => {
    const [first] = planForReminder(preference({ lead: 30 })).open;
    expect(first.title).toBe('Fayetteville VA Medical Center');
    expect(first.body).toBe(`Opens in 30 minutes, at 8 AM. ${VA_SOURCE} — call ahead to confirm.`);
  });

  it('says "1 hour" rather than "60 minutes"', () => {
    const [first] = planForReminder(preference({ lead: 60 })).open;
    expect(first.body).toContain('Opens in 1 hour, at 8 AM.');
  });

  it('leads with the closing time on a closing warning', () => {
    const [first] = planForReminder(preference({ warnBeforeClosing: true })).close;
    expect(first.body).toBe(`Closes at 4:30 PM, in 1 hour. ${VA_SOURCE} — call ahead to confirm.`);
  });

  it('carries a stale source line through verbatim, sharpening its own hedge', () => {
    const stale = 'Directory listing · may be outdated';
    const [first] = planForReminder(
      preference({ snapshot: snapshot({ sourceLabel: stale }) }),
    ).open;
    expect(first.body).toBe(`Opens in 30 minutes, at 8 AM. ${stale} — call ahead to confirm.`);
  });

  it('carries the OpenStreetMap credit onto the lock screen, as ODbL requires', () => {
    const osm = 'Directory listing · updated Jul 12, 2026 · © OpenStreetMap contributors';
    const [first] = planForReminder(preference({ snapshot: snapshot({ sourceLabel: osm }) })).open;
    expect(first.body).toContain('© OpenStreetMap contributors');
  });

  it('never claims more certainty than the card — every body hedges', () => {
    const { open, close } = planForReminder(preference({ warnBeforeClosing: true, lead: 0 }));
    for (const plan of [...open, ...close]) {
      expect(plan.body).toContain('call ahead to confirm');
    }
  });
});

describe('slotCost', () => {
  it('counts one slot per open day, doubled by closing warnings', () => {
    expect(slotCost(preference())).toBe(5);
    expect(slotCost(preference({ warnBeforeClosing: true }))).toBe(10);
    expect(slotCost(preference({ snapshot: snapshot({ hours: 'Sat 09:00-11:00' }) }))).toBe(1);
  });

  it('is zero for a resource that cannot be reminded', () => {
    expect(slotCost(preference({ snapshot: snapshot({ hours: null }) }))).toBe(0);
  });
});

describe('planAll', () => {
  const many = (count: number, hours: string, warn = false): ReminderPreference[] =>
    Array.from({ length: count }, (_, i) =>
      preference({
        resourceId: `r-${i}`,
        warnBeforeClosing: warn,
        // Zero-padded so lexicographic ISO ordering matches arming order.
        enabledAt: `2026-07-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`,
        snapshot: snapshot({ hours }),
      }),
    );

  it('holds every reminder when there is room', () => {
    const { planned, droppedClosingFor } = planAll(many(3, 'Mon-Fri 08:00-16:30'));
    expect(planned).toHaveLength(15);
    expect(droppedClosingFor).toEqual([]);
  });

  it('never exceeds the slot budget', () => {
    const { planned } = planAll(many(20, 'Mon-Fri 08:00-16:30', true));
    expect(planned).toHaveLength(SLOT_BUDGET);
  });

  it('keeps every opening before it keeps any closing warning', () => {
    // 10 resources × 5 open days = 50 openings, then closings fill the last 6.
    const { planned } = planAll(many(10, 'Mon-Fri 08:00-16:30', true));
    const firstClose = planned.findIndex((p) => p.kind === 'close');
    expect(planned.filter((p) => p.kind === 'open')).toHaveLength(50);
    expect(planned.slice(0, firstClose).every((p) => p.kind === 'open')).toBe(true);
  });

  it('drops the newest closing warnings first, leaving older reminders whole', () => {
    const { planned, droppedClosingFor } = planAll(many(10, 'Mon-Fri 08:00-16:30', true));
    // Every opening survives, so no resource loses the reason it was set.
    for (let i = 0; i < 10; i += 1) {
      expect(planned.some((p) => p.resourceId === `r-${i}` && p.kind === 'open')).toBe(true);
    }
    // The squeeze lands on the ones armed last.
    expect(droppedClosingFor).not.toContain('r-0');
    expect(droppedClosingFor).toContain('r-9');
  });

  it('reports a closing warning dropped for being impossible, not just crowded', () => {
    const { droppedClosingFor } = planAll([
      preference({
        resourceId: 'short',
        warnBeforeClosing: true,
        snapshot: snapshot({ hours: 'Sat 09:00-10:00' }),
      }),
    ]);
    expect(droppedClosingFor).toEqual(['short']);
  });

  it('stays silent about resources that never asked for a closing warning', () => {
    const { droppedClosingFor } = planAll(many(20, 'Mon-Fri 08:00-16:30', false));
    expect(droppedClosingFor).toEqual([]);
  });

  it('ignores reminders whose resource stopped being remindable', () => {
    const { planned, droppedClosingFor } = planAll([
      preference({
        resourceId: 'gone',
        warnBeforeClosing: true,
        snapshot: snapshot({ hours: null }),
      }),
    ]);
    expect(planned).toEqual([]);
    expect(droppedClosingFor).toEqual([]);
  });

  it('gives every planned trigger a key unique across the device', () => {
    const { planned } = planAll(many(6, 'Mon-Fri 08:00-16:30', true));
    expect(new Set(planned.map((p) => p.key)).size).toBe(planned.length);
  });
});

describe('lead options', () => {
  it('defaults to 30 minutes — enough time to actually travel', () => {
    expect(DEFAULT_LEAD).toBe(30);
  });

  it('only offers leads the planner understands', () => {
    const leads: ReminderLead[] = [0, 15, 30, 60];
    for (const lead of leads) {
      expect(planForReminder(preference({ lead })).open).toHaveLength(5);
    }
  });
});
