import { Game } from "../game";
import { Actor, DescriptionBlock } from "./actor";
import { Point } from "../point";
import { Tile, TileType } from "../tile";
import { Action } from "../actions/action";
import { WaitAction } from "../actions/waitAction";
import { RNG } from "rot-js";
import TypeIcon from "../shoelace/assets/icons/person-vcard.svg";
import GoalIcon from "../shoelace/assets/icons/geo-alt.svg";
import ActionIcon from "../shoelace/assets/icons/sign-turn-slight-right.svg";

export class Shrub implements Actor {
  id: number;
  name?: string;
  tile: Tile;
  type: TileType;
  goal: Action;
  action: Action;

  constructor(private game: Game, public position: Point) {
    this.id = Date.now() + RNG.getUniformInt(0, 100000);
    this.name = "Shrub";
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

  public getDescription(): DescriptionBlock[] {
    const descriptionBlocks = [];
    descriptionBlocks.push({ icon: TypeIcon, text: "Shrub" });
    if (this.goal) {
      descriptionBlocks.push({ icon: GoalIcon, text: this.goal.name });
    }
    if (this.action) {
      descriptionBlocks.push({ icon: ActionIcon, text: this.action.name });
    }
    return descriptionBlocks;
  }
}
