import { Path } from "rot-js";
import { Game } from "../game";
import { Point } from "../point";
import { Tile, TileType } from "../tile";
import { Action } from "./action";
import { Actor } from "../entities/actor";

export class WanderAction implements Action {
  readonly name: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: Actor,
    public targetPos: Point
  ) {
    this.name = "Wander Around";
    this.durationInTurns = 3;
  }

  run(): Promise<any> {
    return Promise.resolve();
  }
}
