export type Vec4 = [number, number, number, number];

function add(a: Vec4, b: number | Vec4): Vec4 {
  if (typeof b === "number") {
    return [a[0] + b, a[1] + b, a[2] + b, a[3] + b];
  }
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
}

function subtract(a: Vec4, b: number | Vec4): Vec4 {
  if (typeof b === "number") {
    return [a[0] - b, a[1] - b, a[2] - b, a[3] - b];
  }
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
}

function multiply(a: Vec4, b: number | Vec4): Vec4 {
  if (typeof b === "number") {
    return [a[0] * b, a[1] * b, a[2] * b, a[3] * b];
  }
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2], a[3] * b[3]];
}

function divide(a: Vec4, b: number | Vec4): Vec4 {
  if (typeof b === "number") {
    return [a[0] / b, a[1] / b, a[2] / b, a[3] / b];
  }
  return [a[0] / b[0], a[1] / b[1], a[2] / b[2], a[3] / b[3]];
}

function length(a: Vec4): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]);
}

function normalize(a: Vec4): Vec4 {
  const l = length(a);
  if (l === 0) {
    return [0, 0, 0, 0];
  }
  return divide(a, l);
}

export const Vec4 = {
  add,
  subtract,
  multiply,
  divide,
  length,
  normalize,
};
