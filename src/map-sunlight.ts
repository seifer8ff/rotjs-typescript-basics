import { Game } from "./game";
import { Tile, TileType } from "./tile";
import Simplex from "rot-js/lib/noise/simplex";
import { LightManager } from "./light-manager";
import { inverseLerp, lerp, normalizeNoise } from "./misc-utility";
import { HeightLayer, MapWorld } from "./map-world";
import { Point } from "./point";
import { Biome } from "./biomes";

export enum LightPhase {
  "rising" = 0,
  "peak" = 1,
  "setting" = 2,
}

export enum SunLevels {
  Bright = "Bright",
  Sunny = "Sunny",
  Clear = "Clear",
  Overcast = "Overcast",
  Dark = "Dark",
}

// export const TempMap = {
//   [SunLevels.Bright]: {
//     min: 0.85,
//     max: 1,
//   },
//   [SunLevels.Sunny]: {
//     min: 0.65,
//     max: 0.85,
//   },
//   [SunLevels.Clear]: {
//     min: 0.4,
//     max: 0.65,
//   },
//   [SunLevels.Overcast]: {
//     min: 0.2,
//     max: 0.4,
//   },
//   [SunLevels.Dark]: {
//     min: 0,
//     max: 0.2,
//   },
// };

export const HeightDropoff = {
  Hole: 0.25,
  Valley: 0.5,
  SeaLevel: 0.7,
  LowHill: 0.8,
  MidHill: 0.9,
  HighHill: 1,
};

export class MapSunlight {
  public lightManager: LightManager;
  public sunMap: { [key: string]: number };
  public terrainTileMap: { [key: string]: Tile };
  public sunScale: number;
  public sunPosition: Point;
  public maxShadowLength: number;
  public shadowLength: number;
  public shadowStrength: number;
  public sundownOffsetMap: [number, number][][];
  public sunupOffsetMap: [number, number][][];
  public dropoffMaps: {
    [direction: string]: {
      [shadowLength: string]: { [index: string]: number };
    };
  };

  constructor(private game: Game, private map: MapWorld) {
    this.sunMap = {};

    this.sunScale = 1;
    this.shadowStrength = 1;
    this.sunPosition = new Point(0, 0);
    this.maxShadowLength = 4;
    this.shadowLength = 0;
    this.sunupOffsetMap = [];
    this.sundownOffsetMap = [];
    this.dropoffMaps = {};
    this.dropoffMaps["sunup"] = {};
    this.dropoffMaps["sundown"] = {};
    for (let i = 0; i < this.maxShadowLength + 1; i++) {
      this.dropoffMaps["sunup"][i] = {};
      this.dropoffMaps["sundown"][i] = {};
    }

    // decrease shadowlength at mid times
    // increase shadowlength at start and end times
  }

  public generateSunMap() {
    // at each step/update
    // orient the tiles according to angle * time of day
    // as time of day goes on, angle decreases I think
    // leading to a sun-like curve...hopefully
    // calculate sunlight for each tile
    // when moving from higher elevation to lower, decrease sunlight
    // check adjacent-by-angle tiles, and if higher height, reduce brightness by step
    // const sortedCoordMap = this.sortByHeight(this.map.biomeMap);

    // this.sortedCoordMap = this.orientMapReverse(); // working properly
    this.sunupOffsetMap = this.calcSunupMap();
    this.sundownOffsetMap = this.calcSundownMap();
    this.generateDropoffMaps();
    console.log("dropoffMaps", this.dropoffMaps);
    console.log("sunup map", this.sunupOffsetMap);
    this.updateSunMap();
  }

  public generateDropoffMaps() {
    // const sorted = this.calcSunupMap();
    // const reverseSorted = this.calcSundownMap();
    for (let i = 0; i < this.sunupOffsetMap.length; i++) {
      for (let j = 0; j < this.sunupOffsetMap[i].length; j++) {
        const coords = this.sunupOffsetMap[i][j];
        this.calcDropoff(
          coords[0],
          coords[1],
          i,
          j,
          this.sunupOffsetMap,
          "sunup"
        );
      }
    }

    for (let i = 0; i < this.sundownOffsetMap.length; i++) {
      for (let j = 0; j < this.sundownOffsetMap[i].length; j++) {
        const coords = this.sundownOffsetMap[i][j];
        this.calcDropoff(
          coords[0],
          coords[1],
          i,
          j,
          this.sundownOffsetMap,
          "sundown"
        );
      }
    }
  }

  // public generateDropoffMaps() {
  //   const sorted = this.orientMap();
  //   const revsereSorted = this.orientMapReverse();
  //   for (let i = 0; i < sorted.length; i++) {
  //     for (let j = 0; j < sorted[i].length; j++) {
  //       // const key = this.sortedCoordMap[i][j];
  //       // console.log("key", key);
  //       // const point = MapWorld.keyToPoint(key);
  //       // const x = point.x;
  //       // const y = point.y;
  //       const coords = this.sortedCoordMap[i][j];
  //       this.getDropoff(coords[0], coords[1], i, j);
  //       // this.dropoffMap[MapWorld.coordsToKey(coords[0], coords[1])] =
  //       //   this.getDropoff(coords[0], coords[1], i, j);
  //     }
  //   }
  // }

  public updateSunMap() {
    let dir;
    if (this.game.timeManager.lightPhase === LightPhase.peak) {
      return;
    }
    if (this.game.timeManager.lightPhase === LightPhase.rising) {
      dir = "sunup";
    } else {
      dir = "sundown";
    }
    for (let i = 0; i < this.sunupOffsetMap.length; i++) {
      for (let j = 0; j < this.sunupOffsetMap[i].length; j++) {
        const coords = this.sunupOffsetMap[i][j];
        const x = coords[0];
        const y = coords[1];
        this.sunMap[MapWorld.coordsToKey(x, y)] = this.getSunlightFor(
          x,
          y,
          dir
        );
      }
    }

    // console.log("sunlight map", this.sunMap);
  }

  public update(deltaTime: number) {
    // if (this.game.timeManager.isDayTime) {
    this.interpolateShadows(deltaTime);
    this.updateSunMap();
    // }
  }

  private interpolateShadows(deltaTime: number) {
    const lightTransitionPercent = this.game.timeManager.lightTransitionPercent;
    const remainingCyclePercent = this.game.timeManager.remainingCyclePercent;
    const phase = this.game.timeManager.lightPhase;
    if (phase === LightPhase.peak) {
      this.shadowLength = 0;
      this.shadowStrength = 1;
      return;
    }

    if (!this.game.timeManager.isDayTime) {
      this.shadowLength = 0;
      this.shadowStrength = 0;
      return;
    }

    let remainingLightTransitionPercent;
    if (phase === LightPhase.rising) {
      remainingLightTransitionPercent =
        (1 - remainingCyclePercent) / lightTransitionPercent;
      this.shadowLength = Math.round(
        lerp(remainingLightTransitionPercent, this.maxShadowLength, 0)
      );
    } else if (phase === LightPhase.setting) {
      remainingLightTransitionPercent =
        remainingCyclePercent / lightTransitionPercent;
      this.shadowLength = Math.round(
        lerp(remainingLightTransitionPercent, this.maxShadowLength, 0)
      );
    }
    this.shadowStrength = lerp(remainingLightTransitionPercent, 0, 0.02);
  }

  // public interpolateLightState(deltaTime: number) {
  //   // Interpolate between the current light state and the target light state based on
  //   // how much time has passed since the last frame
  //   this.ambientLight = Color.lerp(
  //     this.ambientLight,
  //     this.targetAmbientLight,
  //     deltaTime
  //   );
  // }

  // public generateSunMap() {
  //   console.log("generate sun map");
  //   // at each step/update
  //   // orient the tiles according to angle * time of day
  //   // as time of day goes on, angle decreases I think
  //   // leading to a sun-like curve...hopefully
  //   // calculate sunlight for each tile
  //   // when moving from higher elevation to lower, decrease sunlight
  //   // check adjacent-by-angle tiles, and if higher height, reduce brightness by step
  //   // const sortedCoordMap = this.sortByHeight(this.map.biomeMap);
  //   const sortedCoordMap = this.orientMap();
  //   console.log("sorted coord map", sortedCoordMap);
  //   for (let i = 0; i < sortedCoordMap.length; i++) {
  //     for (let j = 0; j < sortedCoordMap[i].length; j++) {
  //       const key = sortedCoordMap[i][j];
  //       // console.log("key", key);
  //       const point = MapWorld.keyToPoint(key);
  //       const x = point.x;
  //       const y = point.y;
  //       this.sunMap[key] = this.generateSunlightValue(
  //         x,
  //         y,
  //         this.game.gameSize.width,
  //         this.game.gameSize.height,
  //         sortedCoordMap,
  //         i,
  //         j,
  //         this.game.noise
  //       );
  //     }
  //   }

  //   console.log("sunlight map", this.sunMap);
  // }

  // public generateSunMap() {
  //   console.log("generate sun map");
  //   // at each step/update
  //   // orient the tiles according to angle * time of day
  //   // as time of day goes on, angle decreases I think
  //   // leading to a sun-like curve...hopefully
  //   // calculate sunlight for each tile
  //   // when moving from higher elevation to lower, decrease sunlight
  //   // check adjacent-by-angle tiles, and if higher height, reduce brightness by step
  //   // const sortedCoordMap = this.sortByHeight(this.map.biomeMap);
  //   const testSortedCoordMap = this.orientMap(this.map.biomeMap);
  //   console.log("--- test orientedmap", testSortedCoordMap);
  //   const sortedCoordMap = this.sortMap(this.map.biomeMap);
  //   console.log("sorted coord map", sortedCoordMap);
  //   for (let i = 0; i < sortedCoordMap.length; i++) {
  //     const key = sortedCoordMap[i];
  //     const point = MapWorld.keyToPoint(key);
  //     const x = point.x;
  //     const y = point.y;
  //     this.sunMap[key] = this.generateSunlightValue(
  //       x,
  //       y,
  //       this.game.gameSize.width,
  //       this.game.gameSize.height,
  //       i,
  //       sortedCoordMap,
  //       this.game.noise
  //     );

  //     // const totalTiles = this.game.gameSize.width * this.game.gameSize.height;
  //     // const testSunValue = 1 - i / totalTiles;
  //     // this.sunMap[key] = testSunValue;
  //     // this.generateSunlightValue(
  //     //   x,
  //     //   y,
  //     //   this.game.gameSize.width,
  //     //   this.game.gameSize.height,
  //     //   this.game.noise
  //     // );
  //   }
  //   // for (let i = 0; i < sortedCoordMap.length; i++) {
  //   //   const key = sortedCoordMap[i];
  //   //   const point = MapWorld.keyToPoint(key);
  //   //   const x = point.x;
  //   //   const y = point.y;
  //   //   this.generateSunlightValue(
  //   //     x,
  //   //     y,
  //   //     this.game.gameSize.width,
  //   //     this.game.gameSize.height,
  //   //     this.game.noise
  //   //   );
  //   // }

  //   console.log("sunlight map", this.sunMap);
  // }

  // private orientMap(
  //   map: { [key: string]: Biome },
  //   vector: Point = new Point(1, 1)
  // ): string[] {
  //   const rows = this.game.gameSize.height;
  //   const columns = this.game.gameSize.width;
  //   const total = columns + rows - 1;
  //   const result = [];

  //   // sort by scalar product of vector
  //   const sorted = Object.keys(map).sort((a, b) => {
  //     const pointA = MapWorld.keyToPoint(a);
  //     const pointB = MapWorld.keyToPoint(b);
  //     const scalarA = pointA.x * vector.x + pointA.y * vector.y;
  //     const scalarB = pointB.x * vector.x + pointB.y * vector.y;
  //     return scalarA - scalarB;
  //   });
  //   return sorted;
  // }

  private sortMap(
    map: { [key: string]: Biome },
    vector: Point = new Point(1, 1)
  ): string[] {
    const rows = this.game.gameSize.height;
    const columns = this.game.gameSize.width;
    const total = columns + rows - 1;
    const result = [];

    // sort by scalar product of vector
    const sorted = Object.keys(map).sort((a, b) => {
      const pointA = MapWorld.keyToPoint(a);
      const pointB = MapWorld.keyToPoint(b);
      const scalarA = pointA.x * vector.x + pointA.y * vector.y;
      const scalarB = pointB.x * vector.x + pointB.y * vector.y;
      return scalarA - scalarB;
    });
    return sorted;
  }

  private calcSundownMap(): [number, number][][] {
    const rows = this.game.gameSize.height;
    const columns = this.game.gameSize.width;
    const total = columns + rows - 1;
    const result = [];

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        const key = MapWorld.coordsToKey(j, i);
        // const el = key;
        const el = [j, i];
        const pos = j + rows - i - 1;

        if (!result[pos]) {
          result[pos] = [];
        }

        result[pos].unshift(el);
      }
    }

    return result;
  }

  private calcSunupMap(): [number, number][][] {
    const rows = this.game.gameSize.height;
    const columns = this.game.gameSize.width;
    const total = columns + rows - 1;
    const result = [];

    for (let i = rows; i >= 0; i--) {
      for (let j = 0; j < columns; j++) {
        const key = MapWorld.coordsToKey(i, j);
        // const el = key;
        const el = [i, j];
        const pos = i + j;

        if (!result[pos]) {
          result[pos] = [];
        }

        result[pos].unshift(el);
      }
    }

    return result;
  }

  private getHeightDropoff(
    currentHeight: HeightLayer,
    previousHeight: HeightLayer
  ): number {
    let dropoff = HeightDropoff[previousHeight] - HeightDropoff[currentHeight];
    if (dropoff > 0) {
      dropoff = 1 - dropoff;
      return dropoff;
    }
    return 0;
  }

  // public updateSunValue(
  //   x: number,
  //   y: number,
  //   row: number,
  //   index: number
  // ): number {
  //   const key = MapWorld.coordsToKey(x, y);
  //   const heightLevel = this.map.heightLayerMap[key];

  //   let lastRow;
  //   let lastHeightLevel;
  //   let dropoff = 0;
  //   let sunAmnt = 1;

  //   for (let i = 1; i < this.shadowLength + 1; i++) {
  //     lastRow = this.sortedCoordMap[row - i];
  //     const lastIndex = index - i;
  //     lastHeightLevel = lastRow
  //       ? this.map.heightLayerMap[lastRow[lastIndex]]
  //       : heightLevel;
  //     dropoff = this.getHeightDropoff(heightLevel, lastHeightLevel);
  //     // console.log(dropoff);
  //     if (dropoff > 0) {
  //       sunAmnt *= dropoff;
  //     }
  //   }

  //   this.sunMap[key] = sunAmnt;
  //   return this.sunMap[key];
  // }

  public calcDropoff(
    x: number,
    y: number,
    row: number,
    index: number,
    coordMap: [number, number][][],
    mapKey: string
  ): number {
    const key = MapWorld.coordsToKey(x, y);
    const heightLevel = this.map.heightLayerMap[key];

    let lastRow;
    let lastHeightLevel;
    let dropoff = 0;

    for (let i = 1; i < this.maxShadowLength + 1; i++) {
      lastRow = coordMap[row - i];
      const lastIndex = index - i;
      lastHeightLevel = lastRow
        ? this.map.heightLayerMap[lastRow[lastIndex]]
        : heightLevel;
      dropoff = this.getHeightDropoff(heightLevel, lastHeightLevel);
      if (this.dropoffMaps[mapKey][i] === undefined) {
        this.dropoffMaps[mapKey][i] = {};
      }
      this.dropoffMaps[mapKey][i][key] = dropoff;
    }

    return dropoff;
  }

  public getSunlightFor(
    x: number,
    y: number,
    dir: "sunup" | "sundown"
  ): number {
    const key = MapWorld.coordsToKey(x, y);
    // console.log("cal sunlight for", key, this.dropoffMaps, this.shadowLength);
    const map = this.dropoffMaps[dir][this.shadowLength];
    if (!map) {
      console.log("no map", this.shadowLength, dir, key);
      return 0;
    }
    const sunlight = map[key];
    return sunlight || 0;
  }

  // public generateSunlightValue(
  //   x: number,
  //   y: number,
  //   row: number,
  //   index: number
  // ): number {
  //   const key = MapWorld.coordsToKey(x, y);
  //   const heightLevel = this.map.heightLayerMap[key];

  //   let lastRow;
  //   let lastHeightLevel;
  //   let dropoff = 0;
  //   let sunAmnt = 1;

  //   for (let i = 1; i < this.shadowLength + 1; i++) {
  //     lastRow = this.sortedCoordMap[row - i];
  //     const lastIndex = index - i;
  //     lastHeightLevel = lastRow
  //       ? this.map.heightLayerMap[lastRow[lastIndex]]
  //       : heightLevel;
  //     dropoff = this.getHeightDropoff(heightLevel, lastHeightLevel);
  //     // console.log(dropoff);
  //     if (dropoff > 0) {
  //       sunAmnt *= dropoff;
  //     }
  //   }

  //   this.sunMap[key] = sunAmnt;
  //   return this.sunMap[key];
  // }

  setSunlight(x: number, y: number, sunlightAmount: number): void {
    this.sunMap[MapWorld.coordsToKey(x, y)] = sunlightAmount;
  }
}
