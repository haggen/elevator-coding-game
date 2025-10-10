import {
  addComponent,
  query,
  removeComponent,
  type EntityId,
  type World,
} from "bitecs";
import type { time } from "./shared";

/**
 * Component for entities that are performing an action over time.
 */
export const Acting = {
  start: [] as number[],
  duration: [] as number[],
  completion: [] as number[],
};

/**
 * Add or update Acting component on an entity.
 */
export function setActing(
  world: World<{ components: { Acting: typeof Acting }; time: typeof time }>,
  entityId: EntityId,
  data: { duration: number }
) {
  const { Acting } = world.components;

  addComponent(world, entityId, Acting);

  Acting.start[entityId] = world.time.now;
  Acting.duration[entityId] = data.duration;
  Acting.completion[entityId] = 0;
}

/**
 * Tick acting data.
 */
export function tickActing(
  world: World<{ components: { Acting: typeof Acting }; time: typeof time }>
) {
  const { Acting } = world.components;
  const { delta } = world.time;

  for (const actorId of query(world, [Acting])) {
    Acting.completion[actorId] += delta / Acting.duration[actorId];

    if (Acting.completion[actorId] >= 1) {
      Acting.completion[actorId] = 1;
      removeComponent(world, actorId, Acting);
    }
  }
}
