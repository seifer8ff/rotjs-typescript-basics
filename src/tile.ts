export const enum TileType {
  Wall = 0, // order/value is CRITICAL
  Floor = 1,
  Ocean,
  Grassland,
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

export type BiomeType =
  | "grassland"
  | "ocean"
  | "dirt"
  | "dirttextured"
  | "sand"
  | "oceandeep"
  | "forestgrass"
  | "hills"
  | "swampdirt"
  | "swampwater";

export interface Biome {
  biome: BiomeType; // basic identifier for the tileset
  autotilePrefix?: string; // filename prefix to append the tileNumber to: grass_spring_ -> grass_spring_00
  color: string;
  season: Season;
  generationOptions: {
    height?: {
      min?: number;
      max?: number;
    };
  };
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

  public static inRange(
    value: number,
    range?: { min?: number; max?: number }
  ): boolean {
    if (!range) {
      return true;
    }
    if (range.min && value < range.min) {
      return false;
    }
    if (range.max && value > range.max) {
      return false;
    }
    return true;
  }

  static readonly Biomes: { [key in BiomeType]: Biome } = {
    grassland: {
      // key will match BiomeType
      biome: "grassland",
      autotilePrefix: "biomes/grassland/grassland_spring_ground_",
      color: "#d3ffd8",
      season: Season.Spring,
      generationOptions: {
        height: {
          min: 0.5,
          // max: 0.8,
        },
      },
    },
    hills: {
      biome: "hills",
      autotilePrefix: "biomes/hills/hills_grassland_",
      color: "#e48989",
      season: Season.Spring,
      generationOptions: {
        height: {
          min: 0.75,
          max: 1,
        },
      },
    },
    forestgrass: {
      biome: "forestgrass",
      autotilePrefix: "biomes/forestgrass/forestgrass_grassland_",
      color: "#2f9e77",
      season: Season.Spring,
      generationOptions: {
        height: {
          min: 0.7,
          max: 0.8,
        },
      },
    },
    ocean: {
      biome: "ocean",
      autotilePrefix: "biomes/ocean/ocean_dirt_",
      color: "#0080e5",
      season: Season.Spring,
      generationOptions: {
        height: {
          max: 0.5,
        },
      },
    },
    dirt: {
      biome: "dirt",
      autotilePrefix: "biomes/dirt/dirt_dirt_",
      color: "#e5e5a0",
      season: Season.Spring,
      generationOptions: {
        height: {
          min: 0.4,
          max: 0.6,
        },
      },
    },
    dirttextured: {
      biome: "dirttextured",
      autotilePrefix: "biomes/dirttextured/dirttextured_dirt_",
      color: "#ddd29b",
      season: Season.Spring,
      generationOptions: {
        height: {
          min: 0.8,
        },
      },
    },
    swampdirt: {
      biome: "swampdirt",
      autotilePrefix: "biomes/swampdirt/swampdirt_grassland_",
      color: "#665b47",
      season: Season.Spring,
      generationOptions: {
        height: {
          min: 0.5,
          max: 0.7,
        },
      },
    },
    swampwater: {
      biome: "swampwater",
      autotilePrefix: "biomes/swampwater/swampwater_swampdirt_",
      color: "#39512f",
      season: Season.Spring,
      generationOptions: {
        height: {
          min: 0.57,
          max: 0.62,
        },
      },
    },
    sand: {
      biome: "sand",
      autotilePrefix: "biomes/sand/sand_dirt_",
      color: "#f4f0c3",
      season: Season.Spring,
      generationOptions: {
        height: {
          min: 0.3,
          max: 0.54,
        },
      },
    },
    oceandeep: {
      biome: "oceandeep",
      autotilePrefix: "biomes/oceandeep/oceandeep_ocean_",
      color: "#004db2",
      season: Season.Spring,
      generationOptions: {
        height: {
          max: 0.25,
        },
      },
    },
  };

  static Tilesets: Tileset = {};

  constructor(
    public readonly type: TileType,
    public readonly sprite: string,
    public readonly color: string,
    public readonly biomeType?: BiomeType
  ) {}
}
