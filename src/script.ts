import "./style.css";

import {
  addComponent,
  addEntity,
  createRelation,
  createWorld,
  query,
  removeEntity,
} from "bitecs";

type ElevatorState = "idle" | "moving" | "open";
type PassengerState = "waiting" | "boarding" | "riding" | "exiting";

const world = createWorld({
  components: {
    Elevator: {
      floor: [] as number[],
      state: [] as ElevatorState[],
    },
    Passenger: {
      floor: [] as number[],
      destination: [] as number[],
      state: [] as PassengerState[],
      spawnedAt: [] as number[],
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
  passengers: {
    accumulator: 0,
    spawnRate: 1000,
    maxAge: 10_000,
  },
});

type World = typeof world;

const ChildOf = createRelation({ autoRemoveSubject: true });

function buildingSystem(world: World) {
  const { Building, Elevator } = world.components;

  const [building] = query(world, [Building]);

  if (!building) {
    const building = addEntity(world);
    addComponent(world, building, Building);
    Building.floors[building] = 5;

    const elevator = addEntity(world);
    addComponent(world, elevator, Elevator);
    addComponent(world, elevator, ChildOf(building));
    Elevator.floor[elevator] = 0;
    Elevator.state[elevator] = "idle";
  }
}

function passengerSpawnerSystem(world: World) {
  const { Passenger, Building } = world.components;
  const [building] = query(world, [Building]);

  if (!building) {
    return;
  }

  world.passengers.accumulator += world.time.delta;

  if (world.passengers.accumulator > world.passengers.spawnRate) {
    world.passengers.accumulator -= world.passengers.spawnRate;

    // Every second there's a 50% chance to spawn a new passenger.
    if (Math.random() > 0.5) {
      const passenger = addEntity(world);
      addComponent(world, passenger, Passenger);
      addComponent(world, passenger, ChildOf(building));
      Passenger.floor[passenger] = 0;
      Passenger.destination[passenger] = 4;
      Passenger.state[passenger] = "waiting";
      Passenger.spawnedAt[passenger] = world.time.now;
    }
  }
}

function passengerReaperSystem(world: World) {
  const { Passenger } = world.components;
  const passengers = query(world, [Passenger]);

  for (const passenger of passengers) {
    if (
      world.time.now - Passenger.spawnedAt[passenger] >
      world.passengers.maxAge
    ) {
      removeEntity(world, passenger);
    }
  }
}

function update(world: World) {
  const now = performance.now();
  world.time.delta = now - world.time.now;
  world.time.elapsed += world.time.delta;
  world.time.now = now;

  buildingSystem(world);
  passengerSpawnerSystem(world);
  passengerReaperSystem(world);
}

function render(world: World) {
  const output = document.getElementById("output");

  if (!output) {
    return;
  }

  output.textContent = JSON.stringify(world, null, 2);
}

requestAnimationFrame(function animate() {
  update(world);
  render(world);
  requestAnimationFrame(animate);
});
