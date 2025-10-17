import { query, setComponent, type World } from "bitecs";
import { type Graphic, type RenderStats } from "./graphic";

/**
 * Building component.
 */
export type Building = {};

/**
 * Initialize module.
 */
export function initialize(
  world: World<{ components: { Building: Building } }>
) {
  const Building = {} as Building;
  world.components.Building = Building;
}

/**
 * Update graphics for each building.
 */
export function updateBuildingGraphics(
  world: World<{
    components: { Building: Building; Graphic: Graphic };
    rendering: RenderStats;
  }>
) {
  const { Building, Graphic } = world.components;

  for (const buildingId of query(world, [Building])) {
    setComponent(world, buildingId, Graphic, {
      size: world.rendering.size,
      color: [255, 255, 255, 1],
    });
  }
}
