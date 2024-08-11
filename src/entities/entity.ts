import { Point } from "../point";
import { Tile, TileSubType, TileType } from "../tile";
import { Action } from "../actions/action";
import { PointerTarget } from "../camera";
import { Renderable } from "../renderer";

export interface EntityBase {
  id: number;
  name?: string;
  position?: Point;
  tile?: number;
  type?: TileType;
  subType?: TileSubType;
  action?: Action; // intermediary action to take to reach goal action
  goal?: Action; // end goal action of the actor
  sprite?: Renderable;
}

export enum ComponentType {
  id = "id",
  name = "name",
  position = "position",
  tile = "tile",
  type = "type",
  subType = "subType",
  action = "action",
  goal = "goal",
  sprite = "sprite",
}
