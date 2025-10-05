import "./style.css";

import {
  addComponent,
  addEntity,
  createRelation,
  createWorld,
  getRelationTargets,
  Hierarchy,
  Not,
  query,
  removeComponent,
  removeEntity,
} from "bitecs";

/**
 * Get a random number between max (exclusive) and min (inclusive).
 */
function random(max: number, min = 0) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Linear interpolation between a and b by t (0 to 1).
 */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
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
      x: [] as number[],
      y: [] as number[],
      w: [] as number[],
      h: [] as number[],
      r: [] as number[],
      g: [] as number[],
      b: [] as number[],
      a: [] as number[],
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
 * Main entity relationship.
 * @todo I should have separate relationships for behavior and graphics.
 */
const ChildOf = createRelation({ autoRemoveSubject: true });

/**
 * Relationship between passenger and their destination floor.
 */
const DestinedTo = createRelation({ exclusive: true });

/**
 * Helper to update graphics component data.
 */
function setGraphics(
  world: World,
  entity: number,
  {
    x = 0,
    y = 0,
    w = 0,
    h = 0,
    r = 0,
    g = 0,
    b = 0,
    a = 1,
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    r: number;
    g: number;
    b: number;
    a: number;
  }
) {
  const { Graphical } = world.components;
  Graphical.x[entity] = x;
  Graphical.y[entity] = y;
  Graphical.w[entity] = w;
  Graphical.h[entity] = h;
  Graphical.r[entity] = r;
  Graphical.g[entity] = g;
  Graphical.b[entity] = b;
  Graphical.a[entity] = a;
}

// --
// --
// --

/**
 * Handles spawning and reaping passengers.
 */
function passengerLifeCycleSystem(world: World) {
  const { Passenger, Floor, Acting, Graphical } = world.components;

  for (const passenger of query(world, [Passenger, Not(Acting)])) {
    if (Passenger.state[passenger] === "exiting") {
      const [parent] = getRelationTargets(world, passenger, ChildOf);
      removeComponent(world, passenger, Graphical);
      removeComponent(world, passenger, Passenger);
      removeComponent(world, passenger, ChildOf(parent));
      removeEntity(world, passenger);
    }
  }

  const passengers = query(world, [Passenger]);

  for (let i = passengers.length; i < 10; i++) {
    const floors = query(world, [Floor]);

    const floor = floors[random(floors.length)];
    const index = query(world, [Passenger, ChildOf(floor)]).length;
    const destinations = floors.filter((f) => f !== floor);
    const destination = destinations[random(destinations.length)];
    const passenger = addEntity(world);
    addComponent(world, passenger, Passenger);
    Passenger.index[passenger] = index;
    Passenger.state[passenger] = "waiting";
    addComponent(world, passenger, Graphical);
    addComponent(world, passenger, ChildOf(floor));
    addComponent(world, passenger, DestinedTo(destination));
  }
}

/**
 * Passenger state machine.
 */
function passengerBehaviorSystem(world: World) {
  const { Acting, Passenger, Floor, Elevator } = world.components;

  for (const passenger of query(world, [Passenger, Not(Acting)])) {
    switch (Passenger.state[passenger]) {
      case "waiting": {
        const [floor] = getRelationTargets(world, passenger, ChildOf);
        const [elevator] = query(world, [Elevator, ChildOf(floor)]);

        if (Elevator.state[elevator] === "open") {
          const index = query(world, [Passenger, ChildOf(elevator)]).length;
          removeComponent(world, passenger, ChildOf(floor));
          addComponent(world, passenger, Acting);
          addComponent(world, passenger, ChildOf(elevator));
          Passenger.index[passenger] = index;
          Passenger.state[passenger] = "boarding";
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
    }
  }
}

/**
 * Update passenger graphics.
 */
function passengerGraphicsSystem(world: World) {
  const { Passenger, Graphical } = world.components;

  for (const passenger of query(world, [Passenger, Graphical])) {
    const index = Passenger.index[passenger];
    setGraphics(world, passenger, {
      x: (10 + 2) * index,
      y: 0,
      w: 10,
      h: 10,
      r: 0,
      g: 0,
      b: 255,
      a: 1,
    });
  }
}

/**
 * Elevator state machine.
 */
function elevatorBehaviorSystem(world: World) {
  const { Acting, Elevator, Passenger, Floor } = world.components;

  // We skip elevators that are currently acting to let them finish their action before changing their state.
  for (const elevator of query(world, [Elevator, Not(Acting)])) {
    switch (Elevator.state[elevator]) {
      case "idle": {
        const [floor] = getRelationTargets(world, elevator, ChildOf);
        const isAwaited = query(world, [Passenger, ChildOf(floor)]).some(
          (passenger) => Passenger.state[passenger] === "waiting"
        );

        if (isAwaited) {
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
        removeComponent(world, elevator, Acting);
        break;
      }
      case "open": {
        const [floor] = getRelationTargets(world, elevator, ChildOf);
        const hasPassengersBoarding = query(world, [
          Passenger,
          ChildOf(floor),
        ]).some((p) => Passenger.state[p] === "boarding");

        if (!hasPassengersBoarding) {
          Elevator.state[elevator] = "idle";
          addComponent(world, elevator, Acting);
          Acting.start[elevator] = world.time.now;
          Acting.duration[elevator] = 1000;
          Acting.progression[elevator] = 0;
        }
        break;
      }
    }
  }
}

/**
 * Update elevator graphics.
 */
function elevatorGraphicsSystem(world: World) {
  const { Elevator, Graphical } = world.components;

  for (const elevator of query(world, [Elevator, Graphical])) {
    setGraphics(world, elevator, {
      x: 200,
      y: 0,
      w: 60,
      h: 60,
      r: 230,
      g: 200,
      b: 170,
      a: 1,
    });
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

  for (let n = 0; n < 5; n++) {
    const floor = addEntity(world);
    addComponent(world, floor, Floor);
    Floor.index[floor] = n;
    addComponent(world, floor, Graphical);
    setGraphics(world, floor, {
      x: 0,
      y: n * 62,
      w: 800,
      h: 60,
      r: 200,
      g: 200,
      b: 200,
      a: 1,
    });
    addComponent(world, floor, ChildOf(building));
  }

  const [floor] = query(world, [Floor]);
  const elevator = addEntity(world);
  addComponent(world, elevator, Elevator);
  Elevator.state[elevator] = "idle";
  addComponent(world, elevator, Graphical);
  setGraphics(world, elevator, {
    x: 200,
    y: 0,
    w: 60,
    h: 60,
    r: 250,
    g: 230,
    b: 200,
    a: 1,
  });
  addComponent(world, elevator, ChildOf(floor));
}

/**
 * Update the world state.
 */
function update(world: World) {
  const now = performance.now();
  world.time.delta = now - world.time.now;
  world.time.elapsed += world.time.delta;
  world.time.now = now;

  passengerLifeCycleSystem(world);
  passengerBehaviorSystem(world);
  elevatorBehaviorSystem(world);
  actingSystem(world);

  passengerGraphicsSystem(world);
  elevatorGraphicsSystem(world);

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

  const { Graphical } = world.components;

  for (const entity of query(world, [Graphical, Hierarchy(ChildOf)])) {
    const [parent] = getRelationTargets(world, entity, ChildOf);

    ctx.save();

    if (parent) {
      ctx.translate(Graphical.x[parent], Graphical.y[parent]);
    }

    ctx.fillStyle = `rgba(${Graphical.r[entity]}, ${Graphical.g[entity]}, ${Graphical.b[entity]}, ${Graphical.a[entity]})`;
    ctx.fillRect(
      Graphical.x[entity],
      Graphical.y[entity],
      Graphical.w[entity],
      Graphical.h[entity]
    );

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
