import { Point } from "../point";
import { Tile, TileSubType, TileType } from "../tile";
import { Action } from "../actions/action";
import { PointerTarget } from "../camera";
import { Renderable } from "../renderer";

export type Actor = {
  id: number;
  name?: string;
  position: Point;
  tile: Tile;
  type: TileType;
  subType: TileSubType;
  action: Action;
  goal: Action;
  sprite: Renderable;
  draw(): void; // render self to cache/screen
  plan(): void;
  act(): Promise<any>;
  updateFacing?(moveVector: [number, number]): void;
  getDescription(): DescriptionBlock[];
};

export interface DescriptionBlock {
  icon: string;
  getDescription: (pointerTarget?: PointerTarget) => string;
}

export function isActor(object: any): object is Actor {
  return object && "id" in object && "position" in object;
}
