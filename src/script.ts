import "./style.css";

import {
  addComponent,
  addEntity,
  createRelation,
  createWorld,
  getRelationTargets,
  hasComponent,
  Hierarchy,
  Not,
  observe,
  onSet,
  query,
  removeComponent,
  removeEntity,
  setComponent,
} from "bitecs";

/**
 * Get a random number between max (exclusive) and min (inclusive).
 */
function random(max: number, min = 0) {
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
function interpolate(
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
function clamp(min: number, max: number, value: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * The world state.
 */
const world = createWorld({
  components: {
    /**
     * Component to represent an action being performed over time.
     */
    Acting: {
      start: [] as number[],
      duration: [] as number[],
      completion: [] as number[],
    },
    /**
     * Component to represent an elevator.
     */
    Elevator: {
      index: [] as number[],
      state: [] as ("closed" | "moving" | "opening" | "open" | "closing")[],
      queue: [] as number[][],
      direction: [] as ("up" | "down")[],
    },
    /**
     * Component to represent the floor of a building.
     */
    Floor: {
      index: [] as number[],
    },
    /**
     * Component to represent a passenger.
     */
    Passenger: {
      state: [] as ("waiting" | "boarding" | "riding" | "exiting")[],
    },
    /**
     * Component to represent a building.
     */
    Building: {
      queue: [] as number[][],
    },
    /**
     * Component for graphical properties of an entity.
     */
    Graphical: {
      position: [] as [number, number][],
      size: [] as [number, number][],
      rotation: [] as number[],
      scale: [] as [number, number][],
      color: [] as [number, number, number, number][],
      font: [] as string[],
      text: [] as string[],
    },
  },
  time: {
    elapsed: 0,
    delta: 0,
    now: performance.now(),
  },
  simulation: {
    delta: 0,
    count: 0,
  },
  rendering: {
    delta: 0,
    count: 0,
  },
});

type World = typeof world;

type ComponentData<C> = {
  [K in keyof C]: C[K] extends Array<infer T> ? T : never;
};

/**
 * For non semantic graphs, like rendering hierarchy.
 */
const ChildOf = createRelation({
  store: () => ({ role: [] as string[] }),
});

/**
 * Used to link passengers to floors and elevators, as well as elevators to floors.
 */
const LocatedIn = createRelation();

/**
 * Used to link passengers to the floor they want to go to.
 */
const DestinedTo = createRelation({ exclusive: true });

const { Passenger, Building, Acting, Graphical, Floor, Elevator } =
  world.components;

// observe(
//   world,
//   onSet(ChildOf(Wildcard)),
//   (entityId, data: Partial<ComponentData<ReturnType<typeof ChildOf>>>) => {
//     ChildOf(Wildcard).role[entityId] = data.role ?? "";
//   }
// );

observe(
  world,
  onSet(Passenger),
  (entityId, data: Partial<ComponentData<typeof Passenger>>) => {
    Passenger.state[entityId] =
      data.state ?? Passenger.state[entityId] ?? "waiting";
  }
);

observe(
  world,
  onSet(Elevator),
  (entityId, data: Partial<ComponentData<typeof Elevator>>) => {
    Elevator.index[entityId] = data.index ?? Elevator.index[entityId] ?? 0;
    Elevator.state[entityId] =
      data.state ?? Elevator.state[entityId] ?? "closed";
    Elevator.queue[entityId] = Array.from(
      new Set(data.queue ?? Elevator.queue[entityId] ?? [])
    );
  }
);

observe(
  world,
  onSet(Floor),
  (entityId, data: Partial<ComponentData<typeof Floor>>) => {
    Floor.index[entityId] = data.index ?? Floor.index[entityId] ?? 0;
  }
);

observe(
  world,
  onSet(Building),
  (entityId, data: Partial<ComponentData<typeof Building>>) => {
    Building.queue[entityId] = data.queue ?? Building.queue[entityId] ?? [];
  }
);

observe(
  world,
  onSet(Acting),
  (entityId, data: Partial<ComponentData<typeof Acting>>) => {
    Acting.start[entityId] = data.start ?? world.time.now;
    Acting.duration[entityId] = data.duration ?? 0;
    Acting.completion[entityId] = data.completion ?? 0;
  }
);

observe(
  world,
  onSet(Graphical),
  (entityId, data: Partial<ComponentData<typeof Graphical>>) => {
    Graphical.position[entityId] = data.position ??
      Graphical.position[entityId] ?? [0, 0];
    Graphical.size[entityId] = data.size ?? Graphical.size[entityId] ?? [0, 0];
    Graphical.color[entityId] = data.color ??
      Graphical.color[entityId] ?? [0, 0, 0, 0];
    Graphical.font[entityId] = data.font ?? Graphical.font[entityId] ?? "";
    Graphical.text[entityId] = data.text ?? Graphical.text[entityId] ?? "";
    Graphical.rotation[entityId] =
      data.rotation ?? Graphical.rotation[entityId] ?? 0;
    Graphical.scale[entityId] = data.scale ??
      Graphical.scale[entityId] ?? [1, 1];
  }
);

// --
// --
// --

/**
 * Handles spawning and reaping passengers.
 */
function passengerLifeCycleSystem(world: World) {
  const { Passenger, Floor, Acting, Graphical } = world.components;

  for (const passengerId of query(world, [Passenger, Not(Acting)])) {
    switch (Passenger.state[passengerId]) {
      case "exiting": {
        const [floorId] = getRelationTargets(world, passengerId, LocatedIn);
        removeComponent(world, passengerId, LocatedIn(floorId));
        const [parentId] = getRelationTargets(world, passengerId, ChildOf);
        removeComponent(world, passengerId, ChildOf(parentId));
        removeComponent(world, passengerId, Passenger);
        removeComponent(world, passengerId, Graphical);
        removeEntity(world, passengerId);
        break;
      }
    }
  }

  const passengerIds = query(world, [Passenger]);
  const floorIds = query(world, [Floor]);

  for (let i = passengerIds.length; i < 10; i++) {
    const floorId = floorIds[random(floorIds.length)];
    const destinationIds = floorIds.filter((f) => f !== floorId);
    const destinationId = destinationIds[random(destinationIds.length)];
    const index = query(world, [Passenger, LocatedIn(floorId)]).length;

    const passengerId = addEntity(world);

    addComponent(world, passengerId, LocatedIn(floorId));
    addComponent(world, passengerId, DestinedTo(destinationId));

    setComponent(world, passengerId, Passenger, {
      index,
      state: "waiting",
    });

    setComponent(world, passengerId, Graphical, {
      position: [(10 + 2) * index, 0],
      size: [10, 10],
      color: [50, 50, 255, 1],
    });
    addComponent(world, passengerId, ChildOf(floorId));

    setComponent(world, passengerId, Acting, {
      duration: 2000,
    });

    const [elevatorId] = query(world, [Elevator]);
    setComponent(world, elevatorId, Elevator, {
      queue: [...Elevator.queue[elevatorId], Floor.index[floorId]],
    });
  }
}

/**
 * Passenger state machine.
 */
function passengerBehaviorSystem(world: World) {
  const { Acting, Passenger, Elevator } = world.components;

  for (const passengerId of query(world, [Passenger, Not(Acting)])) {
    switch (Passenger.state[passengerId]) {
      case "waiting": {
        const [locationId] = getRelationTargets(world, passengerId, LocatedIn);
        const [elevatorId] = query(world, [Elevator, LocatedIn(locationId)]);

        if (!elevatorId) {
          break;
        }

        if (Elevator.state[elevatorId] !== "open") {
          break;
        }

        const index = query(world, [Passenger, LocatedIn(elevatorId)]).length;

        setComponent(world, passengerId, Passenger, {
          index,
          state: "boarding",
        });

        removeComponent(world, passengerId, LocatedIn(locationId));
        removeComponent(world, passengerId, ChildOf(locationId));
        addComponent(world, passengerId, LocatedIn(elevatorId));
        addComponent(world, passengerId, ChildOf(elevatorId));

        setComponent(world, passengerId, Acting, {
          duration: 2000,
        });

        break;
      }
      case "boarding": {
        const [destinationId] = getRelationTargets(
          world,
          passengerId,
          DestinedTo
        );
        const [elevatorId] = getRelationTargets(world, passengerId, LocatedIn);

        setComponent(world, passengerId, Passenger, { state: "riding" });
        setComponent(world, elevatorId, Elevator, {
          queue: [...Elevator.queue[elevatorId], Floor.index[destinationId]],
        });

        break;
      }
      case "riding": {
        const [elevatorId] = getRelationTargets(world, passengerId, LocatedIn);
        const [destinationId] = getRelationTargets(
          world,
          passengerId,
          DestinedTo
        );
        const [floorId] = getRelationTargets(world, elevatorId, LocatedIn);

        if (floorId !== destinationId) {
          break;
        }

        if (Elevator.state[elevatorId] !== "open") {
          break;
        }

        setComponent(world, passengerId, Passenger, { state: "exiting" });

        removeComponent(world, passengerId, LocatedIn(elevatorId));
        removeComponent(world, passengerId, ChildOf(elevatorId));
        addComponent(world, passengerId, LocatedIn(floorId));
        addComponent(world, passengerId, ChildOf(floorId));

        setComponent(world, passengerId, Acting, {
          duration: 2000,
        });

        break;
      }
    }
  }
}

/**
 * Elevator state machine.
 */
function elevatorBehaviorSystem(world: World) {
  const { Acting, Elevator, Passenger, Floor } = world.components;

  for (const elevatorId of query(world, [Elevator, Not(Acting)])) {
    switch (Elevator.state[elevatorId]) {
      case "closed": {
        const [floorId] = getRelationTargets(world, elevatorId, LocatedIn);
        const index = Floor.index[floorId];
        const queue = Elevator.queue[elevatorId];

        if (queue.length === 0) {
          break;
        }

        if (queue[0] === index) {
          setComponent(world, elevatorId, Elevator, {
            state: "opening",
            queue: queue.slice(1),
          });
          setComponent(world, elevatorId, Acting, {
            duration: 2000,
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
        removeComponent(world, elevatorId, LocatedIn(floorId));
        removeComponent(world, elevatorId, ChildOf(floorId));
        addComponent(world, elevatorId, LocatedIn(nextId));
        addComponent(world, elevatorId, ChildOf(nextId));
        setComponent(world, elevatorId, Elevator, {
          state: "moving",
          direction: direction > 0 ? "up" : "down",
        });
        setComponent(world, elevatorId, Acting, {
          duration: 1000,
        });

        break;
      }
      case "opening": {
        setComponent(world, elevatorId, Elevator, { state: "open" });
        break;
      }
      case "open": {
        const isBeingBoardedOrExited = query(world, [
          Passenger,
          ChildOf(elevatorId),
        ]).some((passengerId) => Passenger.state[passengerId] !== "riding");

        if (!isBeingBoardedOrExited) {
          setComponent(world, elevatorId, Elevator, { state: "closing" });
          setComponent(world, elevatorId, Acting, {
            duration: 2000,
          });
        }
        break;
      }
      case "closing": {
        setComponent(world, elevatorId, Elevator, { state: "closed" });
        break;
      }
      case "moving": {
        const [floorId] = getRelationTargets(world, elevatorId, LocatedIn);
        const index = Floor.index[floorId];
        const queue = Elevator.queue[elevatorId];

        if (queue[0] === index) {
          setComponent(world, elevatorId, Elevator, {
            state: "opening",
            queue: queue.slice(1),
          });
          setComponent(world, elevatorId, Acting, {
            duration: 2000,
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
        removeComponent(world, elevatorId, LocatedIn(floorId));
        removeComponent(world, elevatorId, ChildOf(floorId));
        addComponent(world, elevatorId, LocatedIn(nextId));
        addComponent(world, elevatorId, ChildOf(nextId));
        setComponent(world, elevatorId, Elevator, {
          state: "moving",
          direction: direction > 0 ? "up" : "down",
        });
        setComponent(world, elevatorId, Acting, {
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
function passengerGfxSystem(world: World) {
  const { Passenger, Graphical } = world.components;

  for (const passengerId of query(world, [Passenger, Graphical])) {
    const [locationId] = getRelationTargets(world, passengerId, LocatedIn);

    const index = query(world, [Passenger, LocatedIn(locationId)]).indexOf(
      passengerId
    );

    setComponent(world, passengerId, Graphical, {
      position: [5 + (10 + 2) * index, 5],
      size: [10, 10],
      color: [0, 0, 255, 1],
    });

    switch (Passenger.state[passengerId]) {
      case "waiting":
        setComponent(world, passengerId, Graphical, {
          color: [255, 100, 100, 1],
        });
        break;
      case "boarding":
        setComponent(world, passengerId, Graphical, {
          color: [200, 200, 255, 1],
        });
        break;
      case "riding":
        setComponent(world, passengerId, Graphical, {
          color: [100, 100, 255, 1],
        });
        break;
      case "exiting":
        setComponent(world, passengerId, Graphical, {
          color: [255, 200, 200, 1],
        });
        break;
    }
  }
}

/**
 * Update elevator graphics.
 */
function elevatorGfxSystem(world: World) {
  const { Elevator, Graphical } = world.components;

  for (const elevatorId of query(world, [Elevator, Graphical])) {
    let [textId] = query(world, [Graphical, ChildOf(elevatorId)]).filter(
      (id) => ChildOf(elevatorId).role[id] === "text"
    );

    if (!textId) {
      textId = addEntity(world);
      ChildOf(elevatorId).role[textId] = "text";
      addComponent(world, textId, ChildOf(elevatorId));
    }

    setComponent(world, textId, Graphical, {
      position: [10, 25],
      size: [60, 60],
      color: [0, 0, 0, 1],
      font: "12px monospace",
      text: `${Elevator.state[elevatorId]}`,
    });

    Graphical.position[elevatorId] = [200, 0];
    Graphical.size[elevatorId] = [100, 60];
    Graphical.color[elevatorId] = [0, 0, 0, 1];

    switch (Elevator.state[elevatorId]) {
      case "closed":
        Graphical.color[elevatorId] = [255, 100, 100, 1];
        break;
      case "opening":
        Graphical.color[elevatorId] = [200, 255, 200, 1];
        break;
      case "open":
        Graphical.color[elevatorId] = [100, 250, 100, 1];
        break;
      case "closing":
        Graphical.color[elevatorId] = [255, 200, 200, 1];
        break;
      case "moving":
        Graphical.color[elevatorId] = [200, 200, 255, 1];
        break;
    }
  }
}

/**
 * Update floor graphics.
 */
function floorGfxSystem(world: World) {
  const { Floor, Graphical } = world.components;

  for (const floorId of query(world, [Floor, Graphical])) {
    let [textId] = query(world, [Graphical, ChildOf(floorId)]).filter(
      (id) => ChildOf(floorId).role[id] === "text"
    );

    if (!textId) {
      textId = addEntity(world);
      ChildOf(floorId).role[textId] = "text";
      addComponent(world, textId, ChildOf(floorId));
    }

    setComponent(world, textId, Graphical, {
      position: [200, 10],
      size: [60, 60],
      color: [255, 255, 255, 1],
      font: "18px monospace",
      text: `${Floor.index[floorId]}`,
    });
  }
}

/**
 * Update action timers.
 */
function actingSystem(world: World) {
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

const statsElement = document.querySelector<HTMLPreElement>("#stats");

/**
 * Update debug statistics.
 */
function debugStatsSystem(world: World) {
  if (!statsElement) {
    throw new Error("Stats element not found");
  }

  const { Floor, Passenger } = world.components;

  const stats = [];

  stats.push(`Time elapsed: ${Math.floor(world.time.elapsed)}ms`);
  stats.push(
    `Simulation steps: ${
      world.simulation.count
    } (${world.simulation.delta.toFixed(2)}ms)`
  );
  stats.push(
    `Rendering steps: ${world.rendering.count} (${world.rendering.delta.toFixed(
      2
    )}ms)`
  );
  stats.push("");
  stats.push(`Entities: ${query(world, []).length}`);
  stats.push(`Floors: ${query(world, [Floor]).length}`);
  stats.push(`Elevators: ${query(world, [Elevator]).length}`);
  stats.push(`Passengers: ${query(world, [Passenger]).length}`);
  stats.push("");

  for (const buildingId of query(world, [Building])) {
    stats.push(`Building: ${Building.queue[buildingId]}`);
  }
  stats.push("");

  for (const elevatorId of query(world, [Elevator])) {
    const [parentId] = getRelationTargets(world, elevatorId, LocatedIn);
    stats.push(
      `Elevator ${Elevator.index[elevatorId]}: ${Elevator.state[elevatorId]} ${
        hasComponent(world, parentId, Floor)
          ? `floor ${Floor.index[parentId]}`
          : hasComponent(world, parentId, Elevator)
          ? `elevator ${Elevator.index[parentId]}`
          : `unknown`
      }`
    );
    stats.push(`Queue: ${Elevator.queue[elevatorId]}`);
  }
  stats.push("");

  for (const passengerId of query(world, [Passenger])) {
    const [parentId] = getRelationTargets(world, passengerId, LocatedIn);
    stats.push(
      `Passenger ${passengerId}: ${Passenger.state[passengerId]} ${
        hasComponent(world, parentId, Floor)
          ? `floor ${Floor.index[parentId]}`
          : hasComponent(world, parentId, Elevator)
          ? `elevator ${Elevator.index[parentId]}`
          : `unknown`
      }`
    );
  }

  statsElement.textContent = stats.join("\n");
}

/**
 * Seed the world.
 */
function initialize(world: World) {
  const { Building, Elevator, Floor, Graphical } = world.components;

  const buildingId = addEntity(world);
  setComponent(world, buildingId, Building, {
    queue: [],
  });
  setComponent(world, buildingId, Graphical, {
    position: [0, 0],
    size: [600, 600],
    color: [255, 255, 255, 1],
  });

  for (let index = 0; index < 5; index++) {
    const floorId = addEntity(world);
    setComponent(world, floorId, Floor, { index });
    setComponent(world, floorId, Graphical, {
      position: [0, (60 + 2) * index],
      size: [600, 60],
      color: [100, 100, 100, 1],
      font: undefined,
      text: undefined,
      rotation: 0,
      scale: [1, 1],
    });
    addComponent(world, floorId, ChildOf(buildingId));
  }

  const [floorId] = query(world, [Floor]);

  for (let index = 0; index < 1; index++) {
    const elevatorId = addEntity(world);
    addComponent(world, elevatorId, ChildOf(floorId));
    addComponent(world, elevatorId, LocatedIn(floorId));

    setComponent(world, elevatorId, Elevator, {
      index,
      state: "closed",
      queue: [],
    });

    setComponent(world, elevatorId, Graphical, {
      position: [200 + 10 * index, 0],
      size: [60, 60],
      color: [250, 230, 200, 1],
    });
  }
}

/**
 * Update the world state.
 */
function update(world: World) {
  const now = performance.now();
  world.time.delta = now - world.time.now;
  world.time.elapsed += world.time.delta;
  world.time.now = now;

  actingSystem(world);
  elevatorBehaviorSystem(world);
  passengerLifeCycleSystem(world);
  passengerBehaviorSystem(world);

  passengerGfxSystem(world);
  elevatorGfxSystem(world);
  floorGfxSystem(world);

  debugStatsSystem(world);

  world.simulation.count += 1;
  world.simulation.delta = performance.now() - world.time.now;
}

const ctx = document
  .querySelector<HTMLCanvasElement>("#app")
  ?.getContext("2d")!;

function paint(world: World, parentId: number) {
  const { Graphical } = world.components;

  ctx.save();

  ctx.translate(...Graphical.position[parentId]);
  ctx.fillStyle = `rgba(${Graphical.color[parentId].join(", ")})`;

  if (Graphical.text[parentId]) {
    ctx.font = Graphical.font[parentId] || "12px monospace";
    ctx.fillText(Graphical.text[parentId], ...Graphical.position[parentId]);
  } else {
    ctx.fillRect(0, 0, ...Graphical.size[parentId]);
  }

  for (const entityId of query(world, [Graphical, ChildOf(parentId)])) {
    paint(world, entityId);
  }

  ctx.restore();
}

/**
 * Render the world.
 */
function render(world: World) {
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const { Graphical } = world.components;

  for (const entityId of query(world, [Graphical, Hierarchy(ChildOf, 0)])) {
    paint(world, entityId);
  }

  world.rendering.count += 1;
  world.rendering.delta = performance.now() - world.time.now;
}

// --
// --
// --

initialize(world);

requestAnimationFrame(function step() {
  update(world);
  render(world);
  requestAnimationFrame(step);
});
