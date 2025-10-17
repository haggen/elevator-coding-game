import { createRelation, createWorld, type World } from "bitecs";

/**
 * Utility type to extract data from a component definition.
 */
export type Data<C extends { [K: string]: unknown[] }> = {
  [K in keyof C]: C[K][number];
};

/**
 * Time stats type.
 */
export type Time = {
  now: number;
  delta: number;
  elapsed: number;
};

/**
 * Simulation statistics.
 */
export type SimulationStats = {
  delta: number;
  count: number;
};

/**
 * Compile a new world from initializers.
 */
export function compileWorld<T extends ((world: any) => void)[]>(
  ...initializers: T
) {
  const world = createWorld({
    components: {},
  });

  for (const initialize of initializers) {
    initialize(world);
  }

  return world as T extends ((world: World<infer U>) => void)[]
    ? World<U>
    : never;
}

/**
 * For non specific entity graphs.
 */
export const ChildOf = createRelation({
  store: () => ({ role: [] as string[] }),
});

/**
 * World time statistics.
 */
export function initialize(
  world: World<{ time: Time; simulation: SimulationStats }>
) {
  world.time = {
    now: performance.now(),
    delta: 0,
    elapsed: 0,
  };

  world.simulation = {
    delta: 0,
    count: 0,
  };
}
