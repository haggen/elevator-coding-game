import {
  addComponent,
  addEntity,
  getRelationTargets,
  Not,
  query,
  removeComponent,
  type EntityId,
  type World,
} from "bitecs";
import { setActing, type Acting } from "./acting";
import { type Floor } from "./floor";
import { Graphical, setGraphical } from "./graphic";
import { type Passenger } from "./passenger";
import { ChildOf, time, type Data } from "./shared";

/**
 * Component to represent an elevator.
 */
export const Elevator = {
  index: [] as number[],
  state: [] as ("closed" | "moving" | "opening" | "open" | "closing")[],
  queue: [] as number[][],
  direction: [] as ("up" | "down" | "none")[],
};

/**
 * Add or update Elevator component on an entity.
 */
export function setElevator(
  world: World<{
    components: { Elevator: typeof Elevator; Floor: typeof Floor };
  }>,
  entityId: EntityId,
  data: Partial<Data<typeof Elevator>>
) {
  const { Elevator, Floor } = world.components;

  addComponent(world, entityId, Elevator);

  const [floorId] = getRelationTargets(world, entityId, ChildOf);

  Elevator.index[entityId] = data.index ?? Elevator.index[entityId] ?? 0;
  Elevator.state[entityId] = data.state ?? Elevator.state[entityId] ?? "closed";
  Elevator.queue[entityId] = Array.from(
    new Set(data.queue ?? Elevator.queue[entityId] ?? [])
  );
  Elevator.direction[entityId] =
    Elevator.queue[entityId].length === 0
      ? "none"
      : Elevator.queue[entityId][0] > Floor.index[floorId]
      ? "up"
      : Elevator.queue[entityId][0] < Floor.index[floorId]
      ? "down"
      : "none";
}

/**
 * Elevator state machine.
 */
export function updateElevatorState(
  world: World<{
    components: {
      Elevator: typeof Elevator;
      Acting: typeof Acting;
      Passenger: typeof Passenger;
      Floor: typeof Floor;
    };
    time: typeof time;
  }>
) {
  const { Acting, Elevator, Passenger, Floor } = world.components;

  for (const elevatorId of query(world, [Elevator, Not(Acting)])) {
    switch (Elevator.state[elevatorId]) {
      case "closed": {
        const [floorId] = getRelationTargets(world, elevatorId, ChildOf);
        const index = Floor.index[floorId];
        const queue = Elevator.queue[elevatorId];

        if (queue.length === 0) {
          break;
        }

        if (queue[0] === index) {
          setElevator(world, elevatorId, {
            state: "opening",
            queue: queue.slice(1),
          });
          setActing(world, elevatorId, {
            duration: 1000,
          });

          break;
        }

        const direction = queue[0] > index ? 1 : -1;
        const floors = query(world, [Floor]);
        const nextId = floors.find(
          (floorId) => Floor.index[floorId] === index + direction
        );
        if (!nextId) {
          throw new Error(`Next floor index ${queue[0]} not found`);
        }
        removeComponent(world, elevatorId, ChildOf(floorId));
        addComponent(world, elevatorId, ChildOf(nextId));
        setElevator(world, elevatorId, {
          state: "moving",
        });
        setActing(world, elevatorId, {
          duration: 1000,
        });

        break;
      }
      case "opening": {
        setElevator(world, elevatorId, { state: "open" });
        break;
      }
      case "open": {
        const isBeingBoardedOrExited = query(world, [
          Passenger,
          ChildOf(elevatorId),
        ]).some((passengerId) => Passenger.state[passengerId] !== "riding");

        if (!isBeingBoardedOrExited) {
          setElevator(world, elevatorId, { state: "closing" });
          setActing(world, elevatorId, {
            duration: 1000,
          });
        }
        break;
      }
      case "closing": {
        setElevator(world, elevatorId, { state: "closed" });
        setActing(world, elevatorId, { duration: 1000 });
        break;
      }
      case "moving": {
        const [floorId] = getRelationTargets(world, elevatorId, ChildOf);
        const index = Floor.index[floorId];
        const queue = Elevator.queue[elevatorId];

        if (queue[0] === index) {
          setElevator(world, elevatorId, {
            state: "opening",
            queue: queue.slice(1),
          });
          setActing(world, elevatorId, {
            duration: 1000,
          });

          break;
        }

        const direction = queue[0] > index ? 1 : -1;
        const floors = query(world, [Floor]);
        const nextId = floors.find(
          (floorId) => Floor.index[floorId] === index + direction
        );
        if (!nextId) {
          throw new Error(`Next floor index ${queue[0]} not found`);
        }
        removeComponent(world, elevatorId, ChildOf(floorId));
        addComponent(world, elevatorId, ChildOf(nextId));
        setElevator(world, elevatorId, {
          state: "moving",
        });
        setActing(world, elevatorId, {
          duration: 1000,
        });

        break;
      }
    }
  }
}

/**
 * Update elevator graphics.
 */
export function updateElevatorGraphics(
  world: World<{
    components: { Elevator: typeof Elevator; Graphical: typeof Graphical };
  }>
) {
  const { Elevator, Graphical } = world.components;

  for (const elevatorId of query(world, [Elevator, Graphical])) {
    const [floorId] = getRelationTargets(world, elevatorId, ChildOf);

    let [textId] = query(world, [Graphical, ChildOf(elevatorId)]).filter(
      (id) => ChildOf(elevatorId).role[id] === "text"
    );

    if (!textId) {
      textId = addEntity(world);
      ChildOf(elevatorId).role[textId] = "text";
      addComponent(world, textId, ChildOf(elevatorId));
    }

    setGraphical(world, textId, {
      position: [5, Graphical.size[floorId][1] - 5],
      size: [0, 0],
      color: [0, 0, 0, 1],
      font: "12px monospace",
      text: `${Elevator.state[elevatorId]}, ${Elevator.direction[elevatorId]}`,
    });

    setGraphical(world, elevatorId, {
      position: [200, 0],
      size: [120, Graphical.size[floorId][1]],
      color: [0, 0, 0, 1],
    });

    switch (Elevator.state[elevatorId]) {
      case "closed":
        setGraphical(world, elevatorId, {
          color: [255, 100, 100, 1],
        });
        break;
      case "opening":
        setGraphical(world, elevatorId, {
          color: [200, 255, 200, 1],
        });
        break;
      case "open":
        setGraphical(world, elevatorId, {
          color: [100, 250, 100, 1],
        });
        break;
      case "closing":
        setGraphical(world, elevatorId, {
          color: [255, 200, 200, 1],
        });
        break;
      case "moving":
        setGraphical(world, elevatorId, {
          color: [200, 200, 255, 1],
        });
        break;
    }
  }
}
