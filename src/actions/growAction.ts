import { Path } from "rot-js";
import { Game } from "../game";
import { Point } from "../point";
import { Action } from "./action";
import { Actor } from "../entities/actor";
import { Tree } from "../entities/tree/tree";

export class GrowAction implements Action {
  readonly name: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: Actor,
    public targetPos: Point
  ) {
    this.name = "Grow";
    this.durationInTurns = 2;
  }

  run(): Promise<any> {
    // console.log("run Grow Action on actor: ", this.actor.name);
    if (this.actor instanceof Tree) {
      this.actor.growTree();
    }
    // run plant growth algo here and add a new tile if needed

    //  .....MAYBE......
    // pretend no energy costs for now
    // check collision left, up, right
    // if no collision up, 75% chance to grow up

    return Promise.resolve();
  }
}
