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
  query,
  removeComponent,
  removeEntity,
  Wildcard,
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
  // Maintains constant speed throughout the progression.
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
     * Component for entities that are currently performing an action over time.
     */
    Acting: {
      start: [] as number[],
      duration: [] as number[],
      progression: [] as number[],
    },
    Elevator: {
      state: [] as ("idle" | "moving" | "opening" | "open" | "closing")[],
      queue: [] as number[][],
    },
    Floor: {
      index: [] as number[],
    },
    Passenger: {
      index: [] as number[],
      state: [] as ("waiting" | "boarding" | "riding" | "exiting")[],
    },
    Building: {
      floors: [] as number[],
    },
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
    count: 0,
  },
  rendering: {
    count: 0,
  },
});

type World = typeof world;

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

// --
// --
// --

/**
 * Handles spawning and reaping passengers.
 */
function passengerLifeCycleSystem(world: World) {
  const { Passenger, Floor, Acting, Graphical } = world.components;

  for (const passenger of query(world, [Passenger, Not(Acting)])) {
    switch (Passenger.state[passenger]) {
      case "exiting": {
        const [floor] = getRelationTargets(world, passenger, LocatedIn);
        removeComponent(world, passenger, LocatedIn(floor));
        const [parent] = getRelationTargets(world, passenger, ChildOf);
        removeComponent(world, passenger, ChildOf(parent));
        removeComponent(world, passenger, Passenger);
        removeComponent(world, passenger, Graphical);
        removeEntity(world, passenger);
        break;
      }
    }
  }

  const passengers = query(world, [Passenger]);
  const floors = query(world, [Floor]);

  for (let i = passengers.length; i < 10; i++) {
    const floor = floors[random(floors.length)];
    const destinations = floors.filter((f) => f !== floor);
    const destination = destinations[random(destinations.length)];
    const index = query(world, [Passenger, LocatedIn(floor)]).length;

    const passenger = addEntity(world);

    addComponent(world, passenger, LocatedIn(floor));
    addComponent(world, passenger, DestinedTo(destination));

    addComponent(world, passenger, Passenger);
    Passenger.index[passenger] = index;
    Passenger.state[passenger] = "waiting";

    addComponent(world, passenger, Graphical);
    Graphical.position[passenger] = [(10 + 2) * index, 0];
    Graphical.size[passenger] = [10, 10];
    Graphical.color[passenger] = [50, 50, 255, 1];
    addComponent(world, passenger, ChildOf(floor));

    addComponent(world, passenger, Acting);
    Acting.start[passenger] = world.time.now;
    Acting.duration[passenger] = 1000;
    Acting.progression[passenger] = 0;
  }
}

/**
 * Passenger state machine.
 */
function passengerBehaviorSystem(world: World) {
  const { Acting, Passenger, Elevator } = world.components;

  for (const passenger of query(world, [Passenger, Not(Acting)])) {
    switch (Passenger.state[passenger]) {
      case "waiting": {
        const [floor] = getRelationTargets(world, passenger, LocatedIn);
        const [elevator] = query(world, [Elevator, LocatedIn(floor)]);

        if (elevator && Elevator.state[elevator] === "open") {
          const index = query(world, [Passenger, LocatedIn(elevator)]).length;

          Passenger.index[passenger] = index;
          Passenger.state[passenger] = "boarding";

          removeComponent(world, passenger, LocatedIn(floor));
          addComponent(world, passenger, LocatedIn(elevator));

          removeComponent(world, passenger, ChildOf(floor));
          addComponent(world, passenger, ChildOf(elevator));

          addComponent(world, passenger, Acting);
          Acting.start[passenger] = world.time.now;
          Acting.duration[passenger] = 2000;
          Acting.progression[passenger] = 0;
        }
        break;
      }
      case "boarding": {
        Passenger.state[passenger] = "riding";
        break;
      }
      case "riding": {
        const [elevator] = getRelationTargets(world, passenger, LocatedIn);
        const [destination] = getRelationTargets(world, passenger, DestinedTo);
        const [currentFloor] = getRelationTargets(world, elevator, LocatedIn);

        if (currentFloor === destination) {
          Passenger.state[passenger] = "exiting";
        }
        break;
      }
    }
  }
}

/**
 * Update building graphics.
 */
function buildingGfxSystem(world: World) {
  const { Building, Floor, Graphical, Passenger } = world.components;

  for (const building of query(world, [Building, Graphical])) {
    let text = query(world, [Graphical, ChildOf(building)]).find(
      (entity) => ChildOf(building).role[entity] === "text"
    );

    if (!text) {
      text = addEntity(world);

      addComponent(world, text, Graphical);
      Graphical.position[text] = [20, 350];
      Graphical.size[text] = [0, 0];
      Graphical.color[text] = [0, 0, 0, 1];

      addComponent(world, text, ChildOf(building));
      ChildOf(building).role[text] = "text";
    }

    const queue = query(world, [Floor, Wildcard(DestinedTo)]).map(
      (floor) => Floor.index[floor]
    );

    const passengers = query(world, [Passenger]);

    Graphical.text[
      text
    ] = `Elevator Call Queue: ${queue} Passengers: ${passengers.length}`;
  }
}

/**
 * Update passenger graphics.
 */
function passengerGfxSystem(world: World) {
  const { Passenger, Graphical } = world.components;

  for (const passenger of query(world, [Passenger, Graphical])) {
    const index = Passenger.index[passenger];
    Graphical.position[passenger] = [5 + (10 + 2) * index, 5];
    Graphical.size[passenger] = [10, 10];
    Graphical.color[passenger] = [0, 0, 255, 1];

    switch (Passenger.state[passenger]) {
      case "waiting":
        Graphical.color[passenger] = [255, 100, 100, 1];
        break;
      case "boarding":
        Graphical.color[passenger] = [200, 200, 255, 1];
        break;
      case "riding":
        Graphical.color[passenger] = [100, 100, 255, 1];
        break;
      case "exiting":
        Graphical.color[passenger] = [255, 200, 200, 1];
        break;
    }
  }
}

/**
 * Elevator state machine.
 */
function elevatorBehaviorSystem(world: World) {
  const { Acting, Elevator, Passenger, Floor } = world.components;

  // We skip elevators that are acting to allow them to
  // finish their action before changing their state.
  for (const elevator of query(world, [Elevator, Not(Acting)])) {
    switch (Elevator.state[elevator]) {
      case "idle": {
        const [floor] = getRelationTargets(world, elevator, LocatedIn);
        const queue = query(world, [Floor, Wildcard(DestinedTo)]);

        if (queue.includes(floor)) {
          Elevator.state[elevator] = "opening";
          addComponent(world, elevator, Acting);
          Acting.start[elevator] = world.time.now;
          Acting.duration[elevator] = 1000;
          Acting.progression[elevator] = 0;
        }
        break;
      }
      case "opening": {
        Elevator.state[elevator] = "open";
        break;
      }
      case "open": {
        const isBeingBoarded = query(world, [
          Passenger,
          ChildOf(elevator),
        ]).some((p) => Passenger.state[p] === "boarding");

        if (!isBeingBoarded) {
          Elevator.state[elevator] = "closing";
          addComponent(world, elevator, Acting);
          Acting.start[elevator] = world.time.now;
          Acting.duration[elevator] = 1000;
          Acting.progression[elevator] = 0;
        }
        break;
      }
      case "closing": {
        Elevator.state[elevator] = "idle";
        break;
      }
    }
  }
}

/**
 * Update elevator graphics.
 */
function elevatorGfxSystem(world: World) {
  const { Elevator, Graphical } = world.components;

  for (const elevator of query(world, [Elevator, Graphical])) {
    Graphical.position[elevator] = [200, 0];
    Graphical.size[elevator] = [60, 60];
    Graphical.color[elevator] = [0, 0, 0, 1];

    switch (Elevator.state[elevator]) {
      case "idle":
        Graphical.color[elevator] = [255, 100, 100, 1];
        break;
      case "opening":
        Graphical.color[elevator] = [200, 255, 200, 1];
        break;
      case "open":
        Graphical.color[elevator] = [100, 250, 100, 1];
        break;
      case "closing":
        Graphical.color[elevator] = [255, 200, 200, 1];
        break;
      case "moving":
        Graphical.color[elevator] = [200, 100, 100, 1];
        break;
    }
  }
}

/**
 * Update action timers.
 */
function actingSystem(world: World) {
  const { Acting } = world.components;
  const { delta } = world.time;

  for (const actor of query(world, [Acting])) {
    Acting.progression[actor] += delta / Acting.duration[actor];

    if (Acting.progression[actor] >= 1) {
      Acting.progression[actor] = 1;
      removeComponent(world, actor, Acting);
    }
  }
}

/**
 * Seed the world.
 */
function initialize(world: World) {
  const { Building, Elevator, Floor, Graphical } = world.components;

  const building = addEntity(world);
  addComponent(world, building, Building);

  for (let i = 0; i < 5; i++) {
    const floor = addEntity(world);
    addComponent(world, floor, Floor);
    Floor.index[floor] = i;
    addComponent(world, floor, Graphical);
    Graphical.position[floor] = [0, (60 + 2) * i];
    Graphical.size[floor] = [800, 60];
    Graphical.color[floor] = [100, 100, 100, 1];
    addComponent(world, floor, ChildOf(building));
  }

  const [floor] = query(world, [Floor]);

  const elevator = addEntity(world);
  addComponent(world, elevator, ChildOf(floor));
  addComponent(world, elevator, LocatedIn(floor));

  addComponent(world, elevator, Elevator);
  Elevator.state[elevator] = "idle";

  addComponent(world, elevator, Graphical);
  Graphical.position[elevator] = [200, 0];
  Graphical.size[elevator] = [60, 60];
  Graphical.color[elevator] = [250, 230, 200, 1];
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
  buildingGfxSystem(world);

  world.simulation.count += 1;
}

const ctx = document.querySelector<HTMLCanvasElement>("#app")?.getContext("2d");

/**
 * Render the world.
 */
function render(world: World) {
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const { Graphical } = world.components;

  for (const entity of query(world, [Graphical, Hierarchy(ChildOf)])) {
    const [parent] = getRelationTargets(world, entity, ChildOf).filter(
      (parent) => hasComponent(world, parent, Graphical)
    );

    ctx.save();

    if (parent) {
      ctx.translate(...Graphical.position[parent]);
    }

    ctx.fillStyle = `rgba(${Graphical.color[entity].join(", ")})`;

    if (Graphical.text[entity]) {
      ctx.font = Graphical.font[entity] ?? "12px monospace";
      ctx.fillText(Graphical.text[entity], ...Graphical.position[entity]);
    } else {
      ctx.fillRect(...Graphical.position[entity], ...Graphical.size[entity]);
    }

    ctx.restore();
  }

  world.rendering.count += 1;
}

// --
// --
// --

initialize(world);

requestAnimationFrame(function animate() {
  update(world);
  render(world);
  requestAnimationFrame(animate);
});
