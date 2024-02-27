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
}
