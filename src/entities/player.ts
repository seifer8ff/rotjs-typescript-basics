import { KEYS, DIRS, Path, RNG } from "rot-js";
import { Game } from "../game";
import { Actor, DescriptionBlock } from "./actor";
import { Point } from "../point";
import { InputUtility } from "../input-utility";
import { Tile, TileSubType, TileType } from "../tile";
import { WaitAction } from "../actions/waitAction";
import { Action } from "../actions/action";
import TypeIcon from "../shoelace/assets/icons/person-vcard.svg";
import GoalIcon from "../shoelace/assets/icons/geo-alt.svg";
import ActionIcon from "../shoelace/assets/icons/sign-turn-slight-right.svg";
import { Sprite, AnimatedSprite, Graphics, Assets } from "pixi.js";

export class Player implements Actor {
  id: number;
  tile: Tile;
  type: TileType;
  subType: TileSubType;
  action: Action;
  goal: Action;
  sprite: Sprite | AnimatedSprite | Graphics;
  private keyMap: { [key: number]: number };

  constructor(private game: Game, public position: Point) {
    this.id = Date.now() + RNG.getUniformInt(0, 100000);
    this.tile = Tile.player;
    this.type = this.tile.type;
    this.subType = TileSubType.Human;

    if (this.tile.animated) {
      const animations = Assets.cache.get(this.tile.spritePath).data.frames;
      const animKeys = Object.keys(animations).sort();
      this.sprite = AnimatedSprite.fromFrames(animKeys);
      (this.sprite as AnimatedSprite).animationSpeed =
        this.game.options.animationSpeed * this.game.timeManager.timeScale;
      (this.sprite as AnimatedSprite).loop = true;
      (this.sprite as AnimatedSprite).play();
    } else {
      this.sprite = Sprite.from(this.tile.spritePath);
    }

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

  draw() {
    console.log("render player");
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
      if (!this.game.isMapBlocked(newPoint.x, newPoint.y)) {
        return;
      }
      this.position = newPoint;
      validInput = true;
    } else if (code === KEYS.VK_RETURN || code === KEYS.VK_SPACE) {
      // this.game.checkBox(this.position.x, this.position.y);
      validInput = true;
    } else {
      validInput = code === KEYS.VK_NUMPAD5; // Wait a turn
    }
    this.game.userInterface.camera.centerOn(this.position.x, this.position.y);
    return validInput;
  }

  public getDescription(): DescriptionBlock[] {
    const descriptionBlocks = [];
    descriptionBlocks.push({ icon: TypeIcon, text: "Player" });
    if (this.goal) {
      descriptionBlocks.push({ icon: GoalIcon, text: this.goal.name });
    }
    if (this.action) {
      descriptionBlocks.push({ icon: ActionIcon, text: this.action.name });
    }
    return descriptionBlocks;
  }
}
