import { Point } from "../point";
import { Tile, TileSubType, TileType } from "../tile";
import { Action } from "../actions/action";
import { AnimatedSprite, DisplayObject, Graphics, Sprite } from "pixi.js";

export interface Actor {
  id: number;
  name?: string;
  position: Point;
  tile: Tile;
  type: TileType;
  subType: TileSubType;
  action: Action; // intermediary action to take to reach goal action
  goal: Action; // end goal action of the actor
  sprite: DisplayObject;

  draw(): void; // render self to cache/screen
  plan(): void;
  act(): Promise<any>;
  getDescription(): DescriptionBlock[];
}

export interface DescriptionBlock {
  icon: string;
  text: string;
}

export function isActor(object: any): object is Actor {
  return "id" in object && "position" in object;
}
