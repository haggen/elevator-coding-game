import {
  addComponent,
  addEntity,
  createRelation,
  getEntityComponents,
  getRelationTargets,
  Not,
  observe,
  onAdd,
  onSet,
  query,
  removeComponent,
  removeComponents,
  removeEntity,
  setComponent,
  type EntityId,
  type World,
} from "bitecs";
import { type Acting } from "./acting";
import { type Elevator } from "./elevator";
import { type Floor } from "./floor";
import { type Graphic } from "./graphic";
import { random } from "./math";
import { ChildOf, type Data, type Time } from "./shared";

/**
 * Passenger component.
 */
export type Passenger = {
  index: number[];
  state: ("waiting" | "boarding" | "riding" | "exiting")[];
};

/**
 * Relationship for passenger's destination floor.
 */
export const GoingTo = createRelation({ exclusive: true });

/**
 * Module initialization.
 */
export function initialize(
  world: World<{ components: { Passenger: Passenger } }>
) {
  const Passenger: Passenger = {
    index: [],
    state: [],
  };

  world.components.Passenger = Passenger;

  observe(world, onAdd(Passenger), (passengerId: EntityId) => {
    Passenger.index[passengerId] = 0;
    Passenger.state[passengerId] = "waiting";
  });

  observe(
    world,
    onSet(Passenger),
    (passengerId: EntityId, data: Partial<Data<Passenger>>) => {
      for (const [key, value] of Object.entries(data)) {
        Passenger[key as keyof Passenger][passengerId] = value;
      }
    }
  );
}

/**
 * Reap old passengers and spawn new ones.
 */
export function managePassengerLifecycle(
  world: World<{
    components: {
      Passenger: Passenger;
      Elevator: Elevator;
      Floor: Floor;
      Acting: Acting;
      Graphic: Graphic;
    };
    time: Time;
  }>
) {
  const { Elevator, Passenger, Floor, Acting, Graphic } = world.components;

  for (const passengerId of query(world, [Passenger, Not(Acting)])) {
    if (Passenger.state[passengerId] !== "exiting") {
      continue;
    }

    const [parentId] = getRelationTargets(world, passengerId, ChildOf);
    removeComponent(world, passengerId, ChildOf(parentId));

    const [floorId] = getRelationTargets(world, passengerId, GoingTo);
    removeComponent(world, passengerId, GoingTo(floorId));

    removeComponents(
      world,
      passengerId,
      ...getEntityComponents(world, passengerId)
    );

    removeEntity(world, passengerId);
  }

  const passengerIds = query(world, [Passenger]);

  if (passengerIds.length >= 100) {
    return;
  }

  if (random(2000) > 10) {
    return;
  }

  const floorIds = query(world, [Floor]);
  const floorId = floorIds[random(floorIds.length)];
  const destinationIds = floorIds.filter((f) => f !== floorId);
  const destinationId = destinationIds[random(destinationIds.length)];
  const index = query(world, [Passenger, ChildOf(floorId)]).length;

  const passengerId = addEntity(world);

  addComponent(world, passengerId, ChildOf(floorId));
  addComponent(world, passengerId, GoingTo(destinationId));

  setComponent(world, passengerId, Passenger, {
    index: index,
    state: "waiting",
  });

  addComponent(world, passengerId, Graphic);

  setComponent(world, passengerId, Acting, {
    duration: 1000,
  });

  const [elevatorId] = query(world, [Elevator]);

  if (!elevatorId) {
    throw new Error("Expected at least 1 elevator");
  }

  setComponent(world, elevatorId, Elevator, {
    queue: [...Elevator.queue[elevatorId], Floor.index[floorId]],
  });
}

/**
 * Passenger state machine.
 */
export function updatePassengerState(
  world: World<{
    components: {
      Passenger: Passenger;
      Acting: Acting;
      Elevator: Elevator;
      Floor: Floor;
    };
    time: Time;
  }>
) {
  const { Acting, Passenger, Elevator, Floor } = world.components;

  for (const passengerId of query(world, [Passenger, Not(Acting)])) {
    switch (Passenger.state[passengerId]) {
      case "waiting": {
        const [floorId] = getRelationTargets(world, passengerId, ChildOf);
        const [elevatorId] = query(world, [Elevator, ChildOf(floorId)]);

        if (!elevatorId) {
          break;
        }

        if (Elevator.state[elevatorId] !== "open") {
          break;
        }

        setComponent(world, passengerId, Passenger, {
          state: "boarding",
        });

        removeComponent(world, passengerId, ChildOf(floorId));

        addComponent(world, passengerId, ChildOf(elevatorId));

        setComponent(world, passengerId, Acting, {
          duration: 1000,
        });

        break;
      }
      case "boarding": {
        const [destinationId] = getRelationTargets(world, passengerId, GoingTo);
        const [elevatorId] = getRelationTargets(world, passengerId, ChildOf);

        setComponent(world, passengerId, Passenger, { state: "riding" });
        setComponent(world, elevatorId, Elevator, {
          queue: [...Elevator.queue[elevatorId], Floor.index[destinationId]],
        });

        break;
      }
      case "riding": {
        const [elevatorId] = getRelationTargets(world, passengerId, ChildOf);
        const [destinationId] = getRelationTargets(world, passengerId, GoingTo);
        const [floorId] = getRelationTargets(world, elevatorId, ChildOf);

        if (floorId !== destinationId) {
          break;
        }

        if (Elevator.state[elevatorId] !== "open") {
          break;
        }

        setComponent(world, passengerId, Passenger, { state: "exiting" });

        removeComponent(world, passengerId, ChildOf(elevatorId));
        addComponent(world, passengerId, ChildOf(floorId));

        setComponent(world, passengerId, Acting, {
          duration: 1000,
        });

        break;
      }
    }
  }
}

/**
 * Update index for each passenger on a floor or in an elevator.
 */
export function updatePassengerIndex(
  world: World<{
    components: {
      Passenger: Passenger;
    };
  }>
) {
  const { Passenger } = world.components;

  for (const passengerId of query(world, [Passenger])) {
    const [parentId] = getRelationTargets(world, passengerId, ChildOf);

    const index = query(world, [Passenger, ChildOf(parentId)]).indexOf(
      passengerId
    );

    setComponent(world, passengerId, Passenger, {
      index: index,
    });
  }
}

/**
 * Update graphics for each passenger.
 */
export function updatePassengerGraphics(
  world: World<{
    components: {
      Passenger: Passenger;
      Graphic: Graphic;
    };
  }>
) {
  const { Passenger, Graphic } = world.components;

  const size = 64;

  for (const passengerId of query(world, [Passenger, Graphic])) {
    const index = Passenger.index[passengerId];

    setComponent(world, passengerId, Graphic, {
      position: [index * 10, 0],
      size: [size, size],
      image: "./passenger.gif",
    });
  }
}
