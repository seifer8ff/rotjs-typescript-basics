import { KEYS, DIRS, Path } from "rot-js";
import { Game } from "../game";
import { Actor } from "./actor";
import { Point } from "../point";
import { InputUtility } from "../input-utility";
import { Tile, TileType } from "../tile";
import { WaitAction } from "../actions/waitAction";
import { Action } from "../actions/action";

export class Player implements Actor {
  tile: Tile;
  type: TileType;
  action: Action;
  goal: Action;
  private keyMap: { [key: number]: number };

  constructor(private game: Game, public position: Point) {
    this.tile = Tile.player;
    this.type = this.tile.type;

    this.keyMap = {};
    this.keyMap[KEYS.VK_W] = 0; // up
    this.keyMap[KEYS.VK_NUMPAD9] = 1;
    this.keyMap[KEYS.VK_D] = 2; // right
    this.keyMap[KEYS.VK_NUMPAD3] = 3;
    this.keyMap[KEYS.VK_S] = 4; // down
    this.keyMap[KEYS.VK_NUMPAD1] = 5;
    this.keyMap[KEYS.VK_A] = 6; // left
    this.keyMap[KEYS.VK_NUMPAD7] = 7;
  }

  public plan(): void {
    this.action = new WaitAction(this.game, this, this.position);
  }

  // act(): Promise<any> {
  //   console.log("person act");
  //   return this.action.run();
  // }

  // private pathTo(target: Point) {
  //   let astar = new Path.AStar(
  //     target.x,
  //     target.y,
  //     this.game.mapIsPassable.bind(this.game),
  //     { topology: 4 }
  //   );

  //   this.path = [];
  //   astar.compute(
  //     this.position.x,
  //     this.position.y,
  //     this.pathCallback.bind(this)
  //   );
  //   this.path.shift(); // remove actor's position
  // }

  act(): Promise<any> {
    return InputUtility.waitForInput(this.handleInput.bind(this));
  }

  private handleInput(event: KeyboardEvent): boolean {
    let validInput = false;
    let code = event.keyCode;
    if (code in this.keyMap) {
      let diff = DIRS[8][this.keyMap[code]];
      let newPoint = new Point(
        this.position.x + diff[0],
        this.position.y + diff[1]
      );
      if (!this.game.mapIsPassable(newPoint.x, newPoint.y)) {
        return;
      }
      this.position = newPoint;
      validInput = true;
    } else if (code === KEYS.VK_RETURN || code === KEYS.VK_SPACE) {
      this.game.checkBox(this.position.x, this.position.y);
      validInput = true;
    } else {
      validInput = code === KEYS.VK_NUMPAD5; // Wait a turn
    }
    this.game.userInterface.camera.centerOn(this.position.x, this.position.y);
    return validInput;
  }
}
