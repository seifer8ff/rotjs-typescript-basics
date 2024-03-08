import { Season } from "./time-manager";

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

export type BiomeId = "default" | "ocean" | "moistdirt" | "sandydirt" | "hills";

export const BaseTileKey = "base";

// export type BiomeType =
//   | "grassland"
//   | "ocean"
//   | "dirt"
//   | "dirttextured"
//   | "sand"
//   | "oceandeep"
//   | "forestgrass"
//   | "hills"
//   | "swampdirt"
//   | "swampwater";

export interface Biome {
  id: BiomeId; // basic identifier for the tileset
  name: string; // human readable name
  description: string; // human readable description
  baseTile: string; // filename of the base tile
  autotileAgainst?: {
    biome: BiomeId;
    prefix: string;
  }[]; // filename prefix to append the tileNumber to: grass_spring_ -> grass_spring_00
  color: string;
  generationOptions: {
    height?: {
      min?: number;
      max?: number;
    };
    moisture?: {
      min?: number;
      max?: number;
    };
  };
}

export interface Tileset {
  [tilesetIdentifier: string]: {
    [season: string]: {
      [tileAgainstBiome: string]: {
        [tileName: string]: Tile;
      };
    };
  };
}

export class Tile {
  static readonly size = 16;
  static readonly player = new Tile(TileType.Player, "human_00", "#D2D2D2");
  static readonly person = new Tile(TileType.Entity, "human_00", "#E7E6AC");
  static readonly animal = new Tile(TileType.Entity, "mushroom_00", "#C1BF69");
  static readonly shrub = new Tile(TileType.Plant, "shrub_00", "#95C577");

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

  static readonly Biomes: { [key in BiomeId]?: Biome } = {
    ocean: {
      id: "ocean",
      name: "Ocean",
      description: "Endless water as far as the eye can see.",
      // autotilePrefix: "biomes/ocean/ocean_spring_sandydirt_",
      baseTile: "biomes/ocean/ocean_spring_sandydirt_00",
      // autotilePrefix: "biomes/ocean/ocean_",
      autotileAgainst: [
        { biome: "sandydirt", prefix: "biomes/ocean/ocean_spring_sandydirt_" },
        { biome: "default", prefix: "biomes/ocean/ocean_spring_moistdirt_" },
      ],
      color: "#0080e5",
      generationOptions: {
        height: {
          max: 0.5,
        },
      },
    },
    moistdirt: {
      // key will match BiomeType
      id: "moistdirt",
      name: "Dirt",
      description: "Thick soil.",
      baseTile: "biomes/moistdirt/moistdirt_base",
      // autotilePrefix: "biomes/moistdirt/moistdirt_",
      // autotileAgainst: [
      //   {
      //     biome: "default",
      //     prefix: "biomes/moistdirt/moistdirt_spring_sandydirt_",
      //   },
      // ],
      color: "#665b47",
      generationOptions: {
        height: {
          min: 0.5,
          max: 0.87,
        },
        moisture: {
          min: 0.2,
        },
      },
    },
    sandydirt: {
      id: "sandydirt",
      name: "Sandy Dirt",
      description: "The kind with little rocks and sharp bits.",
      baseTile: "biomes/sandydirt/sandydirt_spring_moistdirt_00",
      autotileAgainst: [
        {
          biome: "default",
          prefix: "biomes/sandydirt/sandydirt_spring_moistdirt_",
        },
      ],
      color: "#ddd29b",
      generationOptions: {
        height: {
          min: 0.5,
        },
        moisture: {
          min: 0,
          max: 1,
        },
      },
    },
    hills: {
      id: "hills",
      name: "Hills",
      description: "Rough terrain with a distinct lack of easy paths.",
      color: "#6e6864",
      baseTile: "biomes/hills/hills_spring_moistdirt_46",
      autotileAgainst: [
        { biome: "default", prefix: "biomes/hills/hills_spring_moistdirt_" },
      ],
      generationOptions: {
        height: {
          min: 0.75,
          max: 0.87,
        },
        moisture: {
          min: 0.3,
        },
      },
    },
  };

  // static readonly Biomes: { [key in BiomeType]: Biome } = {
  //   grassland: {
  //     // key will match BiomeType
  //     biome: "grassland",
  //     name: "Grassy Plains",
  //     description: "Gentle plains able to support a variety of plant life.",
  //     autotilePrefix: "biomes/grassland/grassland_spring_ground_",
  //     color: "#d3ffd8",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         min: 0.5,
  //         // max: 0.8,
  //       },
  //     },
  //   },
  //   hills: {
  //     biome: "hills",
  //     name: "Hills",
  //     description: "Rough terrain with a distinct lack of easy paths.",
  //     autotilePrefix: "biomes/hills/hills_grassland_",
  //     color: "#6e6864",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         min: 0.75,
  //         max: 1,
  //       },
  //     },
  //   },
  //   forestgrass: {
  //     biome: "forestgrass",
  //     name: "Forest Floor",
  //     description:
  //       "Layers of fallen leaves and thick grass covers the ground. ",
  //     autotilePrefix: "biomes/forestgrass/forestgrass_grassland_",
  //     color: "#2f9e77",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         min: 0.7,
  //         max: 0.8,
  //       },
  //     },
  //   },
  //   ocean: {
  //     biome: "ocean",
  //     name: "Ocean",
  //     description: "Endless water as far as the eye can see.",
  //     autotilePrefix: "biomes/ocean/ocean_dirt_",
  //     color: "#0080e5",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         max: 0.5,
  //       },
  //     },
  //   },
  //   dirt: {
  //     biome: "dirt",
  //     name: "Dirt",
  //     description: "The dirty kind.",
  //     autotilePrefix: "biomes/dirt/dirt_dirt_",
  //     color: "#e5e5a0",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         min: 0.4,
  //         max: 0.6,
  //       },
  //     },
  //   },
  //   dirttextured: {
  //     biome: "dirttextured",
  //     name: "Rough Dirt",
  //     description: "The kind with little rocks and sharp bits.",
  //     autotilePrefix: "biomes/dirttextured/dirttextured_dirt_",
  //     color: "#ddd29b",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         min: 0.8,
  //       },
  //     },
  //   },
  //   swampdirt: {
  //     biome: "swampdirt",
  //     name: "Swampy Ground",
  //     description: "Muddy, wet, and hard to move through.",
  //     autotilePrefix: "biomes/swampdirt/swampdirt_grassland_",
  //     color: "#665b47",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         min: 0.5,
  //         max: 0.7,
  //       },
  //     },
  //   },
  //   swampwater: {
  //     biome: "swampwater",
  //     name: "Murky Water",
  //     description:
  //       "Anything could be down there, hidden by the shimmering blackness...",
  //     autotilePrefix: "biomes/swampwater/swampwater_swampdirt_",
  //     color: "#39512f",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         min: 0.57,
  //         max: 0.62,
  //       },
  //     },
  //   },
  //   sand: {
  //     biome: "sand",
  //     name: "Sand",
  //     description: "Soft, sifting, sand.",
  //     autotilePrefix: "biomes/sand/sand_dirt_",
  //     color: "#f4f0c3",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         min: 0.3,
  //         max: 0.52,
  //       },
  //     },
  //   },
  //   oceandeep: {
  //     biome: "oceandeep",
  //     name: "Deep Ocean",
  //     description: "Deep and dark.",
  //     autotilePrefix: "biomes/oceandeep/oceandeep_ocean_",
  //     color: "#004db2",
  //     season: Season.Spring,
  //     generationOptions: {
  //       height: {
  //         max: 0.25,
  //       },
  //     },
  //   },
  // };

  static Tilesets: Tileset = {};

  constructor(
    public readonly type: TileType,
    public readonly sprite: string,
    public readonly color: string,
    public readonly biomeType?: BiomeId
  ) {}
}
