import { Path, RNG } from "rot-js";
import { Game } from "../game";
import { Actor } from "./actor";
import { Point } from "../point";
import { Tile, TileType } from "../tile";
import { WaitAction } from "../actions/waitAction";
import { Action } from "../actions/action";
import { MoveAction } from "../actions/moveAction";

export class Person implements Actor {
  id: number;
  tile: Tile;
  type: TileType;
  goal: Action;
  action: Action;
  private path: Point[];

  constructor(private game: Game, public position: Point) {
    this.id = Date.now() + RNG.getUniformInt(0, 100000);
    this.tile = Tile.person;
    this.type = this.tile.type;
    this.path = [];
  }

  public plan(): void {
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
    const randTarget = this.game.getRandomTilePositions(
      Tile.Biomes.grassland.biome,
      1
    )[0];
    if (randTarget) {
      // console.log("found rand target, planning out intermediary");
      this.goal = new WaitAction(this.game, this, randTarget);
      // plan out intermediary actions to reach goal
      this.plan();
      return;
    }

    // no target found
    // console.log("no target found, wait action");
    this.action = new WaitAction(this.game, this, this.position);
    return;

    this.action = new WaitAction(this.game, this, this.position);
  }

  act(): Promise<any> {
    // console.log("person act");
    return this.action.run();
  }

  private pathTo(target: Point) {
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

  // act(): Promise<any> {
  //   console.log("person act");
  //   // let shrubPos = this.game
  //   let playerPosition = this.game.getPlayerPosition();
  //   if (playerPosition) {
  //     let astar = new Path.AStar(
  //       playerPosition.x,
  //       playerPosition.y,
  //       this.game.mapIsPassable.bind(this.game),
  //       { topology: 4 }
  //     );

  //     this.path = [];
  //     astar.compute(
  //       this.position.x,
  //       this.position.y,
  //       this.pathCallback.bind(this)
  //     );
  //     this.path.shift(); // remove Pedros position

  //     if (this.path.length > 0) {
  //       if (!this.game.occupiedByEntity(this.path[0].x, this.path[0].y)) {
  //         this.position = new Point(this.path[0].x, this.path[0].y);
  //       }
  //     }

  //     if (this.position.equals(playerPosition)) {
  //       this.game.catchPlayer(this);
  //     }
  //   }

  //   return Promise.resolve();
  // }

  private pathCallback(x: number, y: number): void {
    this.path.push(new Point(x, y));
  }
}
