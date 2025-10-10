import "./style.css";

import { addComponent, addEntity, createWorld, query } from "bitecs";
import { Acting, tickActing } from "./acting";
import { Building, setBuilding, updateBuildingGraphics } from "./building";
import {
  Elevator,
  setElevator,
  updateElevatorGraphics,
  updateElevatorState,
} from "./elevator";
import { Floor, setFloor, updateFloorGraphics } from "./floor";
import { Graphical, render, rendering, setGraphical } from "./graphic";
import {
  Passenger,
  managePassengerLifecycle,
  updatePassengerGraphics,
  updatePassengerState,
} from "./passenger";
import { ChildOf, simulation, time } from "./shared";

/**
 * The world state.
 */
const world = createWorld({
  components: { Acting, Elevator, Passenger, Floor, Building, Graphical },
  time,
  simulation,
  rendering,
});

type World = typeof world;

/**
 * Seed the world.
 */
function initialize(world: World) {
  const { Floor } = world.components;

  const buildingId = addEntity(world);
  setBuilding(world, buildingId);
  setGraphical(world, buildingId);

  for (let index = 0; index < 7; index++) {
    const floorId = addEntity(world);
    addComponent(world, floorId, ChildOf(buildingId));
    setFloor(world, floorId, { index });
    setGraphical(world, floorId);
  }

  const [floorId] = query(world, [Floor]);

  for (let index = 0; index < 1; index++) {
    const elevatorId = addEntity(world);
    addComponent(world, elevatorId, ChildOf(floorId));

    setElevator(world, elevatorId, {
      index,
      state: "closed",
      queue: [],
    });

    setGraphical(world, elevatorId);
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

  tickActing(world);

  managePassengerLifecycle(world);

  updateElevatorState(world);
  updatePassengerState(world);

  updateBuildingGraphics(world);
  updateFloorGraphics(world);
  updatePassengerGraphics(world);
  updateElevatorGraphics(world);

  world.simulation.count += 1;
  world.simulation.delta = performance.now() - world.time.now;
}

// --
// --
// --

const ctx = document
  .querySelector<HTMLCanvasElement>("canvas")
  ?.getContext("2d")!;

initialize(world);

requestAnimationFrame(function step() {
  update(world);
  render(ctx, world);
  requestAnimationFrame(step);
});
