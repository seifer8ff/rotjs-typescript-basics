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

// high level types
export const enum TileType {
  Terrain,
  Entity,
  Plant,
  Player, // later: any tile can be marked as the player
}

// combined enum of specific types of TileTypes
export enum TileSubType {
  Human = "Human",
  Animal = "Animal",
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
  static readonly size = 16;
  static readonly player = new Tile(TileType.Player, "human_00", "#D2D2D2");
  static readonly person = new Tile(TileType.Entity, "human_00", "#E7E6AC");
  static readonly animal = new Tile(TileType.Entity, "mushroom_00", "#C1BF69");
  static readonly shrub = new Tile(TileType.Plant, "shrub_00", "#95C577");

  static Tilesets: Tileset = {};

  constructor(
    public readonly type: TileType,
    public readonly sprite: string,
    public readonly color: string,
    public readonly biomeId?: BiomeId
  ) {}

  public static getDescription(target: PointerTarget): DescriptionBlock[] {
    const descriptionBlocks = [];
    descriptionBlocks.push({
      icon: PinIcon,
      text: `${target.position.x}, ${target.position.y}`,
    });
    if (target.info) {
      descriptionBlocks.push({
        icon: TextIcon,
        text: `${target.info.biome.description || "Unknown Biome"}`,
      });
      descriptionBlocks.push({
        icon: TempIcon,
        text: `${Math.round(target.info.temperature * 100)}°F`,
      });
      descriptionBlocks.push({
        icon: HeightIcon,
        text: `${Math.round(target.info.height * 100)} height`,
      });
      descriptionBlocks.push({
        icon: MoistureIcon,
        text: `${Math.round(target.info.moisture * 100) / 100} moisture`,
      });
      descriptionBlocks.push({
        icon: MagnetIcon,
        text: `${Math.round(target.info.magnetism * 100) / 100} magnetism`,
      });
      descriptionBlocks.push({
        icon: SunIcon,
        text: `${Math.round(target.info.sunlight * 100) / 100 || "??"} light`,
      });
    }

    return descriptionBlocks;
  }
}
