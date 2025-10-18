import {
  addComponent,
  addEntity,
  getRelationTargets,
  observe,
  onAdd,
  onSet,
  query,
  setComponent,
  type EntityId,
  type World,
} from "bitecs";
import { type Graphic } from "./graphic";
import { ChildOf, type Data } from "./shared";

/**
 * Floor component.
 */
export type Floor = {
  index: number[];
};

/**
 * Initialize module.
 */
export function initialize(world: World<{ components: { Floor: Floor } }>) {
  const Floor = {
    index: [],
  } as Floor;

  world.components.Floor = Floor;

  observe(world, onAdd(Floor), (entityId) => {
    Floor.index[entityId] = 0;
  });

  observe(
    world,
    onSet(Floor),
    (floorId: EntityId, data: Partial<Data<Floor>>) => {
      for (const [key, value] of Object.entries(data)) {
        Floor[key as keyof Floor][floorId] = value;
      }
    }
  );
}

/**
 * Update graphics for each floor.
 */
export function updateFloorGraphics(
  world: World<{
    components: { Floor: Floor; Graphic: Graphic };
  }>
) {
  const { Floor, Graphic } = world.components;

  for (const floorId of query(world, [Floor, Graphic])) {
    const index = Floor.index[floorId];
    const height = 64;
    const gap = 0;

    const [buildingId] = getRelationTargets(world, floorId, ChildOf);

    setComponent(world, floorId, Graphic, {
      position: [
        0,
        Graphic.size[buildingId][1] - height - gap - (height + gap) * index,
      ],
      size: [Graphic.size[buildingId][0], height],
      image: "./floor-tile.gif",
      pattern: "repeat-x",
    });

    const leftWall = query(world, [ChildOf(floorId), Graphic]).find((id) => {
      return ChildOf(floorId).role[id] === "left-wall";
    });

    if (leftWall === undefined) {
      const id = addEntity(world);
      addComponent(world, id, ChildOf(floorId));
      ChildOf(floorId).role[id] = "left-wall";
      setComponent(world, id, Graphic, {
        size: [height, height],
        image: "./floor-left-wall.gif",
      });
    }

    const rightWall = query(world, [ChildOf(floorId), Graphic]).find((id) => {
      return ChildOf(floorId).role[id] === "right-wall";
    });

    if (rightWall === undefined) {
      const id = addEntity(world);
      addComponent(world, id, ChildOf(floorId));
      ChildOf(floorId).role[id] = "right-wall";
      setComponent(world, id, Graphic, {
        position: [Graphic.size[buildingId][0] - height, 0],
        size: [height, height],
        image: "./floor-right-wall.gif",
      });
    }
  }
}
