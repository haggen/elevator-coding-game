import {
  addComponent,
  addEntity,
  getEntityComponents,
  getRelationTargets,
  Not,
  query,
  removeComponent,
  removeComponents,
  removeEntity,
  type EntityId,
  type World,
} from "bitecs";
import { setActing, type Acting } from "./acting";
import { Elevator, setElevator } from "./elevator";
import { Floor } from "./floor";
import { Graphical, setGraphical } from "./graphic";
import { ChildOf, DestinedTo, random, time, type Data } from "./shared";

/**
 * Component to represent a passenger.
 */
export const Passenger = {
  state: [] as ("waiting" | "boarding" | "riding" | "exiting")[],
};

/**
 * Add or update Passenger component on an entity.
 */
export function setPassenger(
  world: World<{ components: { Passenger: typeof Passenger } }>,
  entityId: EntityId,
  data: Partial<Data<typeof Passenger>>
) {
  const { Passenger } = world.components;

  addComponent(world, entityId, Passenger);

  Passenger.state[entityId] =
    data.state ?? Passenger.state[entityId] ?? "waiting";
}

/**
 * Handles spawning and reaping passengers.
 */
export function managePassengerLifecycle(
  world: World<{
    components: {
      Passenger: typeof Passenger;
      Elevator: typeof Elevator;
      Floor: typeof Floor;
      Acting: typeof Acting;
      Graphical: typeof Graphical;
    };
    time: typeof time;
  }>
) {
  const { Passenger, Floor, Acting } = world.components;

  for (const passengerId of query(world, [Passenger, Not(Acting)])) {
    switch (Passenger.state[passengerId]) {
      case "exiting": {
        const [parentId] = getRelationTargets(world, passengerId, ChildOf);
        removeComponent(world, passengerId, ChildOf(parentId));

        removeComponents(
          world,
          passengerId,
          ...getEntityComponents(world, passengerId)
        );
        removeEntity(world, passengerId);
        break;
      }
    }
  }

  const passengerIds = query(world, [Passenger]);
  const floorIds = query(world, [Floor]);

  for (let i = passengerIds.length; i < 100; i++) {
    const floorId = floorIds[random(floorIds.length)];
    const destinationIds = floorIds.filter((f) => f !== floorId);
    const destinationId = destinationIds[random(destinationIds.length)];
    const index = query(world, [Passenger, ChildOf(floorId)]).length;

    const passengerId = addEntity(world);

    addComponent(world, passengerId, ChildOf(floorId));
    addComponent(world, passengerId, DestinedTo(destinationId));

    setPassenger(world, passengerId, {
      state: "waiting",
    });

    setGraphical(world, passengerId, {
      position: [(10 + 2) * index, 0],
      size: [10, 10],
      color: [50, 50, 255, 1],
    });

    setActing(world, passengerId, {
      duration: 1000,
    });

    const [elevatorId] = query(world, [Elevator]);

    if (elevatorId) {
      setElevator(world, elevatorId, {
        queue: [...Elevator.queue[elevatorId], Floor.index[floorId]],
      });
    }
  }
}

/**
 * Passenger state machine.
 */
export function updatePassengerState(
  world: World<{
    components: {
      Passenger: typeof Passenger;
      Acting: typeof Acting;
      Elevator: typeof Elevator;
      Floor: typeof Floor;
    };
    time: typeof time;
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

        setPassenger(world, passengerId, {
          state: "boarding",
        });

        removeComponent(world, passengerId, ChildOf(floorId));

        addComponent(world, passengerId, ChildOf(elevatorId));

        setActing(world, passengerId, {
          duration: 1000,
        });

        break;
      }
      case "boarding": {
        const [destinationId] = getRelationTargets(
          world,
          passengerId,
          DestinedTo
        );
        const [elevatorId] = getRelationTargets(world, passengerId, ChildOf);

        setPassenger(world, passengerId, { state: "riding" });
        setElevator(world, elevatorId, {
          queue: [...Elevator.queue[elevatorId], Floor.index[destinationId]],
        });

        break;
      }
      case "riding": {
        const [elevatorId] = getRelationTargets(world, passengerId, ChildOf);
        const [destinationId] = getRelationTargets(
          world,
          passengerId,
          DestinedTo
        );
        const [floorId] = getRelationTargets(world, elevatorId, ChildOf);

        if (floorId !== destinationId) {
          break;
        }

        if (Elevator.state[elevatorId] !== "open") {
          break;
        }

        setPassenger(world, passengerId, { state: "exiting" });

        removeComponent(world, passengerId, ChildOf(elevatorId));
        addComponent(world, passengerId, ChildOf(floorId));

        setActing(world, passengerId, {
          duration: 1000,
        });

        break;
      }
    }
  }
}

/**
 * Update passenger graphics.
 */
export function updatePassengerGraphics(
  world: World<{
    components: {
      Passenger: typeof Passenger;
      Graphical: typeof Graphical;
    };
  }>
) {
  const { Passenger, Graphical } = world.components;

  for (const passengerId of query(world, [Passenger, Graphical])) {
    const [locationId] = getRelationTargets(world, passengerId, ChildOf);

    const index = query(world, [Passenger, ChildOf(locationId)]).indexOf(
      passengerId
    );

    setGraphical(world, passengerId, {
      position: [
        5 + (8 + 2) * (index % 10),
        5 + Math.floor(index / 10) * (8 + 2),
      ],
      size: [8, 8],
      color: [0, 0, 255, 1],
    });

    switch (Passenger.state[passengerId]) {
      case "waiting":
        setGraphical(world, passengerId, {
          color: [255, 100, 100, 1],
        });
        break;
      case "boarding":
        setGraphical(world, passengerId, {
          color: [200, 200, 255, 1],
        });
        break;
      case "riding":
        setGraphical(world, passengerId, {
          color: [100, 100, 255, 1],
        });
        break;
      case "exiting":
        setGraphical(world, passengerId, {
          color: [255, 200, 200, 1],
        });
        break;
    }
  }
}
