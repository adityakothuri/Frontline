import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptics that can never throw: a build without the native
 * module returns a rejected promise, so both throws and rejections disable it.
 */
let unavailable = false;

function fire(run: () => Promise<void>): void {
  if (unavailable) return;
  try {
    run().catch(() => {
      unavailable = true;
    });
  } catch {
    unavailable = true;
  }
}

/** A selection tick, for choosing from a set (a pin, a category chip). */
export function tapSelection(): void {
  fire(() => Haptics.selectionAsync());
}

/** A light impact: something arrived somewhere (a sheet landing on a detent). */
export function tapImpact(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
