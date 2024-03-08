import { Color, Map as RotJsMap } from "rot-js/lib/index";
import { RNG } from "rot-js";
import { Game } from "./game";
import { Biome, BiomeId, Tile, TileType } from "./tile";
import { Point } from "./point";
import { Actor } from "./entities/actor";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import PreciseShadowcasting from "rot-js/lib/fov/precise-shadowcasting";
import { LightManager } from "./light-manager";
import { lerp } from "./misc-utility";
import { MapWorld } from "./map-world";
import { clamp } from "rot-js/lib/util";

export enum Climates {
  Scorching = "Scorching",
  Hot = "Hot",
  Warm = "Warm",
  Cool = "Cool",
  Cold = "Cold",
  Freezing = "Freezing",
}

export const TempMap = {
  [Climates.Scorching]: {
    min: 0.85,
    max: 1,
  },
  [Climates.Hot]: {
    min: 0.7,
    max: 0.85,
  },
  [Climates.Warm]: {
    min: 0.5,
    max: 0.7,
  },
  [Climates.Cool]: {
    min: 0.3,
    max: 0.5,
  },
  [Climates.Cold]: {
    min: 0.15,
    max: 0.3,
  },
  [Climates.Freezing]: {
    min: 0,
    max: 0.15,
  },
};

export class MapTemperature {
  public lightManager: LightManager;
  public tempMap: { [key: string]: number };
  public terrainTileMap: { [key: string]: Tile };
  public temperatureScale: number;

  constructor(private game: Game, private map: MapWorld) {
    this.tempMap = {};
    this.temperatureScale = 1;
  }

  public generateInitialTemp(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Simplex
  ): number {
    const key = MapWorld.coordsToKey(x, y);
    const terrainHeight = this.map.heightMap[key];
    const terrainAboveSeaLevel = this.map.seaLevel - terrainHeight;
    // console.log("terrainAboveSeaLevel", terrainAboveSeaLevel);

    // could just start with height map and don't do any extra noise
    // calculate distance from water for each tile
    // increase temp based on distance from water
    // decrease temp based on height
    // add noise to temp
    // add seasonality
    // add humidity
    // add wind

    let noiseX = x / width - 0.5;
    let noiseY = y / height - 0.5;
    noiseX = x / 35;
    noiseY = y / 35;
    let noiseValue = noise.get(noiseX, noiseY);
    noiseValue = Math.min(1, Math.max(-1, noiseValue));
    noiseValue = (noiseValue + 1) / 2;
    noiseValue = noiseValue * terrainHeight;
    // console.log("temp", noiseValue, terrainHeight);
    this.tempMap[key] = lerp(noiseValue * this.temperatureScale, 0, 1);
    // console.log("scaled temp", this.tempMap[key]);
    // this.tempMap[key] = lerp(noiseValue, 0, 1);
    return this.tempMap[key];
  }

  // generateMap(width: number, height: number): void {
  //   this.tempMap = {};

  //   const noise = new Simplex();

  //   for (let x = 0; x < width; x++) {
  //     for (let y = 0; y < height; y++) {
  //       const key = MapWorld.coordsToKey(x, y);
  //       const initialTemp = noise.get(x / 30, y / 30);
  //       this.tempMap[key] = lerp(initialTemp, 0, 1);
  //     }
  //   }
  //   console.log("tempMap", this.tempMap);
  // }

  setTemp(x: number, y: number, temp: number): void {
    this.tempMap[MapWorld.coordsToKey(x, y)] = temp;
  }

  getTile(x: number, y: number): Tile {
    return this.terrainTileMap[MapWorld.coordsToKey(x, y)];
  }

  getTileType(x: number, y: number): TileType {
    return this.terrainTileMap[MapWorld.coordsToKey(x, y)].type;
  }

  getCurrentClimate(x: number, y: number): Climates {
    const key = MapWorld.coordsToKey(x, y);
    const temp = this.tempMap[key];
    for (let climate in TempMap) {
      const range = TempMap[climate];
      if (temp >= range.min && temp <= range.max) {
        return climate as Climates;
      }
    }
  }
}
