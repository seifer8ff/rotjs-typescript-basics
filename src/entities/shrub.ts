import { Game } from "../game";
import { Actor, DescriptionBlock } from "./actor";
import { Point } from "../point";
import { Tile, TileSubType, TileType } from "../tile";
import { Action } from "../actions/action";
import { WaitAction } from "../actions/waitAction";
import { RNG } from "rot-js";
import TypeIcon from "../shoelace/assets/icons/person-vcard.svg";
import GoalIcon from "../shoelace/assets/icons/geo-alt.svg";
import ActionIcon from "../shoelace/assets/icons/sign-turn-slight-right.svg";
import PinIcon from "../shoelace/assets/icons/pin-map.svg";
import { Layer } from "../renderer";
import { AnimatedSprite, Assets, Graphics, Sprite } from "pixi.js";
import { PointerTarget } from "../camera";

export class Shrub implements Actor {
  id: number;
  name?: string;
  tile: Tile;
  sprite: Sprite | AnimatedSprite | Graphics;
  subType: TileSubType;
  type: TileType;
  goal: Action;
  action: Action;

  constructor(private game: Game, public position: Point) {
    this.id = Date.now() + RNG.getUniformInt(0, 100000);
    this.name = "Shrub";
    this.tile = Tile.shrub;
    this.type = this.tile.type;
    this.subType = TileSubType.Shrub;

    if (this.tile.animationKeys) {
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
  }

  draw(): void {
    this.game.renderer.addToScene(this.position, Layer.PLANT, this.sprite);
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
    const descriptionBlocks: DescriptionBlock[] = [];
    descriptionBlocks.push({
      icon: PinIcon,
      getDescription: () => `${this.position.x}, ${this.position.y}`,
    });
    descriptionBlocks.push({
      icon: TypeIcon,
      getDescription: () => this.subType,
    });
    if (this.goal) {
      descriptionBlocks.push({
        icon: GoalIcon,
        getDescription: () => this.goal.name,
      });
    }
    if (this.action) {
      descriptionBlocks.push({
        icon: ActionIcon,
        getDescription: () => this.action.name,
      });
    }
    return descriptionBlocks;
  }
}
