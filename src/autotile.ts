import { Biome, BiomeId } from "./biomes";
import { indexToPosition, positionToIndex } from "./misc-utility";
import { Layer } from "./renderer";
import { BaseTileKey, Tile } from "./tile";

export class Autotile {
  static NW = Math.pow(2, 0);
  static N = Math.pow(2, 1);
  static NE = Math.pow(2, 2);
  static W = Math.pow(2, 3);
  static E = Math.pow(2, 4);
  static SW = Math.pow(2, 5);
  static S = Math.pow(2, 6);
  static SE = Math.pow(2, 7);

  static BITMASK = {
    2: 44,
    8: 45,
    10: 39,
    11: 38,
    16: 43,
    18: 41,
    22: 40,
    24: 33,
    26: 31,
    27: 30,
    30: 29,
    31: 28,
    64: 42,
    66: 32,
    72: 37,
    74: 27,
    75: 25,
    80: 35,
    82: 19,
    86: 18,
    88: 21,
    90: 15,
    91: 14,
    94: 13,
    95: 12,
    104: 36,
    106: 26,
    107: 24,
    120: 21,
    122: 7,
    123: 6,
    126: 5,
    127: 4,
    208: 34,
    210: 17,
    214: 16,
    216: 22,
    218: 11,
    219: 10,
    222: 9,
    223: 8,
    248: 20,
    250: 3,
    251: 2,
    254: 1,
    255: 47,
    0: 46,
  };

  public static isAutoTileBorder(
    x: number,
    y: number,
    mapObject: { [pos: string]: number }
  ): boolean {
    const key = `${x},${y}`;
    const tileIndex = mapObject[key];
    if ((tileIndex as any) == BaseTileKey) {
      console.log(`tileIndex for ${key} is ${tileIndex}`);
    }
    if (tileIndex === 47) {
      return false;
    }

    return true;
  }

  public static isTileIndexAutoTileBorder(tileIndex: number): boolean {
    if (tileIndex === 47) {
      return false;
    }

    return true;
  }

  public static shouldAutoTile(
    mapObject: Map<number, Biome>,
    x: number,
    y: number,
    tileBiome: Biome
  ): boolean {
    const neighborPositions = [
      [x, y - 1], // north
      [x - 1, y], // west
      [x + 1, y], // east
      [x, y + 1], // south
      [x - 1, y - 1], // northwest
      [x + 1, y - 1], // northeast
      [x - 1, y + 1], // southwest
      [x + 1, y + 1], // southeast
    ];
    // let isMoistDirt;

    if (tileBiome == null) {
      return false;
    }
    // if (tileBiome.id === "moistdirt") {
    //   isMoistDirt = true;
    // }
    for (const [nx, ny] of neighborPositions) {
      // const neighborBiome = mapObject[`${nx},${ny}`];
      const neighborBiome = mapObject.get(
        positionToIndex(nx, ny, Layer.TERRAIN)
      );
      if (neighborBiome == null) {
        return false;
      }
      // if (isMoistDirt) {
      //   if (
      //     neighborBiome.id === "snowmoistdirt" ||
      //     neighborBiome.id === "moistdirt"
      //   ) {
      //     return true;
      //   }
      //   return false;
      // }
    }

    return true;
  }

  public static autotileLookup(
    mapObject: Map<number, Biome>,
    x_boundary: number,
    y_boundary: number,
    x: number,
    y: number,
    tileBiome: Biome
  ): number {
    let sum = 0;
    let n = false;
    let e = false;
    let s = false;
    let w = false;
    let skipBiomes;
    let onlyBiomes;
    if (tileBiome.skipAutoTileTypes) {
      skipBiomes = [tileBiome.id, ...tileBiome.skipAutoTileTypes];
    } else {
      skipBiomes = [tileBiome.id];
    }
    if (tileBiome.onlyAutoTileTypes) {
      onlyBiomes = tileBiome.onlyAutoTileTypes;
      skipBiomes = undefined; // if onlyBiomes is set, skipBiomes is ignored
    }

    if (
      y > 0 &&
      this.betterShouldAutotile(
        // mapObject[`${x},${y - 1}`].id,
        mapObject.get(positionToIndex(x, y - 1, Layer.TERRAIN)).id,
        onlyBiomes,
        skipBiomes
      )
    ) {
      n = true;
      sum += Autotile.N;
    }
    if (
      x > 0 &&
      this.betterShouldAutotile(
        // mapObject[`${x - 1},${y}`].id,
        mapObject.get(positionToIndex(x - 1, y, Layer.TERRAIN)).id,
        onlyBiomes,
        skipBiomes
      )
    ) {
      w = true;
      sum += Autotile.W;
    }
    if (
      x < x_boundary &&
      this.betterShouldAutotile(
        // mapObject[`${x + 1},${y}`].id,
        mapObject.get(positionToIndex(x + 1, y, Layer.TERRAIN)).id,
        onlyBiomes,
        skipBiomes
      )
    ) {
      e = true;
      sum += Autotile.E;
    }
    if (
      y < y_boundary &&
      this.betterShouldAutotile(
        // mapObject[`${x},${y + 1}`].id,
        mapObject.get(positionToIndex(x, y + 1, Layer.TERRAIN)).id,
        onlyBiomes,
        skipBiomes
      )
    ) {
      s = true;
      sum += Autotile.S;
    }

    if (
      n &&
      w &&
      y > 0 &&
      x > 0 &&
      this.betterShouldAutotile(
        // mapObject[`${x - 1},${y - 1}`].id,
        mapObject.get(positionToIndex(x - 1, y - 1, Layer.TERRAIN)).id,
        onlyBiomes,
        skipBiomes
      )
    )
      sum += Autotile.NW;
    if (
      n &&
      e &&
      y > 0 &&
      x < x_boundary &&
      this.betterShouldAutotile(
        // mapObject[`${x + 1},${y - 1}`].id,
        mapObject.get(positionToIndex(x + 1, y - 1, Layer.TERRAIN)).id,
        onlyBiomes,
        skipBiomes
      )
    )
      sum += Autotile.NE;
    if (
      s &&
      w &&
      y < y_boundary &&
      x > 0 &&
      this.betterShouldAutotile(
        // mapObject[`${x - 1},${y + 1}`].id,
        mapObject.get(positionToIndex(x - 1, y + 1, Layer.TERRAIN)).id,
        onlyBiomes,
        skipBiomes
      )
    )
      sum += Autotile.SW;
    if (
      s &&
      e &&
      x < x_boundary &&
      y < y_boundary &&
      this.betterShouldAutotile(
        // mapObject[`${x + 1},${y + 1}`].id,
        mapObject.get(positionToIndex(x + 1, y + 1, Layer.TERRAIN)).id,
        onlyBiomes,
        skipBiomes
      )
    )
      sum += Autotile.SE;

    return Autotile.BITMASK[sum];
  }

  public static betterShouldAutotile(
    biome: BiomeId,
    onlyBiomes: BiomeId[],
    skipBiomes: BiomeId[]
  ): boolean {
    if (onlyBiomes) {
      return !onlyBiomes.includes(biome);
    }
    if (skipBiomes) {
      return skipBiomes.includes(biome);
    }
    return true;
  }

  // public static autotileLookup(
  //   mapObject: { [pos: string]: Biome },
  //   x_boundary: number,
  //   y_boundary: number,
  //   x: number,
  //   y: number,
  //   tileBiome: Biome
  // ): number {
  //   let sum = 0;
  //   let n = false;
  //   let e = false;
  //   let s = false;
  //   let w = false;
  //   let skipBiomes;
  //   let onlyBiomes;
  //   if (tileBiome.skipAutoTileTypes) {
  //     skipBiomes = [tileBiome.id, ...tileBiome.skipAutoTileTypes];
  //   } else {
  //     skipBiomes = [tileBiome.id];
  //   }
  //   if (tileBiome.onlyAutoTileTypes) {
  //     onlyBiomes = tileBiome.onlyAutoTileTypes;
  //     skipBiomes = undefined; // if onlyBiomes is set, skipBiomes is ignored
  //   }

  //   if (y > 0 && skipBiomes.includes(mapObject[`${x},${y - 1}`].id)) {
  //     n = true;
  //     sum += Autotile.N;
  //   }
  //   if (x > 0 && skipBiomes.includes(mapObject[`${x - 1},${y}`].id)) {
  //     w = true;
  //     sum += Autotile.W;
  //   }
  //   if (x < x_boundary && skipBiomes.includes(mapObject[`${x + 1},${y}`].id)) {
  //     e = true;
  //     sum += Autotile.E;
  //   }
  //   if (y < y_boundary && skipBiomes.includes(mapObject[`${x},${y + 1}`].id)) {
  //     s = true;
  //     sum += Autotile.S;
  //   }

  //   if (
  //     n &&
  //     w &&
  //     y > 0 &&
  //     x > 0 &&
  //     skipBiomes.includes(mapObject[`${x - 1},${y - 1}`].id)
  //   )
  //     sum += Autotile.NW;
  //   if (
  //     n &&
  //     e &&
  //     y > 0 &&
  //     x < x_boundary &&
  //     skipBiomes.includes(mapObject[`${x + 1},${y - 1}`].id)
  //   )
  //     sum += Autotile.NE;
  //   if (
  //     s &&
  //     w &&
  //     y < y_boundary &&
  //     x > 0 &&
  //     skipBiomes.includes(mapObject[`${x - 1},${y + 1}`].id)
  //   )
  //     sum += Autotile.SW;
  //   if (
  //     s &&
  //     e &&
  //     x < x_boundary &&
  //     y < y_boundary &&
  //     skipBiomes.includes(mapObject[`${x + 1},${y + 1}`].id)
  //   )
  //     sum += Autotile.SE;

  //   return Autotile.BITMASK[sum];
  // }

  // public static autotile(mapObject: { [pos: string]: Biome }): {
  //   [pos: string]: number;
  // } {
  //   console.log("autotile rawMapObj: ", mapObject);
  //   const tiles = {};
  //   const mapKeys = Object.keys(mapObject);
  //   const [maxX, maxY] = mapKeys.reduce(
  //     (acc, key) => {
  //       const [x, y] = key.split(",").map(Number);
  //       acc[0] = Math.max(acc[0], x);
  //       acc[1] = Math.max(acc[1], y);
  //       return acc;
  //     },
  //     [0, 0]
  //   );

  //   for (let y = 0; y <= maxY; y++) {
  //     for (let x = 0; x <= maxX; x++) {
  //       const key = `${x},${y}`;
  //       const tileValue = mapObject[key];

  //       if (!this.shouldAutoTile(mapObject, x, y, tileValue)) {
  //         tiles[key] = 47;
  //         continue;
  //       }

  //       tiles[key] = Autotile.autotileLookup(
  //         mapObject,
  //         maxX,
  //         maxY,
  //         x,
  //         y,
  //         tileValue
  //       );
  //     }
  //   }

  //   console.log("autotiled map: ", tiles);

  //   return tiles;
  // }

  public static autotile(mapObject: Map<number, Biome>): Map<number, number> {
    console.log("autotile rawMapObj: ", mapObject);
    // const tiles = {};
    const tiles = new Map<number, number>();
    const [maxX, maxY] = Array.from(mapObject).reduce(
      (acc, [index, biome]) => {
        const pos = indexToPosition(index, Layer.TERRAIN);
        acc[0] = Math.max(acc[0], pos.x);
        acc[1] = Math.max(acc[1], pos.y);
        return acc;
      },
      [0, 0]
    );
    let index = -1;

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= maxX; x++) {
        index = positionToIndex(x, y, Layer.TERRAIN);
        const tileValue = mapObject.get(index);

        if (!this.shouldAutoTile(mapObject, x, y, tileValue)) {
          tiles.set(index, 47);
          continue;
        }

        tiles.set(
          index,
          Autotile.autotileLookup(mapObject, maxX, maxY, x, y, tileValue)
        );
      }
    }

    console.log("autotiled map: ", tiles);

    return tiles;
  }
}
