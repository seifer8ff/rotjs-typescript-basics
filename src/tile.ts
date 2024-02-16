export const enum TileType {
  Player,
  Person,
  Animal,
  Floor,
  Water,
  Shrub,
  CutTree,
  TreeStump,
}

export enum Season {
  Spring = "SPRING",
  Summer = "SUMMER",
  Fall = "FALL",
  Winter = "SPRING",
}

export type Biome = "grassland" | "desert";

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
  static readonly player = new Tile(TileType.Player, "player_01", "#D2D2D2");
  static readonly person = new Tile(TileType.Player, "player_01", "#E7E6AC");
  static readonly animal = new Tile(
    TileType.Animal,
    "entity-mushroom",
    "#C1BF69"
  );
  static readonly floor = new Tile(
    TileType.Floor,
    "grassland_spring_ground_00",
    "#C19A6B"
  );
  static readonly water = new Tile(
    TileType.Water,
    "grassland_spring_577",
    "#95C9F6"
  );
  static readonly shrub = new Tile(
    TileType.Shrub,
    "grassland_spring_075",
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
      prefix: "grassland_spring_ground_",
      color: "#d3ffd8",
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
