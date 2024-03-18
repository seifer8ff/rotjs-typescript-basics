import { Game } from "./game";
import { Tile, TileType } from "./tile";
import Simplex from "rot-js/lib/noise/simplex";
import { LightManager } from "./light-manager";
import { lerp, normalizeNoise } from "./misc-utility";
import { MapWorld } from "./map-world";
import { Point } from "./point";

export enum SunLevels {
  Bright = "Bright",
  Sunny = "Sunny",
  Clear = "Clear",
  Overcast = "Overcast",
  Dark = "Dark",
}

export const TempMap = {
  [SunLevels.Bright]: {
    min: 0.85,
    max: 1,
  },
  [SunLevels.Sunny]: {
    min: 0.65,
    max: 0.85,
  },
  [SunLevels.Clear]: {
    min: 0.4,
    max: 0.65,
  },
  [SunLevels.Overcast]: {
    min: 0.2,
    max: 0.4,
  },
  [SunLevels.Dark]: {
    min: 0,
    max: 0.2,
  },
};

export class MapSunlight {
  public lightManager: LightManager;
  public sunMap: { [key: string]: number };
  public terrainTileMap: { [key: string]: Tile };
  public sunScale: number;
  public sunPosition: Point;

  constructor(private game: Game, private map: MapWorld) {
    this.sunMap = {};
    this.sunScale = 1;
    this.sunPosition = new Point(0, 0);
  }

  public generateSunMap() {
    console.log("generate sun map");
    const orientedBiomeMap = this.orientMap(this.map.biomeMap);
    console.log("orientedBiomeMap", orientedBiomeMap);
  }

  private orientMap(map: { [key: string]: any }) {
    const rows = this.game.gameSize.height;
    const columns = this.game.gameSize.width;
    const total = columns + rows - 1;
    const result = [];

    for (let i = rows - 1; i >= 0; i--) {
      for (let j = 0; j < columns; j++) {
        const key = MapWorld.coordsToKey(j, i);
        const el = map[key];
        const pos = j + rows - i - 1;

        if (!result[pos]) {
          result[pos] = [];
        }

        result[pos].unshift(el);
      }
    }

    return result;
  }

  public generateSunlightValue(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Simplex
  ): number {
    const key = MapWorld.coordsToKey(x, y);
    const terrainHeight = this.map.heightMap[key];
    const heightLevel = MapWorld.heightToLayer(terrainHeight);
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
    noiseValue = normalizeNoise(noiseValue);
    noiseValue = noiseValue * terrainHeight;
    // console.log("temp", noiseValue, terrainHeight);
    this.sunMap[key] = lerp(noiseValue * this.sunScale, 0, 1);
    // console.log("scaled temp", this.tempMap[key]);
    // this.tempMap[key] = lerp(noiseValue, 0, 1);
    return this.sunMap[key];
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

  setSunlight(x: number, y: number, sunlightAmount: number): void {
    this.sunMap[MapWorld.coordsToKey(x, y)] = sunlightAmount;
  }

  getTile(x: number, y: number): Tile {
    return this.terrainTileMap[MapWorld.coordsToKey(x, y)];
  }

  getTileType(x: number, y: number): TileType {
    return this.terrainTileMap[MapWorld.coordsToKey(x, y)].type;
  }

  getCurrentClimate(x: number, y: number): SunLevels {
    const key = MapWorld.coordsToKey(x, y);
    const temp = this.sunMap[key];
    for (let climate in TempMap) {
      const range = TempMap[climate];
      if (temp >= range.min && temp <= range.max) {
        return climate as SunLevels;
      }
    }
  }
}
