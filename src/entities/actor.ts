import { Point } from "../point";
import { Tile, TileType } from "../tile";
import { Action } from "../actions/action";

export interface Actor {
  id: number;
  name?: string;
  position: Point;
  tile: Tile;
  type: TileType;
  action: Action; // intermediary action to take to reach goal action
  goal: Action; // end goal action of the actor

  plan(): void;
  act(): Promise<any>;
}
