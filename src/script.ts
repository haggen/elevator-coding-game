import "./style.css";

import { addComponent, addEntity, query, setComponent } from "bitecs";
import { initialize as acting, updateActingCompletion } from "./acting";
import { initialize as building, updateBuildingGraphics } from "./building";
import {
  initialize as elevator,
  updateElevatorClosedState,
  updateElevatorDirection,
  updateElevatorGraphics,
  updateElevatorMovingState,
  updateElevatorOpenState,
} from "./elevator";
import { initialize as floor, updateFloorGraphics } from "./floor";
import { initialize as graphic, render } from "./graphic";
import {
  handlePassengerReaping,
  handlePassengerSpawning,
  initialize as passenger,
  updatePassengerGraphics,
  updatePassengerIndex,
  updatePassengerState,
} from "./passenger";
import { ChildOf, initialize as common, compileWorld } from "./shared";

/**
 * The world state.
 */
const world = compileWorld(
  common,
  graphic,
  acting,
  building,
  floor,
  elevator,
  passenger
);

/**
 * Save the world type.
 */
type World = typeof world;

function seed(world: World) {
  const { Floor, Graphic, Elevator, Building } = world.components;

  const buildingId = addEntity(world);
  addComponent(world, buildingId, Building);
  addComponent(world, buildingId, Graphic);

  for (let index = 0; index < 7; index++) {
    const floorId = addEntity(world);
    addComponent(world, floorId, ChildOf(buildingId));
    addComponent(world, floorId, Graphic);
    setComponent(world, floorId, Floor, { index });
  }

  const [floorId] = query(world, [Floor]);

  for (let index = 0; index < 1; index++) {
    const elevatorId = addEntity(world);
    addComponent(world, elevatorId, ChildOf(floorId));

    setComponent(world, elevatorId, Elevator, {
      index,
      state: "closed",
      queue: [],
    });

    addComponent(world, elevatorId, Graphic);
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

  updateActingCompletion(world);

  handlePassengerReaping(world);
  handlePassengerSpawning(world);
  updatePassengerIndex(world);
  updatePassengerState(world);

  updateElevatorDirection(world);
  updateElevatorClosedState(world);
  updateElevatorOpenState(world);
  updateElevatorMovingState(world);

  updateBuildingGraphics(world);
  updateFloorGraphics(world);
  updateElevatorGraphics(world);
  updatePassengerGraphics(world);

  world.simulation.count += 1;
  world.simulation.delta = performance.now() - world.time.now;
}

// --
// --
// --

const ctx = document
  .querySelector<HTMLCanvasElement>("canvas")
  ?.getContext("2d")!;

seed(world);

requestAnimationFrame(function step() {
  update(world);
  render(world, ctx);
  requestAnimationFrame(step);
});
