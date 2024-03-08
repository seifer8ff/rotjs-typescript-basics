import { Path } from "rot-js";
import { Game } from "../game";
import { Point } from "../point";
import { Action } from "./action";
import { Actor } from "../entities/actor";

export class WaitAction implements Action {
  readonly name: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: Actor,
    public targetPos: Point
  ) {
    this.name = "Wait";
    this.durationInTurns = 1;
  }

  run(): Promise<any> {
    // TODO: add animations/sprite shake effect
    return Promise.resolve();
  }
}
