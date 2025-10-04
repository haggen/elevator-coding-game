import "./style.css";

import {
  addComponent,
  addComponents,
  addEntity,
  createRelation,
  createWorld,
  getRelationTargets,
  Not,
  query,
  removeComponent,
  removeComponents,
  removeEntity,
} from "bitecs";

function random(max: number, min = 0) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const ChildOf = createRelation({ autoRemoveSubject: true });
const Destination = createRelation({ exclusive: true });

const world = createWorld({
  components: {
    Acting: {
      start: [] as number[],
      duration: [] as number[],
      progression: [] as number[],
    },
    Elevator: {
      state: [] as ("idle" | "moving" | "opening" | "open" | "closing")[],
    },
    Floor: {
      number: [] as number[],
    },
    Passenger: {
      state: [] as ("waiting" | "boarding" | "riding" | "exiting")[],
    },
    Building: {
      floors: [] as number[],
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

function passengerLifeCycleSystem(world: World) {
  const { Passenger, Floor, Acting } = world.components;

  for (const passenger of query(world, [Passenger, Not(Acting)])) {
    if (Passenger.state[passenger] === "exiting") {
      const [parent] = getRelationTargets(world, passenger, ChildOf);
      removeComponents(world, passenger, [Passenger, ChildOf(parent)]);
      removeEntity(world, passenger);
    }
  }

  const passengers = query(world, [Passenger]);

  if (passengers.length < 10) {
    const floors = query(world, [Floor]);

    const floor = floors[random(floors.length)];
    const destinations = floors.filter((f) => f !== floor);
    const destination = destinations[random(destinations.length)];
    const passenger = addEntity(world);
    addComponents(world, passenger, [
      Passenger,
      ChildOf(floor),
      Destination(destination),
    ]);
    Passenger.state[passenger] = "waiting";
  }
}

function passengerBehaviorSystem(world: World) {
  const { Acting, Passenger, Floor, Elevator } = world.components;

  for (const passenger of query(world, [Passenger, Not(Acting)])) {
    switch (Passenger.state[passenger]) {
      case "waiting": {
        const [floor] = getRelationTargets(world, passenger, ChildOf);
        const [elevator] = query(world, [Elevator, ChildOf(floor)]);

        if (Elevator.state[elevator] === "open") {
          removeComponents(world, passenger, [ChildOf(floor)]);
          addComponents(world, passenger, [ChildOf(elevator), Acting]);
          Passenger.state[passenger] = "boarding";
          Acting.start[passenger] = world.time.now;
          Acting.duration[passenger] = 2000;
          Acting.progression[passenger] = 0;
        }
      }
    }
  }
}

function elevatorBehaviorSystem(world: World) {
  const { Acting, Elevator, Floor } = world.components;

  for (const elevator of query(world, [Elevator, Not(Acting)])) {
  }
}

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

function initialize(world: World) {
  const { Building, Elevator, Floor } = world.components;

  const building = addEntity(world);
  addComponent(world, building, Building);

  for (let n = 0; n < 5; n++) {
    const floor = addEntity(world);
    addComponents(world, floor, [Floor, ChildOf(building)]);
    Floor.number[floor] = n;
  }

  const [floor] = query(world, [Floor]);
  const elevator = addEntity(world);
  addComponents(world, elevator, [Elevator, ChildOf(floor)]);
  Elevator.state[elevator] = "idle";
}

function update(world: World) {
  const now = performance.now();
  world.time.delta = now - world.time.now;
  world.time.elapsed += world.time.delta;
  world.time.now = now;

  passengerLifeCycleSystem(world);
  passengerBehaviorSystem(world);
  elevatorBehaviorSystem(world);
  actingSystem(world);

  world.simulation.count += 1;
}

const ctx = document.querySelector<HTMLCanvasElement>("#app")?.getContext("2d");

function getElevatorStateColor(
  state: World["components"]["Elevator"]["state"][number]
) {
  switch (state) {
    case "idle":
      return "blue";
    case "moving":
      return "red";
    case "open":
      return "green";
    default:
      return "black";
  }
}

function getPassengerStateColor(
  state: World["components"]["Passenger"]["state"][number]
) {
  switch (state) {
    case "waiting":
      return "blue";
    case "boarding":
      return "lime";
    case "riding":
      return "green";
    case "exiting":
      return "yellow";
    default:
      return "black";
  }
}

function render(world: World) {
  if (!ctx) {
    return;
  }

  const { Passenger, Elevator, Floor, Acting } = world.components;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const floor of query(world, [Floor])) {
    const f = Floor.number[floor];
    ctx.fillStyle = "#ccc";
    ctx.fillRect(0, ctx.canvas.height - f * 61 - 60, ctx.canvas.width, 60);

    const passengers = query(world, [Passenger, ChildOf(floor)]);

    for (let i = 0; i < passengers.length; i++) {
      const passenger = passengers[i];
      ctx.fillStyle = getPassengerStateColor(Passenger.state[passenger]);
      ctx.beginPath();
      ctx.arc(i * 20 + 20, ctx.canvas.height - f * 61 - 30, 10, 0, Math.PI * 2);
      ctx.fill();

      if (Passenger.state[passenger] === "waiting") {
        const [destination] = getRelationTargets(world, passenger, Destination);
        if (destination) {
          const d = Floor.number[destination];
          ctx.fillStyle = "white";
          ctx.strokeStyle = "black";
          ctx.lineWidth = 0.1;
          ctx.font = "12px monospace";
          ctx.fillText(
            String(d) || "-",
            i * 20 + 16,
            ctx.canvas.height - f * 61 - 26
          );
          ctx.strokeText(
            String(d) || "-",
            i * 20 + 16,
            ctx.canvas.height - f * 61 - 26
          );
        }
      }
    }
  }

  for (const elevator of query(world, [Elevator])) {
    const [floor] = getRelationTargets(world, elevator, ChildOf);
    const n = Floor.number[floor];
    ctx.fillStyle = getElevatorStateColor(Elevator.state[elevator]);
    ctx.fillRect(200, ctx.canvas.height - n * 60 - 60 - n, 60, 60);
  }

  world.rendering.count += 1;
}

initialize(world);

requestAnimationFrame(function animate() {
  render(world);
  update(world);
  requestAnimationFrame(animate);
});
