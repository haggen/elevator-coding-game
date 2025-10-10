import { addComponent, query, type World } from "bitecs";
import { rendering, setGraphical, type Graphical } from "./graphic";

/**
 * Component to represent a building.
 */
export const Building = {};

/**
 * Add Building component to an entity.
 */
export function setBuilding(
  world: World<{ components: { Building: typeof Building } }>,
  entityId: number
) {
  const { Building } = world.components;

  addComponent(world, entityId, Building);
}

/**
 * Update building graphics.
 */
export function updateBuildingGraphics(
  world: World<{
    components: { Building: typeof Building; Graphical: typeof Graphical };
    rendering: typeof rendering;
  }>
) {
  const { Building } = world.components;

  for (const buildingId of query(world, [Building])) {
    setGraphical(world, buildingId, {
      position: [0, 0],
      size: world.rendering.size,
      color: [255, 255, 255, 1],
    });
  }
}
