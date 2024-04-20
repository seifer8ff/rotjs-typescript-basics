import { DIRS } from "rot-js";

export class Point {
  constructor(public x: number, public y: number) {}

  equals(point: Point): boolean {
    return this.x == point.x && this.y == point.y;
  }

  toKey(): string {
    return `${this.x},${this.y}`;
  }

  manhattanDistance(point: Point): number {
    return Math.abs(this.x - point.x) + Math.abs(this.y - point.y);
  }

  distance(point: Point): number {
    return Math.sqrt(
      Math.pow(this.x - point.x, 2) + Math.pow(this.y - point.y, 2)
    );
  }

  // return value is a tuple of [dx, dy]
  // i.e. [1, 0] for right
  movementVector(point: Point): [number, number] {
    // return DIRS[4][2] for down
    // return DIRS[4][3] for right
    // return DIRS[4][0] for up
    // return DIRS[4][1] for left
    let dx = point.x - this.x;
    let dy = point.y - this.y;
    if (dx == 0 && dy == 0) {
      return [0, 0];
    }
    if (dx == 0) {
      return (dy > 0 ? DIRS[4][0] : DIRS[4][2]) as [number, number];
    }
    if (dy == 0) {
      return (dx > 0 ? DIRS[4][3] : DIRS[4][1]) as [number, number];
    }
    return [0, 0];
  }

  add(point: Point): Point {
    return new Point(this.x + point.x, this.y + point.y);
  }
}
