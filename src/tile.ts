export const enum TileType {
  Wall = 0, // order/value is CRITICAL
  Floor = 1,
  Entity,
  Plant,
  Player,
  CutTree, // TODO: remove
  TreeStump, // TODO: remove
}

export enum Season {
  Spring = "SPRING",
  Summer = "SUMMER",
  Fall = "FALL",
  Winter = "SPRING",
}

export type Biome = "grassland" | "ocean" | "desert";

export interface TilesetMeta {
  name: string; // basic identifier for the tileset
  prefix: string; // filename prefix to append the tileNumber to: grass_spring_ -> grass_spring_00
  color: string;
  season: Season;
}

export interface Tileset {
  [tilesetIdentifier: string]: {
    [season: string]: {
      [tileName: string]: Tile;
    };
  };
}

export class Tile {
  static readonly size = 16;
  static readonly player = new Tile(
    TileType.Player,
    "biomes/grassland/player_01",
    "#D2D2D2"
  );
  static readonly person = new Tile(
    TileType.Player,
    "biomes/grassland/player_01",
    "#E7E6AC"
  );
  static readonly animal = new Tile(
    TileType.Entity,
    "biomes/grassland/entity-mushroom",
    "#C1BF69"
  );
  static readonly water = new Tile(
    TileType.Wall,
    "biomes/grassland/grassland_spring_577",
    "#95C9F6"
  );
  static readonly shrub = new Tile(
    TileType.Plant,
    "biomes/grassland/grassland_spring_075",
    "#95C577"
  );
  static readonly cutTree = new Tile(
    TileType.CutTree,
    "TODO cut tree",
    "#FF4AE7"
  );
  static readonly treeStump = new Tile(
    TileType.TreeStump,
    "TODO tree stump",
    "#FF4AE7"
  );

  static readonly AutoTilesets: TilesetMeta[] = [
    {
      name: "grassland",
      prefix: "biomes/grassland/grassland_spring_ground_",
      color: "#d3ffd8",
      season: Season.Spring,
    },
    {
      name: "ocean",
      prefix: "biomes/ocean/ocean_dirt_",
      color: "#0080e5",
      season: Season.Spring,
    },
  ];

  static Tilesets: Tileset = {};

  constructor(
    public readonly type: TileType,
    public readonly sprite: string,
    public readonly color: string
  ) {}
}
