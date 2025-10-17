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
    let [textId] = query(world, [Graphic, ChildOf(floorId)]).filter(
      (id) => ChildOf(floorId).role[id] === "text"
    );

    if (!textId) {
      textId = addEntity(world);
      ChildOf(floorId).role[textId] = "text";
      addComponent(world, textId, ChildOf(floorId));
    }

    const index = Floor.index[floorId];
    const size = Graphic.size[floorId];
    const height = 80;
    const gap = 2;

    setComponent(world, textId, Graphic, {
      position: [size[0] - height, size[1] / 2 + 6],
      color: [255, 255, 255, 1],
      font: "20px monospace",
      text: `${index}`,
    });

    const [buildingId] = getRelationTargets(world, floorId, ChildOf);

    setComponent(world, floorId, Graphic, {
      position: [
        0,
        Graphic.size[buildingId][1] - height - gap - (height + gap) * index,
      ],
      size: [Graphic.size[buildingId][0], height],
      color: [100, 100, 100, 1],
    });
  }
}
