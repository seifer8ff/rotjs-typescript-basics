import { Path } from "rot-js";
import { Game } from "../game";
import { Point } from "../point";
import { Tile, TileType } from "../tile";
import { Action } from "./action";
import { Actor } from "../entities/actor";

export class MoveAction implements Action {
  readonly name: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: Actor,
    public targetPos: Point
  ) {
    this.name = "Move To Point";
    this.durationInTurns = 1;
  }

  run(): Promise<any> {
    this.actor.position = new Point(this.targetPos.x, this.targetPos.y);
    // TODO: add animations/sprite shake effect
    return Promise.resolve();
  }
}
