import { createRelation } from "bitecs";

/**
 * Utility type to extract data from a component definition.
 */
export type Data<C extends { [K: string]: unknown[] }> = {
  [K in keyof C]: C[K][number];
};

/**
 * World time stats.
 */
export const time = {
  now: performance.now(),
  delta: 0,
  elapsed: 0,
};

/**
 * Simulation stats.
 */
export const simulation = {
  delta: 0,
  count: 0,
};

/**
 * For non specific entity graphs.
 */
export const ChildOf = createRelation({
  store: () => ({ role: [] as string[] }),
});

/**
 * Used to link passengers to the floor they want to go to.
 */
export const DestinedTo = createRelation({ exclusive: true });

/**
 * Get a random number between max (exclusive) and min (inclusive).
 */
export function random(max: number, min = 0) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Common curve functions.
 */
const curves = {
  // Maintains constant speed throughout the completion.
  linear: (x: number) => x,
  // Starts slowly and accelerates towards the end.
  quadratic: (x: number) => x * x,
  // Starts very slowly and accelerates rapidly towards the end.
  cubic: (x: number) => x * x * x,
  // Starts quickly and gradually decelerates.
  decay: (x: number) => 1 - Math.pow(1 - x, 2),
  // Starts and ends slowly with acceleration in the middle.
  sigmoid: (x: number) =>
    x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
} as const;

/**
 * Interpolate between min and max following a curve function.
 */
export function interpolate(
  min: number,
  max: number,
  ratio: number,
  curve: (x: number) => number = curves.linear
) {
  return min + (max - min) * curve(clamp(0, 1, ratio));
}

/**
 * Clamp a value between a minimum and maximum.
 */
export function clamp(min: number, max: number, value: number) {
  return Math.min(Math.max(value, min), max);
}
