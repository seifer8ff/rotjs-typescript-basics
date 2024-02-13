import { Path } from "rot-js";
import { Game } from "../game";
import { Point } from "../point";
import { Tile, TileType } from "../tile";
import { Action } from "./action";
import { Actor } from "../entities/actor";

export class HarvestAction implements Action {
  readonly name: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: Actor,
    public targetPos: Point
  ) {
    this.name = "Harvest Action";
    this.durationInTurns = 10;
  }

  run(): Promise<any> {
    // TODO: interact with target tile
    console.log("harvest action");
    return Promise.resolve();
  }
}
