// The motion scale. Deliberately free of imports: `vitest` runs in a plain node
// environment, and `react-native-reanimated` cannot load there, so keeping this
// module pure is what lets `motion.test.ts` assert on it and what keeps the
// theme barrel importable from a test. The easing curves, which do need
// Reanimated, live next door in `motionPresets.ts` and are not re-exported here.

// One duration scale, six steps, each roughly x1.33. The step you reach for is a
// statement about how far the thing travels: more distance earns more time.
// Every value here replaced a magic number that used to live in a component.
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

// Loop legs sit deliberately off the scale above. A loop is not an entrance —
// it is the texture of a wait, and it gets tuned by watching it, not by ratio.
export const loops = {
  /** One leg of the skeleton pulse (1 <-> 0.45). */
  pulseLeg: 600,
  /** One leg of the AI sparkle's breath. */
  breathLeg: 550,
  /** One lap of the travelling arc around the shield outline. */
  shieldTrace: 1400,
  /**
   * One pass of the sweep line under an AI block that is still generating.
   * Matched to the shield by *speed*, not by number: one lap here crosses a ~300pt
   * track, where the shield's arc covers ~180pt of outline in 1400ms. 2000ms puts
   * this at ~150pt/s against the shield's ~128 — near enough to read as the same
   * idiom, where the 1200 this started at read as strobing beside it.
   */
  aiSweep: 2000,
  /**
   * One leg of the AI wash's drift while a model is working — the blooms slide a
   * few points and swell, then settle back. Slow enough that nobody catches it
   * moving, only that it has moved: at the sweep line's tempo the same wash read
   * as a screensaver behind the text.
   */
  aiDrift: 2800,
} as const;

// Not animations. Decisions about time — how long to wait before animating at
// all, and how long the native map camera takes to fly.
export const timings = {
  /** How long a load must run before the shield is worth showing. */
  loadingQuiet: 500,
  /**
   * The longest the shield's finale may hold content back — enforced, not
   * aspirational. `useLoadingGate` releases the screen on this deadline if the
   * mark's completion callback is ever missed, so it has to outlast the real
   * finale (`micro` + `base` + `fast` = 540ms) with a little margin rather than
   * racing it. `motion.test.ts` asserts that relationship, because the two numbers
   * are three files apart and nothing else would notice them drifting.
   */
  finaleBudget: 720,
  /** Launch intro: long enough to read the shield's sweep before the finale runs. */
  introHold: 1100,
  /**
   * How long the Home review card holds after a vote, before it throws away.
   *
   * This was `durations.base` (240ms) while the acknowledgement was purely
   * visual — a thumb filling and popping, which 240ms is plenty for. It now has
   * to carry a *sentence* ("we'll show this one lower in your results"), and a
   * sentence nobody can finish reading is worse than no sentence at all. At a
   * conservative ~200wpm a nine-word line needs roughly 1.3s of reading time on
   * its own, so this is that plus a little slack — and it is a decision about
   * time rather than an animation, which is why it lives here and not in
   * `durations`.
   */
  reviewAck: 1400,
  /**
   * How long a laid-out map may go without saying it is ready before the paper
   * veil over it lifts anyway.
   *
   * `onMapReady` waits on the native map's own load, which on a slow connection —
   * or a cold tile cache — can be seconds. Behind a veil that whole wait is a
   * blank sheet; past this budget the veteran is shown the map standing up
   * underneath, and the pins and camera fit follow the moment the native map can
   * take them. The budget never gates markers or camera commands: on Android a
   * marker added before `onMapReady` is a native crash. Longer than
   * `durations.reveal` so a genuinely quick `onMapReady` still wins the race and
   * the veil fade stays one gesture.
   */
  mapReadyBudget: 800,
  /**
   * How long Ask Frontline's thinking bubble says "Thinking…" before its label
   * changes to say what it is doing.
   *
   * A chat reply takes 3–8 s and nothing streams, so the wait is carried by a
   * skeleton sweep and one label that changes once. The change is what says
   * "still working, not stuck": a static label past ~4 s reads as a hang, and
   * a label that flickers every second reads as nervous. Past twice this the
   * bubble says "Almost there…" and stops changing.
   */
  askPatience: 4000,
  /** MapKit camera glide to a focused pin. */
  mapFocus: 350,
  /** MapKit camera glide for one zoom step. */
  mapZoom: 180,
  /** How long a map pin keeps re-rasterizing before its bitmap freezes. */
  pinRaster: 600,
} as const;

// Damped, never bouncy. Peak overshoot for a damping ratio z is
// exp(-pi*z / sqrt(1 - z^2)): at 0.92 that is 0.06%, which over our longest
// travel (24pt) is 0.015pt — sub-pixel at 3x, i.e. invisible. The design rules
// ban visible elastic overshoot, so here that ban is a number, not a taste.
export const springs = {
  /** Press feedback. Critically damped: a dead stop, no wobble at all. */
  press: { duration: 220, dampingRatio: 1 },
  /** An element settling into its final place. A hair of life. */
  settle: { duration: 420, dampingRatio: 0.92 },
  /** Released from a drag — carries the fling, still stops clean. */
  gesture: { duration: 380, dampingRatio: 0.95 },
} as const;

/**
 * The floor `motion.test.ts` asserts. Below this a spring stops reading as
 * "settled" and starts reading as "bouncy", which is the banned register.
 */
export const MIN_DAMPING_RATIO = 0.85;

export const stagger = {
  /** Between siblings in an orchestrated entrance. */
  step: 60,
  /** Between skeleton bars, so a stack ripples instead of blinking in unison. */
  pulse: 160,
  /** No element may start later than this into any one entrance. */
  max: 300,
  /**
   * How many list rows get a staggered entrance. Past this the rows are below
   * the fold on any phone, and FlatList recycles them as you scroll — animating
   * a recycled row makes it fade in mid-scroll, which reads as a glitch.
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

export type DurationToken = keyof typeof durations;
export type SpringToken = keyof typeof springs;
