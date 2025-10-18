import {
  Hierarchy,
  observe,
  onAdd,
  onSet,
  query,
  type EntityId,
  type World,
} from "bitecs";
import { ChildOf, type Data, type Time } from "./shared";

/**
 * Graphic component.
 */
export type Graphic = {
  position: [number, number][];
  size: [number, number][];
  rotation: number[];
  scale: [number, number][];
  color: [number, number, number, number][];
  font: string[];
  text: string[];
  image: string[];
  pattern: string[];
};

/**
 * Rendering statistics.
 */
export type RenderStats = {
  delta: number;
  count: number;
  size: [number, number];
};

/**
 * Initialize world.
 */
export function initialize(
  world: World<{ components: { Graphic: Graphic }; rendering: RenderStats }>
) {
  const Graphic = {
    position: [],
    size: [],
    rotation: [],
    scale: [],
    color: [],
    font: [],
    text: [],
    image: [],
    pattern: [],
  } as Graphic;

  world.components.Graphic = Graphic;

  world.rendering = {
    delta: 0,
    count: 0,
    size: [800, 600],
  } as RenderStats;

  observe(world, onAdd(Graphic), (entityId: EntityId) => {
    Graphic.position[entityId] = [0, 0];
    Graphic.size[entityId] = [0, 0];
    Graphic.color[entityId] = [0, 0, 0, 1];
    Graphic.font[entityId] = "12 sans-serif";
    Graphic.text[entityId] = "";
    Graphic.rotation[entityId] = 0;
    Graphic.scale[entityId] = [1, 1];
    Graphic.image[entityId] = "";
    Graphic.pattern[entityId] = "";
  });

  observe(
    world,
    onSet(Graphic),
    (graphicId: EntityId, data: Partial<Data<Graphic>>) => {
      for (const [key, value] of Object.entries(data)) {
        Graphic[key as keyof Graphic][graphicId] = value;
      }
    }
  );
}

const images = new Map<string, HTMLImageElement>();

export function getImage(src: string): HTMLImageElement {
  if (!images.has(src)) {
    const img = new Image();
    img.src = src;
    images.set(src, img);
  }
  return images.get(src)!;
}

/**
 * Paint an entity and its children to the given canvas.
 */
export function paint(
  world: World<{ components: { Graphic: Graphic } }>,
  entityId: EntityId,
  ctx: CanvasRenderingContext2D
) {
  const { Graphic } = world.components;

  ctx.save();

  ctx.translate(...Graphic.position[entityId]);
  ctx.rotate(Graphic.rotation[entityId]);
  ctx.scale(...Graphic.scale[entityId]);

  if (Graphic.text[entityId]) {
    ctx.font = Graphic.font[entityId];
    ctx.fillText(Graphic.text[entityId], 0, 0);
  } else if (Graphic.image[entityId]) {
    const img = getImage(Graphic.image[entityId]);

    if (Graphic.pattern[entityId]) {
      const pattern = ctx.createPattern(img, Graphic.pattern[entityId]);

      if (!pattern) {
        throw new Error(
          `Failed to create pattern with image ${Graphic.image[entityId]}`
        );
      }

      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, ...Graphic.size[entityId]);
    } else {
      ctx.drawImage(
        img,
        0,
        0,
        Graphic.size[entityId][0],
        Graphic.size[entityId][1]
      );
    }
  } else {
    ctx.fillStyle = `rgba(${Graphic.color[entityId].join(", ")})`;
    ctx.fillRect(0, 0, ...Graphic.size[entityId]);
  }

  for (const childId of query(world, [Graphic, ChildOf(entityId)])) {
    paint(world, childId, ctx);
  }

  ctx.restore();
}

/**
 * Render the world.
 */
export function render(
  world: World<{
    components: { Graphic: Graphic };
    time: Time;
    rendering: RenderStats;
  }>,
  ctx: CanvasRenderingContext2D
) {
  const start = performance.now();

  ctx.canvas.width = world.rendering.size[0];
  ctx.canvas.height = world.rendering.size[1];

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const { Graphic } = world.components;

  for (const entityId of query(world, [Graphic, Hierarchy(ChildOf, 0)])) {
    paint(world, entityId, ctx);
  }

  world.rendering.count += 1;
  world.rendering.delta = performance.now() - start;
}
