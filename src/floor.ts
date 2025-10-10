import {
  addComponent,
  addEntity,
  getRelationTargets,
  query,
  type EntityId,
  type World,
} from "bitecs";
import { setGraphical, type Graphical } from "./graphic";
import { ChildOf } from "./shared";

/**
 * Component to represent the floor of a building.
 */
export const Floor = {
  index: [] as number[],
};

/**
 * Add or update Floor component on an entity.
 */
export function setFloor(
  world: World<{ components: { Floor: typeof Floor } }>,
  entityId: EntityId,
  data: Partial<{ index: number }>
) {
  const { Floor } = world.components;

  addComponent(world, entityId, Floor);

  Floor.index[entityId] = data.index ?? Floor.index[entityId] ?? 0;
}

/**
 * Update floor graphics.
 */
export function updateFloorGraphics(
  world: World<{
    components: { Floor: typeof Floor; Graphical: typeof Graphical };
  }>
) {
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

    const index = Floor.index[floorId];

    setGraphical(world, textId, {
      position: [
        Graphical.size[floorId][0] - 60,
        Graphical.size[floorId][1] / 2 + 6,
      ],
      color: [255, 255, 255, 1],
      font: "20px monospace",
      text: `${index}`,
    });

    const [buildingId] = getRelationTargets(world, floorId, ChildOf);

    const height = 80;
    const gap = 2;

    setGraphical(world, floorId, {
      position: [
        0,
        Graphical.size[buildingId][1] - height - gap - (height + gap) * index,
      ],
      size: [Graphical.size[buildingId][0], height],
      color: [100, 100, 100, 1],
    });
  }
}
