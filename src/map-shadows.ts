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

// export const HeightDropoff = {
//   Hole: 0.01,
//   Valley: 0.15,
//   SeaLevel: 0.3,
//   LowHill: 0.8,
//   MidHill: 1.2,
//   HighHill: 1.5,
// };

export class MapShadows {
  public lightManager: LightManager;
  public shadowMap: { [key: string]: number };
  public targetShadowMap: { [key: string]: number };
  public occlusionMap: { [key: string]: number }; // TODO: NEW
  public targetOcclusionMap: { [key: string]: number }; // TODO: NEW
  public minShadowLength: number;
  public maxShadowLength: number;
  public shadowLength: number;
  public shadowStrength: number;
  public ambientOcclusionShadowStrength: number;
  public ambientLightStrength: number;
  public sundownOffsetMap: [number, number][][];
  public sunupOffsetMap: [number, number][][];
  public dropoffMaps: {
    [direction: string]: {
      [shadowLength: string]: { [index: string]: number };
    };
  };
  private oldShadowLength: number;
  private oldPhase: LightPhase;
  private testKey = `106,89`;

  constructor(private game: Game, private map: MapWorld) {
    this.shadowMap = {};
    this.targetShadowMap = {};
    this.occlusionMap = {};
    this.targetOcclusionMap = {};

    for (let i = 0; i < this.game.options.gameSize.width; i++) {
      for (let j = 0; j < this.game.options.gameSize.height; j++) {
        this.shadowMap[MapWorld.coordsToKey(i, j)] = 1;
        this.targetShadowMap[MapWorld.coordsToKey(i, j)] = 1;
        this.occlusionMap[MapWorld.coordsToKey(i, j)] = 1;
        this.targetOcclusionMap[MapWorld.coordsToKey(i, j)] = 1;
      }
    }

    this.shadowStrength = 1;
    this.ambientOcclusionShadowStrength = 1;
    this.minShadowLength = 0;
    this.maxShadowLength = 5;
    this.ambientLightStrength = 0.8;
    this.shadowLength = this.maxShadowLength;
    this.oldShadowLength = this.shadowLength;
    this.oldPhase = this.game.timeManager.lightPhase;
    this.sunupOffsetMap = [];
    this.sundownOffsetMap = [];
    this.dropoffMaps = {};
    this.dropoffMaps["sunup"] = {};
    this.dropoffMaps["sundown"] = {};
    this.dropoffMaps["topdown"] = {};
    for (let i = 0; i < this.maxShadowLength + 1; i++) {
      // start with 0 instead of minShadowLength to account for special case shadow maps, like the topdown map
      this.dropoffMaps["sunup"][i] = {};
      this.dropoffMaps["sundown"][i] = {};
      this.dropoffMaps["topdown"][i] = {};
    }
  }

  public generateShadowMaps() {
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
    this.updateOcclusionShadowMap(false);
    this.updateOcclusionShadowMap(true);
    this.updateShadowMap(false, "sunup");
    this.updateShadowMap(true, "sunup");
    console.log(
      "initial sunmap update done",
      this.shadowMap,
      this.targetShadowMap,
      this.occlusionMap,
      this.targetOcclusionMap
    );
    this.interpolateShadowState(this.game.userInterface.camera.viewportTiles);
  }

  public generateDropoffMaps() {
    // const sorted = this.calcSunupMap();
    // const reverseSorted = this.calcSundownMap();
    const heightLayerAdjacencyMap = this.map.heightLayerAdjacencyD1Map;
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

    for (let i = 0; i < this.game.options.gameSize.width; i++) {
      for (let j = 0; j < this.game.options.gameSize.height; j++) {
        const key = MapWorld.coordsToKey(i, j);
        const adjacent = this.map.getAdjacent(i, j, heightLayerAdjacencyMap);
        if (adjacent) {
          this.calcTopDownDropoff(i, j, adjacent);
        }
      }
    }
  }

  public updateOcclusionShadowMap(calculateTarget: boolean = true) {
    let mapToUpdate = {};
    if (calculateTarget) {
      for (let key in this.targetOcclusionMap) {
        mapToUpdate[key] = this.targetOcclusionMap[key];
      }
    } else {
      for (let key in this.occlusionMap) {
        mapToUpdate[key] = this.occlusionMap[key];
      }
    }
    for (let x = 0; x < this.game.options.gameSize.width; x++) {
      for (let y = 0; y < this.game.options.gameSize.height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        mapToUpdate[key] = this.getShadowFor(x, y, "topdown");
      }
    }

    if (!calculateTarget) {
      for (let key in this.occlusionMap) {
        this.occlusionMap[key] = mapToUpdate[key];
      }
    } else {
      for (let key in this.targetOcclusionMap) {
        this.targetOcclusionMap[key] = mapToUpdate[key];
      }
    }
  }

  public updateShadowMap(calculateTarget = true, dir: "sunup" | "sundown") {
    let mapToUpdate = {};
    if (calculateTarget) {
      mapToUpdate = this.targetShadowMap;
    } else {
      mapToUpdate = this.shadowMap;
    }
    const offsetMap =
      dir === "sunup" ? this.sunupOffsetMap : this.sundownOffsetMap;
    for (let i = 0; i < offsetMap.length; i++) {
      for (let j = 0; j < offsetMap[i].length; j++) {
        const coords = offsetMap[i][j];
        const x = coords[0];
        const y = coords[1];
        mapToUpdate[MapWorld.coordsToKey(x, y)] = this.getShadowFor(x, y, dir);
      }
    }
  }

  public turnUpdate() {
    // shadow strength only changes when the time of day changes,
    // which only changes after a turn is taken
    this.interpolateStrength();
    // shadow direction and length are discrete values, only update on turn change
    this.updateShadowDirection();
    this.updateShadowLength();
  }

  public renderUpdate(interpPercent: number) {
    // move towards targetShadowMap from shadowMap every frame
    this.interpolateShadowState(this.game.userInterface.camera.viewportTiles);
  }

  private updateShadowDirection() {
    if (this.oldPhase !== this.game.timeManager.lightPhase) {
      // switch direction of shadows on phase changes
      this.oldPhase = this.game.timeManager.lightPhase;
      this.updateShadowMap(true, this.getShadowDir());
    }
  }

  private updateShadowLength() {
    if (this.oldShadowLength !== this.shadowLength) {
      this.oldShadowLength = this.shadowLength;
      // change length of shadow map when shadowLength changes
      this.updateShadowMap(true, this.getShadowDir());
    }
  }

  private getShadowDir(): "sunup" | "sundown" {
    return this.game.timeManager.lightPhase === LightPhase.rising ||
      this.game.timeManager.lightPhase === LightPhase.peak
      ? "sunup"
      : "sundown";
  }

  private interpolateStrength() {
    // shadows change length and strength by time to light transition rather than deltaTime
    const lightTransitionPercent = this.game.timeManager.lightTransitionPercent;
    const remainingCyclePercent = this.game.timeManager.remainingCyclePercent;
    const phase = this.game.timeManager.lightPhase;

    let remainingLightTransitionPercent;
    let shadowStrength = this.shadowStrength;
    let ambientShadowStrength = this.ambientOcclusionShadowStrength;
    if (phase === LightPhase.rising) {
      remainingLightTransitionPercent =
        (1 - remainingCyclePercent) / lightTransitionPercent;
      this.shadowLength = Math.round(
        lerp(
          remainingLightTransitionPercent,
          this.maxShadowLength,
          this.minShadowLength
        )
      );
      shadowStrength = lerp(remainingLightTransitionPercent, 0, 0.8);
      ambientShadowStrength = lerp(remainingLightTransitionPercent, 1, 0.3);
    } else if (phase === LightPhase.setting) {
      remainingLightTransitionPercent =
        remainingCyclePercent / lightTransitionPercent;
      this.shadowLength = Math.round(
        lerp(
          remainingLightTransitionPercent,
          this.maxShadowLength,
          this.minShadowLength
        )
      );
      shadowStrength = lerp(remainingLightTransitionPercent, 0, 0.8);
      ambientShadowStrength = lerp(remainingLightTransitionPercent, 1, 0.3);
    }
    this.ambientOcclusionShadowStrength =
      Math.round(ambientShadowStrength * 1000) / 1000;
    this.shadowStrength = Math.round(shadowStrength * 1000) / 1000;
  }

  public interpolateShadowState(keys: string[]) {
    // smoothly transition between shadowMap and targetShadowMap over time
    let val: number;
    const progress = this.game.timeManager.turnAnimTimePercent;
    // console.log(progress);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      val = lerp(progress, this.shadowMap[key], this.targetShadowMap[key]);
      this.shadowMap[key] = val;
    }
  }

  // private sortMap(
  //   map: { [key: string]: Biome },
  //   vector: Point = new Point(1, 1)
  // ): string[] {
  //   const rows = this.game.options.gameSize.height;
  //   const columns = this.game.options.gameSize.width;
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

  private calcSundownMap(): [number, number][][] {
    const rows = this.game.options.gameSize.height;
    const columns = this.game.options.gameSize.width;
    const total = columns + rows - 1;
    const result = [];

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        const key = MapWorld.coordsToKey(j, i);
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
    const rows = this.game.options.gameSize.height;
    const columns = this.game.options.gameSize.width;
    const total = columns + rows - 1;
    const result = [];

    for (let i = rows; i >= 0; i--) {
      for (let j = 0; j < columns; j++) {
        const key = MapWorld.coordsToKey(i, j);
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
      // since this is used to represent light later, we want to measure the drop between ambient light and 0 light
      dropoff = lerp(this.ambientLightStrength, 0, dropoff);
      return Math.round(dropoff * 1000) / 1000;
    }
    return 0;
  }

  private getOcclusionHeightDropoff(
    currentHeight: HeightLayer,
    previousHeight: HeightLayer
  ): number {
    // occlusion dropoff doesn't care about the ambient light strength limit.
    // will be used to lerp between two colors later
    let dropoff = HeightDropoff[previousHeight] - HeightDropoff[currentHeight];
    if (dropoff > 0) {
      dropoff = 1 - dropoff;
      return Math.round(dropoff * 1000) / 1000;
    }
    return 1;
  }

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

    for (let i = this.minShadowLength; i < this.maxShadowLength + 1; i++) {
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

  public calcTopDownDropoff(
    x: number,
    y: number,
    adjacent: HeightLayer[]
  ): number {
    const key = MapWorld.coordsToKey(x, y);
    const heightLevel = this.map.heightLayerMap[key];
    let dropoff = 0;
    for (let i = 0; i < adjacent.length; i++) {
      const adjacentHeightLayer = adjacent[i];
      const currentDropoff = this.getOcclusionHeightDropoff(
        heightLevel,
        adjacentHeightLayer
      );
      if (currentDropoff > 0) {
        if (dropoff === 0) {
          dropoff = currentDropoff;
        } else {
          dropoff *= currentDropoff;
        }
      }
    }
    dropoff = Math.round(dropoff * 1000) / 1000;
    this.dropoffMaps["topdown"][1][key] = dropoff;

    return dropoff;
  }

  private getShadowFor(
    x: number,
    y: number,
    dir: "sunup" | "sundown" | "topdown"
  ): number {
    const key = MapWorld.coordsToKey(x, y);
    // topdown has only 1 shadowLength
    const map =
      this.dropoffMaps[dir][dir === "topdown" ? "1" : this.shadowLength];
    if (!map) {
      console.log("no map", this.shadowLength, dir, key);
      return 0;
    }
    // if there is no dropoff, this tile gets full sun
    const sunlight = map[key] || this.ambientLightStrength;

    return sunlight;
  }

  setShadow(x: number, y: number, sunlightAmount: number): void {
    this.shadowMap[MapWorld.coordsToKey(x, y)] = sunlightAmount;
  }

  public onEnter(positions: Point[]): void {
    // immediately update the shadow map when a tile enters the viewport
    const dir = this.getShadowDir();
    positions.forEach((pos) => {
      const key = MapWorld.coordsToKey(pos.x, pos.y);
      const lvl = this.getShadowFor(pos.x, pos.y, dir);
      this.targetShadowMap[key] = lvl;
      this.shadowMap[key] = lvl;
    });
  }
}
