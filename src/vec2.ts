export type Vec2 = [number, number];

function add(a: Vec2, b: number | Vec2): Vec2 {
  if (typeof b === "number") {
    return [a[0] + b, a[1] + b];
  }
  return [a[0] + b[0], a[1] + b[1]];
}

function subtract(a: Vec2, b: number | Vec2): Vec2 {
  if (typeof b === "number") {
    return [a[0] - b, a[1] - b];
  }
  return [a[0] - b[0], a[1] - b[1]];
}

function multiply(a: Vec2, b: number | Vec2): Vec2 {
  if (typeof b === "number") {
    return [a[0] * b, a[1] * b];
  }
  return [a[0] * b[0], a[1] * b[1]];
}

function divide(a: Vec2, b: number | Vec2): Vec2 {
  if (typeof b === "number") {
    return [a[0] / b, a[1] / b];
  }
  return [a[0] / b[0], a[1] / b[1]];
}

function length(a: Vec2): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}

function normalize(a: Vec2): Vec2 {
  const l = length(a);
  if (l === 0) {
    return [0, 0];
  }
  return divide(a, l);
}

export const Vec2 = {
  add,
  subtract,
  multiply,
  divide,
  length,
  normalize,
};
