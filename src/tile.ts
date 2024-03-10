import { BiomeId } from "./biomes";

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
}
