import {
  addComponent,
  addEntity,
  createRelation,
  getRelationTargets,
  Not,
  observe,
  onAdd,
  onSet,
  Or,
  query,
  removeComponent,
  setComponent,
  type EntityId,
  type World,
} from "bitecs";
import { type Acting } from "./acting";
import type { Floor } from "./floor";
import { type Graphic } from "./graphic";
import { ChildOf, type Data, type Time } from "./shared";

/**
 * Elevator component.
 */
export type Elevator = {
  index: number[];
  state: ("open" | "closed" | "moving")[];
  queue: number[][];
  direction: ("up" | "down" | "stopped")[];
};

/**
 * Relation for entities boarding an elevator.
 */
export const Boarding = createRelation({ exclusive: true });

/**
 * Relation for entities exiting an elevator.
 */
export const Exiting = createRelation({ exclusive: true });

/**
 * Relation for entities riding an elevator.
 */
export const Riding = createRelation({ exclusive: true });

/**
 * Module initialization.
 */
export function initialize(
  world: World<{ components: { Elevator: Elevator } }>
) {
  const Elevator: Elevator = {
    index: [],
    state: [],
    queue: [],
    direction: [],
  };

  world.components.Elevator = Elevator;

  observe(world, onAdd(Elevator), (elevatorId: EntityId) => {
    Elevator.index[elevatorId] = 0;
    Elevator.state[elevatorId] = "closed";
    Elevator.queue[elevatorId] = [];
    Elevator.direction[elevatorId] = "stopped";
  });

  observe(
    world,
    onSet(Elevator),
    (elevatorId: EntityId, data: Partial<Data<Elevator>>) => {
      for (const [key, value] of Object.entries(data)) {
        Elevator[key as keyof Elevator][elevatorId] = value;
      }
    }
  );
}

/**
 * Update elevator direction.
 */
export function updateElevatorDirection(
  world: World<{
    components: {
      Elevator: Elevator;
      Floor: Floor;
    };
  }>
) {
  const { Elevator, Floor } = world.components;

  for (const elevatorId of query(world, [Elevator])) {
    const [floorId] = getRelationTargets(world, elevatorId, ChildOf);

    if (!floorId) {
      const floorId = query(world, [Floor]).find(
        (floorId) => Floor.index[floorId] === 0
      );

      if (!floorId) {
        throw new Error("Expected a floor with index 0 to put the elevator on");
      }

      addComponent(world, elevatorId, ChildOf(floorId));
    }

    Elevator.direction[elevatorId] =
      Elevator.queue[elevatorId].length === 0
        ? "stopped"
        : Elevator.queue[elevatorId][0] > Floor.index[floorId]
        ? "up"
        : "down";
  }
}

/**
 * Update closed elevators.
 */
export function updateElevatorClosedState(
  world: World<{
    components: {
      Elevator: Elevator;
      Acting: Acting;
      Floor: Floor;
    };
  }>
) {
  const { Acting, Elevator, Floor } = world.components;

  for (const elevatorId of query(world, [Elevator, Not(Acting)])) {
    if (Elevator.state[elevatorId] !== "closed") {
      continue;
    }

    const [floorId] = getRelationTargets(world, elevatorId, ChildOf);
    const index = Floor.index[floorId];
    const queue = Elevator.queue[elevatorId];

    // Elevator queue is empty, do nothing.
    if (queue.length === 0) {
      continue;
    }

    // Elevator is already on the target floor.
    if (queue[0] === index) {
      setComponent(world, elevatorId, Elevator, {
        state: "open",
        queue: queue.slice(1),
      });

      setComponent(world, elevatorId, Acting, {
        duration: 1000,
      });

      continue;
    }

    // Elevator must move.
    // To allow immediate reaction to elevator calls, we move one floor at a time.
    const direction = queue[0] > index ? 1 : -1;
    const stopId = query(world, [Floor]).find(
      (floorId) => Floor.index[floorId] === index + direction
    );

    if (!stopId) {
      throw new Error(`Expected floor index ${queue[0]} to be found`);
    }

    // Swap floors.
    removeComponent(world, elevatorId, ChildOf(floorId));
    addComponent(world, elevatorId, ChildOf(stopId));

    setComponent(world, elevatorId, Elevator, {
      state: "moving",
    });
    setComponent(world, elevatorId, Acting, {
      duration: 1000,
    });
  }
}

/**
 * Update open elevators.
 */
export function updateElevatorOpenState(
  world: World<{
    components: {
      Elevator: Elevator;
      Acting: Acting;
    };
    time: Time;
  }>
) {
  const { Acting, Elevator } = world.components;

  for (const elevatorId of query(world, [Elevator, Not(Acting)])) {
    if (Elevator.state[elevatorId] !== "open") {
      continue;
    }

    const transiting = query(world, [
      Or(Boarding(elevatorId), Exiting(elevatorId)),
    ]);

    if (transiting.length === 0) {
      setComponent(world, elevatorId, Elevator, {
        state: "closed",
      });
      setComponent(world, elevatorId, Acting, {
        duration: 1000,
      });
    }
  }
}

/**
 * Update moving elevators.
 */
export function updateElevatorMovingState(
  world: World<{
    components: {
      Elevator: Elevator;
      Acting: Acting;
      Floor: Floor;
    };
  }>
) {
  const { Acting, Elevator, Floor } = world.components;

  for (const elevatorId of query(world, [Elevator, Not(Acting)])) {
    if (Elevator.state[elevatorId] !== "moving") {
      continue;
    }

    const [floorId] = getRelationTargets(world, elevatorId, ChildOf);
    const index = Floor.index[floorId];
    const queue = Elevator.queue[elevatorId];

    // Elevator queue is empty, close the elevator.
    if (queue.length === 0) {
      setComponent(world, elevatorId, Elevator, {
        state: "closed",
      });
      continue;
    }

    // Elevator is already on the target floor.
    if (queue[0] === index) {
      setComponent(world, elevatorId, Elevator, {
        state: "open",
        queue: queue.slice(1),
      });

      setComponent(world, elevatorId, Acting, {
        duration: 1000,
      });

      continue;
    }

    // Elevator must keep moving.
    // To allow immediate reaction to elevator calls, we move one floor at a time.
    const direction = queue[0] > index ? 1 : -1;
    const stopId = query(world, [Floor]).find(
      (floorId) => Floor.index[floorId] === index + direction
    );

    if (!stopId) {
      throw new Error(`Expected floor index ${queue[0]} to be found`);
    }

    // Swap floors.
    removeComponent(world, elevatorId, ChildOf(floorId));
    addComponent(world, elevatorId, ChildOf(stopId));

    setComponent(world, elevatorId, Elevator, {
      state: "moving",
    });
    setComponent(world, elevatorId, Acting, {
      duration: 1000,
    });
  }
}

/**
 * Update elevator graphics.
 */
export function updateElevatorGraphics(
  world: World<{
    components: { Elevator: Elevator; Graphic: Graphic };
  }>
) {
  const { Elevator, Graphic } = world.components;

  for (const elevatorId of query(world, [Elevator, Graphic])) {
    const [floorId] = getRelationTargets(world, elevatorId, ChildOf);
    const [, height] = Graphic.size[floorId];

    let [textId] = query(world, [Graphic, ChildOf(elevatorId)]).filter(
      (id) => ChildOf(elevatorId).role[id] === "text"
    );

    if (!textId) {
      console.log("Creating text for elevator", elevatorId);
      textId = addEntity(world);
      ChildOf(elevatorId).role[textId] = "text";
      addComponent(world, textId, ChildOf(elevatorId));
    }

    setComponent(world, elevatorId, Graphic, {
      position: [200, 0],
      size: [120, height],
    });

    setComponent(world, textId, Graphic, {
      position: [5, height - 5],
      font: "12px monospace",
      text: `${Elevator.state[elevatorId]}, ${Elevator.direction[elevatorId]}`,
    });

    switch (Elevator.state[elevatorId]) {
      case "closed":
        setComponent(world, elevatorId, Graphic, {
          color: [255, 200, 200, 1],
        });
        break;
      case "open":
        setComponent(world, elevatorId, Graphic, {
          color: [200, 255, 200, 1],
        });
        break;
      case "moving":
        setComponent(world, elevatorId, Graphic, {
          color: [200, 200, 200, 1],
        });
        break;
    }
  }
}
