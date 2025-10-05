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
      elevatorCallQueue: [] as number[][],
    },
    Graphical: {
      position: [] as [number, number][],
      size: [] as [number, number][],
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
 * Main entity relationship.
 * @todo I should have separate relationships for behavior and graphics.
 */
const ChildOf = createRelation({ autoRemoveSubject: true });

/**
 * Relationship between passenger and their destination floor.
 */
const DestinedTo = createRelation({ exclusive: true });

// --
// --
// --

/**
 * Handles spawning and reaping passengers.
 */
function passengerLifeCycleSystem(world: World) {
  const { Building, Passenger, Floor, Acting, Graphical } = world.components;

  const [building] = query(world, [Building]);

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
    Graphical.position[passenger] = [(10 + 2) * index, 0];
    Graphical.size[passenger] = [10, 10];
    Graphical.color[passenger] = [0, 0, 255, 1];
    addComponent(world, passenger, ChildOf(floor));
    addComponent(world, passenger, DestinedTo(destination));
    Building.elevatorCallQueue[building].push(Floor.index[destination]);
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
    Graphical.position[passenger] = [(10 + 2) * index, 0];
    Graphical.size[passenger] = [10, 10];
    Graphical.color[passenger] = [0, 0, 255, 1];
  }
}

/**
 * Elevator state machine.
 */
function elevatorBehaviorSystem(world: World) {
  const { Building, Acting, Elevator, Passenger, Floor } = world.components;

  const [building] = query(world, [Building]);

  // We skip elevators that are currently acting to let them finish their action before changing their state.
  for (const elevator of query(world, [Elevator, Not(Acting)])) {
    switch (Elevator.state[elevator]) {
      case "idle": {
        const [floor] = getRelationTargets(world, elevator, ChildOf);

        if (Building.elevatorCallQueue[building][0] === Floor.index[floor]) {
          Elevator.state[elevator] = "opening";
          addComponent(world, elevator, Acting);
          Acting.start[elevator] = world.time.now;
          Acting.duration[elevator] = 1000;
          Acting.progression[elevator] = 0;
          Building.elevatorCallQueue[building].unshift();
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
    Graphical.position[elevator] = [200, 0];
    Graphical.size[elevator] = [60, 60];
    Graphical.color[elevator] = [230, 200, 170, 1];
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
  Building.elevatorCallQueue[building] = [];

  for (let i = 0; i < 5; i++) {
    const floor = addEntity(world);
    addComponent(world, floor, Floor);
    Floor.index[floor] = i;
    addComponent(world, floor, Graphical);
    Graphical.position[floor] = [0, (60 + 2) * i];
    Graphical.size[floor] = [800, 60];
    Graphical.color[floor] = [200, 200, 200, 1];
    addComponent(world, floor, ChildOf(building));
  }

  const [floor] = query(world, [Floor]);
  const elevator = addEntity(world);
  addComponent(world, elevator, Elevator);
  Elevator.state[elevator] = "idle";
  addComponent(world, elevator, Graphical);
  Graphical.position[elevator] = [200, 0];
  Graphical.size[elevator] = [60, 60];
  Graphical.color[elevator] = [250, 230, 200, 1];
  addComponent(world, elevator, ChildOf(floor));

  const debugText = addEntity(world);
  addComponent(world, debugText, Graphical);
  Graphical.position[debugText] = [20, 350];
  Graphical.size[debugText] = [0, 0];
  Graphical.color[debugText] = [0, 0, 0, 1];
  Graphical.text[
    debugText
  ] = `Elevator Call Queue: ${Building.elevatorCallQueue[building]}`;
  addComponent(world, debugText, ChildOf(building));
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
