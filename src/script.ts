import "./style.css";

import { createWorld } from "bitecs";

const world = createWorld({
  components: {},
  time: {
    elapsed: 0,
    delta: 0,
    now: performance.now(),
  },
});

type World = typeof world;

function update(world: World) {
  const now = performance.now();
  world.time.delta = now - world.time.now;
  world.time.elapsed += world.time.delta;
  world.time.now = now;
}

requestAnimationFrame(function animate() {
  update(world);
  requestAnimationFrame(animate);
});
