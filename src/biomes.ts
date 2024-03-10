export const Impassible: BiomeId[] = ["ocean", "oceandeep", "hills", "valley"];

export type BiomeId =
  | "default"
  | "ocean"
  | "beach"
  | "moistdirt"
  | "sandydirt"
  | "hills"
  | "valley"
  | "grass"
  | "shortgrass"
  | "hillgrass"
  | "swamp"
  | "oceandeep";

export interface Biome {
  id: BiomeId; // basic identifier for the tileset
  name: string; // human readable name
  description: string; // human readable description
  baseTile: string; // filename of the base tile
  autotilePrefix?: string; // filename prefix to append the tileNumber to: grass_spring_ -> grass_spring_00
  skipAutoTileTypes?: BiomeId[]; // list of biomes that should not be autotiled against
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

export class Biomes {
  public static inRange(
    value: number,
    range?: { min?: number; max?: number }
  ): boolean {
    if (!range) {
      return true;
    }
    if (!value) {
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
      baseTile: "biomes/ocean/ocean_spring_sandydirt_00",
      autotilePrefix: "biomes/ocean/ocean_spring_sandydirt_",
      skipAutoTileTypes: ["oceandeep"],
      color: "#0080e5",
      generationOptions: {
        height: {
          max: 0.5,
        },
      },
    },
    oceandeep: {
      id: "oceandeep",
      name: "Deep Ocean",
      description: "Deep and dark.",
      baseTile: "biomes/oceandeep/oceandeep_ocean_47",
      autotilePrefix: "biomes/oceandeep/oceandeep_spring_ocean_",
      color: "#004db2",
      generationOptions: {
        height: {
          max: 0.25,
        },
      },
    },

    beach: {
      id: "beach",
      name: "Beach",
      description: "Where the ocean meets the land.",
      baseTile: "biomes/beach/beach_spring_sandydirt_47",
      autotilePrefix: "biomes/beach/beach_spring_sandydirt_",
      color: "#e8d36a",
      generationOptions: {
        height: {
          min: 0.5,
          max: 0.52,
        },
      },
    },
    moistdirt: {
      // key will match BiomeType
      id: "moistdirt",
      name: "Dirt",
      description: "Thick soil.",
      baseTile: "biomes/moistdirt/moistdirt_base",
      // autotileAgainst: [
      //   {
      //     biome: "default",
      //     prefix: "biomes/moistdirt/moistdirt_spring_sandydirt_",
      //   },
      // ],
      color: "#665b47",
      generationOptions: {
        height: {
          min: 0.52,
          max: 0.82,
        },
        moisture: {
          min: 0.35,
        },
      },
    },
    sandydirt: {
      id: "sandydirt",
      name: "Sandy Dirt",
      description: "The kind with little rocks and sharp bits.",
      baseTile: "biomes/sandydirt/sandydirt_spring_moistdirt_00",
      autotilePrefix: "biomes/sandydirt/sandydirt_spring_moistdirt_",
      skipAutoTileTypes: ["beach", "ocean"],
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
      baseTile: "biomes/hills/hills_spring_moistdirt_47",
      autotilePrefix: "biomes/hills/hills_spring_moistdirt_",
      // { biome: "default", prefix: "biomes/hills/hills_spring_sandydirt_" },
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
    grass: {
      id: "grass",
      name: "Wild Grass",
      description: "Tall grass perfect for small animals to hide in.",
      color: "#74c857",
      baseTile: "biomes/grass/grass_spring_moistdirt_47",
      autotilePrefix: "biomes/grass/grass_spring_moistdirt_",
      generationOptions: {
        moisture: {
          min: 0.5,
          max: 0.7,
        },
      },
    },
    shortgrass: {
      id: "shortgrass",
      name: "Short Grass",
      description: "Pleasantly short grass, found commonly most everywhere.",
      color: "#74c857",
      baseTile: "biomes/shortgrass/shortgrass_spring_moistdirt_47",
      autotilePrefix: "biomes/shortgrass/shortgrass_spring_moistdirt_",
      generationOptions: {
        moisture: {
          min: 0.6,
          max: 0.8,
        },
      },
    },
    hillgrass: {
      id: "hillgrass",
      name: "Pale Grass",
      description: "Prickly and pale, this grass thrives at higher elevations.",
      color: "#398350",
      baseTile: "biomes/forestgrass/forestgrass_spring_moistdirt_47",
      autotilePrefix: "biomes/forestgrass/forestgrass_spring_moistdirt_",
      generationOptions: {
        height: {
          min: 0.75,
        },
        moisture: {
          min: 0.65,
          max: 0.8,
        },
      },
    },
    swamp: {
      id: "swamp",
      name: "Swamp",
      description: "The murky water could be hiding anything...",
      baseTile: "biomes/swamp/swamp_spring_moistdirt_47",
      autotilePrefix: "biomes/swamp/swamp_spring_moistdirt_",
      color: "#606d4c",
      generationOptions: {
        height: {
          min: 0.5,
          max: 0.6,
        },
        moisture: {
          min: 0.8,
        },
      },
    },
    valley: {
      id: "valley",
      name: "Valley",
      description: "A low-lying area protected by hills.",
      baseTile: "biomes/valley/valley_spring_moistdirt_47",
      autotilePrefix: "biomes/valley/valley_spring_moistdirt_",
      color: "#8df48d",
      generationOptions: {
        height: {
          min: 0.5,
          max: 0.6,
        },
        moisture: {
          min: 0.5,
          max: 0.8,
        },
      },
    },
  };

  constructor() {}
}
