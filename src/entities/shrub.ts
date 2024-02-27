import { Game } from "../game";
import { Actor } from "./actor";
import { Point } from "../point";
import { Tile, TileType } from "../tile";
import { Action } from "../actions/action";
import { WaitAction } from "../actions/waitAction";
import { RNG } from "rot-js";

export class Shrub implements Actor {
  id: number;
  tile: Tile;
  type: TileType;
  goal: Action;
  action: Action;

  constructor(private game: Game, public position: Point) {
    this.id = Date.now() + RNG.getUniformInt(0, 100000);
    this.tile = Tile.shrub;
    this.type = this.tile.type;
  }

  public plan(): void {
    this.action = new WaitAction(this.game, this, this.position);
  }

  act(): Promise<any> {
    console.log("ACT - shrub - TODO");
    // this.action.run();
    return Promise.resolve();
  }
}
