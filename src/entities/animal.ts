import { Path } from "rot-js";
import { Game } from "../game";
import { Actor } from "./actor";
import { Point } from "../point";
import { Tile, TileType } from "../tile";
import { Action } from "../actions/action";
import { MoveAction } from "../actions/moveAction";
import { WaitAction } from "../actions/waitAction";
import { HarvestAction } from "../actions/harvestAction";

export class Animal implements Actor {
  tile: Tile;
  type: TileType;
  action: Action;
  goal: Action;
  private target: Point;
  private path: Point[];

  constructor(private game: Game, public position: Point) {
    this.tile = Tile.animal;
    this.type = this.tile.type;
    this.path = [];
  }

  public plan(): void {
    // console.log("animal planning move");
    if (this.goal) {
      // console.log("has goal");
      // has goal
      // at goal position?
      if (!this.position.equals(this.goal.targetPos)) {
        // console.log("not at goal position");
        // has goal, not at goal position

        if (this.path.length < 1) {
          // has goal, no path
          // calculate new path
          this.pathTo(this.goal.targetPos);
        }

        // check path length again, as pathTo may have been called
        if (this.path.length > 0) {
          if (this.game.occupiedByEntity(this.path[0].x, this.path[0].y)) {
            // wait for a clear path
            this.action = new WaitAction(this.game, this, this.position);
            return;
          }
          // has goal, has path
          // return the next point on the path
          this.action = new MoveAction(
            this.game,
            this,
            this.path.shift() // make sure to remove the point
          );
          return;
        }
      }

      // has goal, at goal position
      this.action = this.goal;
      return;
    }

    // no goal
    // generate new goal
    const shrubTarget = this.game.getRandomPlantPositions(TileType.Shrub, 1)[0];
    if (shrubTarget) {
      // console.log("found shrub target, planning out intermediary");
      this.goal = new HarvestAction(this.game, this, shrubTarget);
      // plan out intermediary actions to reach goal
      this.plan();
      return;
    }

    // no shrubs to target
    // TODO: find a random tile to move to
    // console.log("no shrubs to target, wait action");
    this.action = new WaitAction(this.game, this, this.position);
    return;

    // find shrub

    /*
      // action exists?
        // yes: at location of action?
          // yes: return selected action
          // no: return move action
        // no: pick new action
          // at location of action?
            // yes: return selected action
            // no: return move action
    */
  }

  private pathTo(target: Point) {
    // console.log("path to");
    let astar = new Path.AStar(
      target.x,
      target.y,
      this.game.mapIsPassable.bind(this.game),
      { topology: 4 }
    );

    this.path = [];
    astar.compute(
      this.position.x,
      this.position.y,
      this.pathCallback.bind(this)
    );
    this.path.shift(); // remove actor's position
  }

  act(): Promise<any> {
    // console.log("animal act");
    // console.log("this.action: " + this.action.name);
    // console.log(
    //   `action posX: ${this.action.targetPos.x}, posY: ${this.action.targetPos.y}`
    // );
    // console.log(`this.position: ${this.position.x}, ${this.position.y}`);
    return this.action.run();
  }

  private pathCallback(x: number, y: number): void {
    // console.log("path callback");
    this.path.push(new Point(x, y));
  }
}
