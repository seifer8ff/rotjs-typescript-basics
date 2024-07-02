import { BiomeId, Biomes } from "./biomes";
import { DescriptionBlock } from "./entities/actor";
import PinIcon from "./shoelace/assets/icons/pin-map.svg";
import TextIcon from "./shoelace/assets/icons/card-text.svg";
import TempIcon from "./shoelace/assets/icons/thermometer-half.svg";
import MoistureIcon from "./shoelace/assets/icons/droplet.svg";
import SunIcon from "./shoelace/assets/icons/brightness-high.svg";
import MagnetIcon from "./shoelace/assets/icons/magnet.svg";
import HeightIcon from "./shoelace/assets/icons/arrow-up-short.svg";
import { PointerTarget } from "./camera";
import { AnimatedSprite, Assets, Graphics, Sprite } from "pixi.js";
import { update } from "lodash";
import { Point } from "./point";
import { Layer } from "./renderer";

// high level types
export const enum TileType {
  Terrain,
  Entity,
  Plant,
  Player, // later: any tile can be marked as the player
}

// combined enum of specific types of TileTypes
// can be used for pathing, z index, etc
export enum TileSubType {
  Human = "Human",
  Animal = "Animal", // land dweller
  Fish = "Fish", // water dweller
  Bird = "Bird", // air dweller
  Shrub = "Shrub",
  Tree = "Tree",
}

export const BaseTileKey = "base";

export interface Tileset {
  [tilesetIdentifier: string]: {
    [season: string]: {
      [tileName: string]: Tile;
    };
  };
}

export class Tile {
  static readonly size = 32;
  static readonly plantSize = 8;
  static readonly terrainTilePixelSize = 16; // actual pixel size of each terrain tile on disk
  static readonly player = new Tile(
    TileType.Player,
    "human_00",
    "human_00",
    "#D2D2D2"
  );
  static readonly person = new Tile(
    TileType.Entity,
    "human_00",
    "human_00",
    "#E7E6AC"
  );
  static readonly animal = new Tile(
    TileType.Entity,
    "sprites/mushroom_00/mushroom_00.json",
    "idle_000",
    "#C1BF69",
    ["idle"]
  );
  static readonly cow = new Tile(
    TileType.Entity,
    "sprites/cow_00/cow_00.json",
    "walk_down/walk_down_000",
    "#C1BF69",
    ["walk_up", "walk_right", "walk_left", "walk_down"]
  );
  static readonly seagull = new Tile(
    TileType.Entity,
    "sprites/bird_seagull/bird_seagull.json",
    "up/bird_seagull_up_000",
    "#C1BF69",
    ["up", "right", "left", "down"]
  );
  static readonly sharkBlue = new Tile(
    TileType.Entity,
    "sprites/shark_blue/shark_blue.json",
    "right/right_000",
    "#C1BF69",
    ["up", "right", "left", "down"]
  );
  static readonly shrub = new Tile(
    TileType.Plant,
    "plant-8x8",
    "plant-8x8",
    "#95C577"
  );
  static readonly tree = new Tile(
    TileType.Plant,
    "tree-trunk",
    "tree-trunk",
    "#95C577"
  );

  static Tilesets: Tileset = {};
  // sprite: Sprite | AnimatedSprite | Graphics;

  constructor(
    public readonly type: TileType,
    public readonly spritePath: string,
    public readonly iconPath: string,
    public readonly color: string,
    public readonly animationKeys?: string[],
    // public readonly animated: boolean = false,
    public readonly biomeId?: BiomeId
  ) {
    // if (animated) {
    //   const animations = Assets.cache.get(this.spritePath).data.frames;
    //   const animKeys = Object.keys(animations).sort();
    //   this.sprite = AnimatedSprite.fromFrames(animKeys);
    //   // (this.sprite as AnimatedSprite).animationSpeed =
    //   //   this.game.options.animationSpeed * this.game.timeManager.timeScale;
    //   (this.sprite as AnimatedSprite).loop = true;
    //   (this.sprite as AnimatedSprite).play();
    // } else {
    //   this.sprite = Sprite.from(this.spritePath);
    // }
  }

  public static translatePoint(position: Point, from: Layer, to: Layer): Point {
    if (from === to) return position;

    const ratio = Tile.size / Tile.plantSize;
    if (from === Layer.PLANT) {
      return new Point(
        Math.floor(position.x / ratio),
        Math.floor(position.y / ratio)
      );
    } else if (to === Layer.PLANT) {
      return new Point(position.x * ratio, position.y * ratio);
    }
  }

  // translate x or y position from one layer to another
  public static translate(
    positionParameter: number,
    from: Layer,
    to: Layer
  ): number {
    if (from === to) return positionParameter;

    const ratio = Tile.size / Tile.plantSize;
    if (from === Layer.PLANT) {
      return positionParameter / ratio;
    } else if (to === Layer.PLANT) {
      return positionParameter * ratio;
    }
  }

  public static getDescription(target: PointerTarget): DescriptionBlock[] {
    const descriptionBlocks: DescriptionBlock[] = [];
    if (!target) return descriptionBlocks;

    descriptionBlocks.push({
      icon: PinIcon,
      getDescription: (pointerTarget: PointerTarget) =>
        `${pointerTarget.position.x}, ${target.position.y}`,
    });
    if (target?.info) {
      descriptionBlocks.push({
        icon: TextIcon,
        getDescription: (pointerTarget: PointerTarget) =>
          `${pointerTarget?.info?.biome?.description || "Unknown Biome"}`,
      });
      descriptionBlocks.push({
        icon: TempIcon,
        getDescription: (pointerTarget: PointerTarget) =>
          `${Math.round(pointerTarget?.info?.temperaturePercent * 100)}°F`,
      });
      descriptionBlocks.push({
        icon: HeightIcon,
        getDescription: (pointerTarget: PointerTarget) =>
          `${Math.round(pointerTarget?.info?.height * 100)} height`,
      });
      descriptionBlocks.push({
        icon: MoistureIcon,
        getDescription: (pointerTarget: PointerTarget) =>
          `${Math.round(pointerTarget?.info?.moisture * 100)}% moisture`,
      });
      descriptionBlocks.push({
        icon: MagnetIcon,
        getDescription: (pointerTarget: PointerTarget) =>
          `${Math.round(pointerTarget?.info?.magnetism * 100)} magnetism`,
      });
      descriptionBlocks.push({
        icon: SunIcon,
        getDescription: (pointerTarget: PointerTarget) => {
          // console.log("update sunlight", pointerTarget);
          return `${
            Math.round(pointerTarget?.info?.sunlight * 100) || "??"
          }% light`;
        },
      });
    }

    return descriptionBlocks;
  }
}
