import {
  observe,
  onAdd,
  onSet,
  query,
  removeComponent,
  type World,
} from "bitecs";
import { type Time } from "./shared";

/**
 * Acting component.
 */
export type Acting = {
  start: number[];
  duration: number[];
  completion: number[];
};

/**
 * Create the Acting component.
 */
export function initialize(
  world: World<{ components: { Acting: Acting }; time: Time }>
) {
  const Acting = {
    start: [],
    duration: [],
    completion: [],
  } as Acting;

  world.components.Acting = Acting;

  observe(world, onAdd(Acting), (entityId: number) => {
    Acting.start[entityId] = world.time.now;
    Acting.duration[entityId] = 0;
    Acting.completion[entityId] = 0;
  });

  observe(
    world,
    onSet(Acting),
    (actorId: number, data: { duration: number }) => {
      Acting.start[actorId] = world.time.now;
      Acting.duration[actorId] = data.duration;
      Acting.completion[actorId] = 0;
    }
  );
}

/**
 * Update action progression for each acting entity.
 */
export function updateActingCompletion(
  world: World<{ components: { Acting: Acting }; time: Time }>
) {
  const {
    components: { Acting },
    time: { delta },
  } = world;

  for (const actorId of query(world, [Acting])) {
    Acting.completion[actorId] += delta / Acting.duration[actorId];

    if (Acting.completion[actorId] >= 1) {
      Acting.completion[actorId] = 1;
      removeComponent(world, actorId, Acting);
    }
  }
}
