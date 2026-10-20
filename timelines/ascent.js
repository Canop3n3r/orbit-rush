// Stage-1 ascent guidance tables (data only), consumable by physics/guidance.js autoGuide via v.ascentTable.
// Row: [t (s after liftoff), pitch (deg from local vertical, toward the downrange heading; air-relative ≈ flight-path
// angle complement), throttle (0..1)]. Linear interpolation; after the last row AUTO's own logic takes over.
// pitch: 90° − webcast flight-path angle, 10 s samples, spec:ascent-heron-9#telemetry (2019 drone-ship LEO flight);
// t < 30 s smoothed (webcast angle is noise-dominated at low speed): EST. throttle: bucket timing from the same
// telemetry event file (55–76 s); depth 0.8 is EST (accel only dips slightly); engine floor 0.4 (spec:engines#kero-d).
export const ASCENT = {
  'heron-9': {
    src: 'spec:ascent-heron-9', est: ['pitch t<30', 'throttle depth'],
    rows: [[0, 0, 1], [8, 0, 1], [15, 3, 1], [20, 6, 1], [30, 10, 1], [40, 11, 1], [50, 14, 1], [55, 15.5, 1], [60, 17, 0.8], [70, 24, 0.8], [76, 26, 1],
      [80, 28, 1], [90, 33, 1], [100, 38, 1], [110, 41, 1], [120, 47, 1], [130, 52, 1], [140, 55, 1], [150, 58, 1], [160, 60, 1]],
    // reference values the table is checked against (tests/ascent.mjs, ±15 %)
    // reference = the table's own source flight (spec:ascent-heron-9#telemetry, 2019 drone-ship LEO flight): measured Max-Q / MECO, flown
    // with that flight's payload (10 × 860 kg + 1,000 kg dispenser = 9.6 t, spec:ascent-heron-9#payload). Earlier refs
    // mixed in the heavier constellation flight's 72 s webcast call, which this table never flew.
    ref: { payload: 9600, maxqT: 61, maxqQ: 27700, maxqAlt: 9300, mecoT: 150, mecoAlt: 68500, mecoV: 1900,
      src: 'spec:ascent-heron-9#telemetry (2019 drone-ship LEO flight)',
      knownGap: { maxqQ: 'game stack is ~0.6 m/s² quicker off the pad than the telemetry (94 vs 80 m/s at 20 s) with sourced thrust and B5 masses; unresolved, not tuned (spec:ascent-heron-9#gap)' } },
  },
};
export function sampleAscent(tab, t) {
  const R = tab.rows; if (t > R[R.length - 1][0]) return null;
  let i = 0; while (i < R.length - 2 && t > R[i + 1][0]) i++;
  const a = R[i], b = R[i + 1], f = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
  return { pitch: (a[1] + (b[1] - a[1]) * f) * Math.PI / 180, throttle: a[2] + (b[2] - a[2]) * f };
}
