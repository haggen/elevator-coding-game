import { addComponent, Hierarchy, query, type World } from "bitecs";
import { ChildOf, time, type Data } from "./shared";

/**
 * Rendering stats.
 */
export const rendering = {
  delta: 0,
  count: 0,
  size: [800, 600] as [number, number],
};

/**
 * Component for entities that have a graphic representation.
 */
export const Graphical = {
  position: [] as [number, number][],
  size: [] as [number, number][],
  rotation: [] as number[],
  scale: [] as [number, number][],
  color: [] as [number, number, number, number][],
  font: [] as string[],
  text: [] as string[],
};

/**
 * Add or update Graphical component on an entity.
 */
export function setGraphical(
  world: World<{ components: { Graphical: typeof Graphical } }>,
  entityId: number,
  data: Partial<Data<typeof Graphical>> = {}
) {
  const { Graphical } = world.components;

  addComponent(world, entityId, Graphical);

  Graphical.position[entityId] = data.position ??
    Graphical.position[entityId] ?? [0, 0];
  Graphical.size[entityId] = data.size ?? Graphical.size[entityId] ?? [0, 0];
  Graphical.color[entityId] = data.color ??
    Graphical.color[entityId] ?? [0, 0, 0, 0];
  Graphical.font[entityId] =
    data.font ?? Graphical.font[entityId] ?? "12 sans-serif";
  Graphical.text[entityId] = data.text ?? Graphical.text[entityId] ?? "";
  Graphical.rotation[entityId] =
    data.rotation ?? Graphical.rotation[entityId] ?? 0;
  Graphical.scale[entityId] = data.scale ?? Graphical.scale[entityId] ?? [1, 1];
}

/**
 * Paint an entity and its children to the given canvas.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  world: World<{ components: { Graphical: typeof Graphical } }>,
  entityId: number
) {
  const { Graphical } = world.components;

  ctx.save();

  ctx.translate(...Graphical.position[entityId]);
  ctx.rotate(Graphical.rotation[entityId]);
  ctx.scale(...Graphical.scale[entityId]);

  ctx.font = Graphical.font[entityId];
  ctx.fillStyle = `rgba(${Graphical.color[entityId].join(", ")})`;

  if (Graphical.text[entityId]) {
    ctx.fillText(Graphical.text[entityId], 0, 0);
  } else {
    ctx.fillRect(0, 0, ...Graphical.size[entityId]);
  }

  for (const childId of query(world, [Graphical, ChildOf(entityId)])) {
    paint(ctx, world, childId);
  }

  ctx.restore();
}

/**
 * Render the world.
 */
export function render(
  ctx: CanvasRenderingContext2D,
  world: World<{
    components: { Graphical: typeof Graphical };
    time: typeof time;
    rendering: typeof rendering;
  }>
) {
  const start = performance.now();

  ctx.canvas.width = world.rendering.size[0];
  ctx.canvas.height = world.rendering.size[1];

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const { Graphical } = world.components;

  for (const entityId of query(world, [Graphical, Hierarchy(ChildOf, 0)])) {
    paint(ctx, world, entityId);
  }

  world.rendering.count += 1;
  world.rendering.delta = performance.now() - start;
}
