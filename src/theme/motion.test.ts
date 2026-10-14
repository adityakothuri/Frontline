import { describe, expect, it } from 'vitest';
import {
  durations,
  loops,
  springs,
  stagger,
  rise,
  pressScale,
  timings,
  MIN_DAMPING_RATIO,
} from './motion';

/**
 * The motion scale makes promises that are cheap to check and expensive to
 * notice by eye. The important one is the damping floor: "no bounce/elastic
 * easing" is a rule in `docs/obsidian/02 Design/Anti-AI-Slop Design Rules.md`,
 * and a rule enforced only by taste is a rule that erodes. Here it is a number.
 *
 * Peak overshoot for a damping ratio z is exp(-pi*z / sqrt(1 - z^2)).
 */

const peakOvershoot = (z: number) => (z >= 1 ? 0 : Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z)));

describe('springs', () => {
  it('are damped hard enough that no overshoot is visible', () => {
    for (const [name, spring] of Object.entries(springs)) {
      expect(
        spring.dampingRatio,
        `${name} is bouncier than the design rules allow`,
      ).toBeGreaterThanOrEqual(MIN_DAMPING_RATIO);
    }
  });

  it('overshoot stays sub-pixel over our longest travel', () => {
    // The furthest anything springs is `rise.lg` (24pt). At 3x, one device pixel
    // is 1/3 pt, so overshoot has to stay under that to be genuinely invisible.
    for (const [name, spring] of Object.entries(springs)) {
      const overshootPt = peakOvershoot(spring.dampingRatio) * rise.lg;
      expect(overshootPt, `${name} overshoots by ${overshootPt.toFixed(3)}pt`).toBeLessThan(1 / 3);
    }
  });

  it('are quick enough not to hold up an interaction', () => {
    for (const [name, spring] of Object.entries(springs)) {
      expect(spring.duration, `${name} outlasts the entrance budget`).toBeLessThanOrEqual(
        durations.entrance,
      );
    }
  });
});

describe('durations', () => {
  it('form a strictly ascending scale', () => {
    const values = Object.values(durations);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i], `step ${i} does not grow`).toBeGreaterThan(values[i - 1]);
    }
  });

  it('keep loop legs off the entrance scale, so the two are never confused', () => {
    // A loop is the texture of a wait, not an entrance. Sharing a number would
    // invite reusing one where the other is meant.
    for (const [name, leg] of Object.entries(loops)) {
      expect(Object.values(durations), `${name} collides with the duration scale`).not.toContain(
        leg,
      );
    }
  });
});

describe('timings', () => {
  it('budgets the shield finale for longer than the finale actually takes', () => {
    // `useLoadingGate` releases content on `finaleBudget` if the mark's completion
    // callback is ever missed. Set that deadline below the real finale — the
    // outline closing and the star drawing (`micro` delay + `base`), then the exit
    // fade (`fast`) — and the backstop stops being insurance and starts cutting the
    // celebration off, on every load, silently. The two live three files apart.
    const finale = durations.micro + durations.base + durations.fast;
    expect(
      timings.finaleBudget,
      `the backstop fires ${finale - timings.finaleBudget}ms early`,
    ).toBeGreaterThanOrEqual(finale);
  });

  it('holds the launch intro for less than one lap of the shield', () => {
    // The waiting arc never resolves, so there is no frame the intro could be
    // waiting *for* — but holding past a full lap means watching the same sweep
    // twice before anything happens.
    expect(timings.introHold).toBeLessThan(loops.shieldTrace);
  });
});

describe('orchestration', () => {
  it('caps the stagger so a late sibling never lags the entrance', () => {
    // Every element must have started before the longest entrance finishes,
    // or the screen reads as still assembling after it should have settled.
    expect(stagger.max).toBeLessThan(durations.entrance);
    expect(stagger.step * stagger.listCount).toBeGreaterThan(stagger.max);
  });

  it('holds the review acknowledgement longer than the card takes to leave', () => {
    // `reviewAck` is a reading-time budget for a sentence three files away, so
    // nothing else would notice it drifting. The floor that matters: the hold has
    // to outlast the throw it precedes, or the message is still on screen — and
    // still being read — while the card slides out from under it.
    expect(timings.reviewAck).toBeGreaterThan(durations.slow);
    // And it must stay clearly longer than the purely-visual acknowledgement it
    // replaced, which is the change that made room for words at all.
    expect(timings.reviewAck).toBeGreaterThan(durations.base * 2);
  });

  it('keeps the Home entrance inside its budget', () => {
    // Home's real composition: the location pill, the greeting, then the needs
    // block, which the page hands a start two steps in and which spends two beats
    // of its own on its heading and its tab row. The review deck is deliberately
    // absent — it is data-gated, so it reveals on hydration rather than taking a
    // beat in this sequence.
    //
    // This is the guard on a regression that once ran the tail to 720ms, which is
    // why it asserts the composition rather than the tokens.
    const needsStart = stagger.step * 2;
    const starts = [
      0, // location pill
      stagger.step, // greeting
      needsStart, // "What do you need help with?"
      needsStart + stagger.step, // the tab row, as one object
    ];

    const lastStart = Math.max(...starts);
    expect(lastStart).toBeLessThanOrEqual(stagger.max);
    expect(lastStart + durations.base).toBeLessThanOrEqual(durations.entrance);
  });

  it('rises further the larger the element is', () => {
    expect(rise.sm).toBeLessThan(rise.md);
    expect(rise.md).toBeLessThan(rise.lg);
  });

  it('scales presses down, never up, and never far enough to look broken', () => {
    for (const [name, scale] of Object.entries(pressScale)) {
      expect(scale, `${name} does not scale down`).toBeLessThan(1);
      expect(scale, `${name} collapses the target`).toBeGreaterThanOrEqual(0.9);
    }
  });
});
