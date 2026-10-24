// The motion scale. Kept free of Reanimated so vitest (plain node) can import it;
// the easing curves live in `motionPresets.ts`.

// Six steps, each roughly x1.33. More travel earns more time.
export const durations = {
  /** A state flip that must feel instantaneous — press feedback, a glyph swap. */
  micro: 120,
  /** One small element crossfading in place — a label, a pill, an icon. */
  fast: 180,
  /** The default. One element entering or leaving over ~8pt. */
  base: 240,
  /** A panel, a sheet, a bar filling — something with real travel. */
  slow: 320,
  /** A screen-level reveal, once the data it was waiting on has landed. */
  reveal: 420,
  /** A whole orchestrated entrance, first element's start to last one's end. */
  entrance: 560,
} as const;

// Loop legs sit deliberately off the scale above: a loop is the texture of a
// wait, not an entrance.
export const loops = {
  /** One leg of the skeleton pulse (1 <-> 0.45). */
  pulseLeg: 600,
  /** One lap of the travelling arc around the shield outline. */
  shieldTrace: 1400,
} as const;

// Not animations: decisions about how long to wait, hold, or let the native map fly.
export const timings = {
  /** How long a load must run before the shield is worth showing. */
  loadingQuiet: 500,
  /**
   * Deadline on which `useLoadingGate` releases the screen if the shield's
   * completion callback is missed. Must outlast the real finale
   * (`micro` + `base` + `fast`); `motion.test.ts` asserts it.
   */
  finaleBudget: 720,
  /** Launch intro: a beat of the shield's sweep before the finale. */
  introHold: 400,
  /**
   * How long the Home review card holds after a vote before it is thrown away.
   * It carries a nine-word sentence, which needs ~1.3s to read at ~200wpm.
   */
  reviewAck: 1400,
  /**
   * How long a laid-out map may go without `onMapReady` before its paper veil
   * lifts anyway. Only the veil: markers and camera commands still wait for
   * `onMapReady`, because on Android a marker added earlier is a native crash.
   */
  mapReadyBudget: 800,
  /**
   * How long Ask Frontline's bubble says "Thinking…" before its label changes
   * (and, at twice this, says "Almost there…"). A static label past ~4s reads
   * as a hang.
   */
  askPatience: 4000,
  /** MapKit camera glide to a focused pin. */
  mapFocus: 350,
  /** MapKit camera glide for one zoom step. */
  mapZoom: 180,
  /** How long a map pin keeps re-rasterizing before its bitmap freezes. */
  pinRaster: 600,
} as const;

// Damped, never bouncy: at 0.92 the peak overshoot over our longest travel
// (24pt) is sub-pixel. `motion.test.ts` enforces the floor below.
export const springs = {
  /** Press feedback. Critically damped: a dead stop, no wobble at all. */
  press: { duration: 220, dampingRatio: 1 },
  /** An element settling into its final place. A hair of life. */
  settle: { duration: 420, dampingRatio: 0.92 },
  /** Released from a drag — carries the fling, still stops clean. */
  gesture: { duration: 380, dampingRatio: 0.95 },
} as const;

/** Below this a spring reads as bouncy, which the design rules ban. */
export const MIN_DAMPING_RATIO = 0.85;

export const stagger = {
  /** Between siblings in an orchestrated entrance. */
  step: 60,
  /** Between skeleton bars, so a stack ripples instead of blinking in unison. */
  pulse: 160,
  /** No element may start later than this into any one entrance. */
  max: 300,
  /**
   * How many list rows get a staggered entrance. Past this rows are below the
   * fold, and animating a recycled FlatList row makes it fade in mid-scroll.
   */
  listCount: 6,
} as const;

/** How far a thing rises as it arrives. Distance is proportional to its size. */
export const rise = {
  /** Content arriving in place. */
  sm: 8,
  /** A whole section or panel. */
  md: 16,
  /** A screen's hero. */
  lg: 24,
} as const;

/** How far a pressable scales down while it is held. */
export const pressScale = {
  /** Cards and buttons — the default. */
  base: 0.97,
  /** Chips: a smaller target, so a smaller travel. */
  chip: 0.96,
  /** Small square controls (map zoom, recenter) where more travel reads better. */
  control: 0.9,
  /** Wide, full-width rows (a selectable option, a link card) where the base
   *  travel reads as the whole row lurching. */
  subtle: 0.985,
} as const;
