import { Color } from "rot-js/lib/color";

export function lerp(a: number, x: number, y: number): number {
  return x * (1 - a) + y * a;
}

export function inverseLerp(a: number, x: number, y: number): number {
  return (a - x) / (y - x);
}

export function multiColorLerp(colors: Color[], t: number): Color {
  t = Math.max(0, Math.min(1, t));
  const delta = 1 / (colors.length - 1);
  const startIndex = Math.floor(t / delta);
  if (startIndex === colors.length - 1) {
    return colors[colors.length - 1];
  }
  const localT = (t % delta) / delta;
  return [
    lerp(localT, colors[startIndex][0], colors[startIndex + 1][0]),
    lerp(localT, colors[startIndex][1], colors[startIndex + 1][1]),
    lerp(localT, colors[startIndex][2], colors[startIndex + 1][2]),
  ];
}
