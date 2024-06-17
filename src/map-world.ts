import { Color, RNG } from "rot-js";
import { Game } from "./game";
import { BaseTileKey, Tile } from "./tile";
import { Point } from "./point";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import { LightManager } from "./light-manager";
import {
  getMapStats,
  getScaledNoise,
  lerp,
  positionToIndex,
} from "./misc-utility";
import { MapTemperature } from "./map-temperature";
import { MapMoisture } from "./map-moisture";
import { Season } from "./time-manager";
import { Biome, BiomeId, Biomes, ImpassibleBorder } from "./biomes";
import { Color as ColorType } from "rot-js/lib/color";
import { MapShadows } from "./map-shadows";
import { MapPoles } from "./map-poles";
import { MapClouds } from "./map-clouds";
import Noise from "rot-js/lib/noise/noise";
import { clamp } from "rot-js/lib/util";
import { Sprite } from "pixi.js";

export type Map = ValueMap | BiomeMap | TileMap;

export type ValueMap = {
  [key: string]: number;
};

export type BiomeMap = {
  [key: string]: Biome;
};

export type TileMap = Tile[];

export enum HeightLayer {
  Hole = "Hole",
  Valley = "Valley",
  SeaLevel = "SeaLevel",
  LowHill = "LowHill",
  MidHill = "MidHill",
  HighHill = "HighHill",
}

export const HeightColor = {
  [HeightLayer.LowHill]: Color.fromString("rgb(15, 15, 15)"),
  [HeightLayer.MidHill]: Color.fromString("rgb(30, 30, 30)"),
  [HeightLayer.HighHill]: Color.fromString("rgb(45, 45, 45)"),
};

export class MapWorld {
  public lightManager: LightManager;
  public terrainMap: BiomeMap; // the base terrain of the map (sandydirt, moistdirt, ocean)
  public biomeMap: BiomeMap; // the final map of biomes
  public autotileMap: ValueMap; // the final map of autotile indices
  public tileMap: TileMap; // the final map of tiles to be drawn (may or may not be autotiled)
  public heightMap: ValueMap;
  public heightLayerMap: { [key: string]: HeightLayer };
  public tempMap: MapTemperature;
  public moistureMap: MapMoisture;
  public shadowMap: MapShadows;
  public polesMap: MapPoles;
  public cloudMap: MapClouds;
  public seaLevel: number;

  public heightAdjacencyD1Map: number[][]; // adjacency map with distance of 1 tile
  public heightAdjacencyD2Map: number[][];
  public heightLayerAdjacencyD1Map: HeightLayer[][];
  public heightLayerAdjacencyD2Map: HeightLayer[][];

  //
  public terrainAdjacencyD1Map: Biome[][]; // adjacency map with distance of 1 tile
  public terrainAdjacencyD2Map: Biome[][];

  public biomeAdjacencyD1Map: Biome[][]; // adjacency map with distance of 1 tile
  public biomeAdjacencyD2Map: Biome[][];
  private dirtyTiles: number[];
  private landHeight: number;
  private valleyScaleFactor: number;
  private edgePadding: number;
  private islandMask: number;

  constructor(private game: Game) {
    this.tileMap = [];
    this.biomeMap = {};
    this.autotileMap = {};
    this.heightMap = {};
    this.heightLayerMap = {};
    this.moistureMap = new MapMoisture(this.game, this);
    this.tempMap = new MapTemperature(this.game, this);
    this.shadowMap = new MapShadows(this.game, this);
    this.polesMap = new MapPoles(this.game, this);
    this.cloudMap = new MapClouds(this.game, this);
    this.terrainMap = {};
    this.seaLevel = Biomes.Biomes.ocean.generationOptions.height.max;
    this.heightAdjacencyD1Map = [];
    this.heightAdjacencyD2Map = [];
    this.heightLayerAdjacencyD1Map = [];
    this.heightLayerAdjacencyD2Map = [];
    this.terrainAdjacencyD1Map = [];
    this.terrainAdjacencyD2Map = [];
    // this.terrainAdjacencyD1Map = {};
    // this.terrainAdjacencyD2Map = {};
    this.biomeAdjacencyD1Map = [];
    this.biomeAdjacencyD2Map = [];
    this.dirtyTiles = [];
    this.landHeight = 0.5;
    this.valleyScaleFactor = 2;
    this.edgePadding = 0;
    this.islandMask = 0.38;
  }

  public static biomeHeightToLayer(height: number, biome?: Biome): HeightLayer {
    // TODO: overhaul how valley/holes work. They probably should be below sealevel, but idk

    // if (height < Biomes.Biomes.valley.generationOptions.height.min) {
    //   return HeightLayer.Hole;
    // }
    // if (
    //   height >= Biomes.Biomes.valley.generationOptions.height.min &&
    //   height <= Biomes.Biomes.valley.generationOptions.height.max
    // ) {
    //   if (biome?.id == Biomes.Biomes.valley.id) {
    //     // valley can only exist on moistdirt
    //     // otherwise everything below seaLevel would be valley
    //     return HeightLayer.Valley;
    //   } else {
    //     return HeightLayer.SeaLevel;
    //   }
    // }
    if (height < Biomes.Biomes.hillslow.generationOptions.height.min) {
      return HeightLayer.SeaLevel;
    }
    if (height < Biomes.Biomes.hillsmid.generationOptions.height.min) {
      return HeightLayer.LowHill;
    }
    if (height < Biomes.Biomes.hillshigh.generationOptions.height.min) {
      return HeightLayer.MidHill;
    }
    if (height >= Biomes.Biomes.hillshigh.generationOptions.height.min) {
      return HeightLayer.HighHill;
    }
    return HeightLayer.SeaLevel;
  }

  public static heightToColor(height: number): ColorType {
    const heightLayer = MapWorld.biomeHeightToLayer(height);
    return HeightColor[heightLayer];
  }

  public static coordsToKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  public static keyToPoint(key: string): Point {
    let parts = key.split(",");
    return new Point(parseInt(parts[0]), parseInt(parts[1]));
  }

  generateMap(width: number, height: number): void {
    this.tileMap = [];
    this.biomeMap = {};
    this.heightMap = {}; // between 0 and 1
    this.terrainMap = {};
    this.dirtyTiles = [];

    // first pass, generate base height and assign terrain
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.polesMap.generateMagnetism(x, y, width, height, this.game.noise);
        this.heightMap[key] = this.getHeight(
          x,
          y,
          width,
          height,
          this.game.noise
        );
        this.terrainMap[key] = this.assignTerrain(x, y);
      }
    }
    console.log("poles map", this.polesMap.magnetismMap);
    // generate the adjacency map for future passes
    this.regenerateAdjacencyMap("height");
    this.regenerateAdjacencyMap("heightLayer");
    this.regenerateAdjacencyMap("terrain");
    // second pass, process terrain from first pass to smooth out issues
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.terrainMap[key] = this.processTerrain(x, y);
      }
    }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.heightLayerMap[key] = this.getHeightLayer(x, y);
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("terrain");
    // third pass, generate climate maps
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.moistureMap.generateMoistureFor(
          x,
          y,
          width,
          height,
          this.game.noise
        );
        this.tempMap.generateInitialTemp(x, y, width, height, this.game.noise);
      }
    }

    const stats = getMapStats(Object.values(this.tempMap.tempMap), [
      { label: "over90", threshold: 0.9 },
      { label: "over80", threshold: 0.8 },
      { label: "over70", threshold: 0.7 },
      { label: "over55", threshold: 0.55 },
      { label: "over32", threshold: 0.32 },
      {
        label: "under55",
        threshold: 0.55,
        isNegative: true,
      },
      {
        label: "under32",
        threshold: 0.32,
        isNegative: true,
      },
      {
        label: "under15",
        threshold: 0.15,
        isNegative: true,
      },
      {
        label: "under0",
        threshold: 0,
        isNegative: true,
      },
    ]);
    console.log("temp map", stats, this.tempMap.tempMap);
    // assign biome map using climate maps
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.biomeMap[key] = this.assignBiome(x, y);
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("biome");
    // assign biome map using climate maps
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.biomeMap[key] = this.addTemperatureTerrain(x, y);
        this.biomeMap[key] = this.addMidLayers(x, y);
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("biome");
    this.regenerateAdjacencyMap("height");
    this.regenerateAdjacencyMap("heightLayer");
    // add secondary features
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        // this.biomeMap[key] = this.addTemperatureFeatures(x, y);
        this.biomeMap[key] = this.addUpperLayers(x, y);
        this.biomeMap[key] = this.addLowerLayers(x, y);
      }
    }
    this.regenerateAdjacencyMap("biome");
    this.regenerateAdjacencyMap("height");
    this.regenerateAdjacencyMap("heightLayer");
    // process biomes
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.biomeMap[key] = this.smoothBiomeTransitions(x, y);
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("biome");
    this.regenerateAdjacencyMap("height");
    this.regenerateAdjacencyMap("heightLayer");
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        this.cloudMap.generateCloudLevel(x, y, width, height, this.game.noise);
      }
    }
    console.log("cloudMap", this.cloudMap.cloudMap);
    console.log("moistureMap", this.moistureMap.moistureMap);
    this.shadowMap.generateShadowMaps();

    // finally, generate the tile map
    if (this.game.options.shouldAutotile) {
      this.generateAutotileMap(this.biomeMap);
    } else {
      this.generateBasetileMap(this.biomeMap);
    }

    let tileIndex = 0;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        tileIndex = this.game.positionToIndex(x, y, Layer.TERRAIN);
        this.dirtyTiles.push(tileIndex); // all tiles need to be rendered
      }
    }

    this.lightManager = new LightManager(this.game, this);
  }

  public getHeightLayer(x: number, y: number): HeightLayer {
    const key = MapWorld.coordsToKey(x, y);
    return MapWorld.biomeHeightToLayer(this.heightMap[key], this.biomeMap[key]);
  }

  private generateBasetileMap(rawMap: { [key: string]: Biome }) {
    for (let key in rawMap) {
      const pos = MapWorld.keyToPoint(key);
      const index = this.game.positionToIndex(pos.x, pos.y, Layer.TERRAIN);
      const biome = rawMap[key];
      const tile =
        Tile.Tilesets[biome.id][this.game.timeManager.season][BaseTileKey];

      if (!tile) {
        console.log(
          `BASETILE ERROR: ${biome.id} - ${this.game.timeManager.season}`
        );
      }
      this.tileMap[index] = tile;
    }
  }

  getHeight(
    x: number,
    y: number,
    mapWidth: number,
    mapHeight: number,
    noise: Noise
  ): number {
    // randomize the edge padding to prevent a squared-off look
    const randomizedEdgePadding = this.edgePadding + RNG.getUniformInt(0, 2);

    // if near the edge of the map, return a lower height
    if (
      x < randomizedEdgePadding ||
      x >= mapWidth - randomizedEdgePadding ||
      y < randomizedEdgePadding ||
      y >= mapHeight - randomizedEdgePadding
    ) {
      return this.landHeight / 2;
    }

    let noiseX = x / mapWidth - 0.5;
    let noiseY = y / mapHeight - 0.5;

    // add different octaves of frequency
    // some small hills, some large, etc
    // 1 / octave * this.getScaledNoise(noise, octave * noiseX, octave * noiseY)
    let height = 0.7 * getScaledNoise(noise, 3 * noiseX, 3 * noiseY);
    height += 0.5 * getScaledNoise(noise, 4 * noiseX, 4 * noiseY);
    height += 0.3 * getScaledNoise(noise, 8 * noiseX, 8 * noiseY);
    height += 0.3 * getScaledNoise(noise, 15 * noiseX, 15 * noiseY);
    height = height / (0.4 + 0.5 + 0.3 + 0.2); // scale to between 0 and 1

    height = Math.pow(height, this.valleyScaleFactor); // reshape valleys/mountains

    // reduce height near edges of map
    const dx = (2 * x) / mapWidth - 1;
    const dy = (2 * y) / mapHeight - 1;
    const d = 1 - (1 - Math.pow(dx, 2)) * (1 - Math.pow(dy, 2));
    height = lerp(this.islandMask, height, 1 - d);

    return height;
  }

  assignTerrain(x: number, y: number): Biome {
    // assign the high level terrain types
    // features will be placed within these terrain types for tiling transition purposes
    const heightVal = this.heightMap[MapWorld.coordsToKey(x, y)];
    if (
      Biomes.inRangeOf(heightVal, Biomes.Biomes.ocean.generationOptions.height)
    ) {
      return Biomes.Biomes.ocean;
    }

    if (
      Biomes.inRangeOf(
        heightVal,
        Biomes.Biomes.moistdirt.generationOptions.height
      )
    ) {
      return Biomes.Biomes.moistdirt;
    }

    if (
      Biomes.inRangeOf(
        heightVal,
        Biomes.Biomes.sandydirt.generationOptions.height
      )
    ) {
      return Biomes.Biomes.sandydirt;
    }
  }

  private processTerrain(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const index = this.game.positionToIndex(x, y, Layer.TERRAIN);
    // const heightVal = this.heightMap[key];
    const terrain = this.terrainMap[key];
    const adjacentTerrain = this.terrainAdjacencyD2Map[index];
    // const moistureVal = this.moistureMap.getMoistureByKey(key);

    // check if any adjacent terrain is null- if so, set to ocean
    if (adjacentTerrain.some((terrain) => terrain == null)) {
      const newHeight = Biomes.Biomes.ocean.generationOptions.height.max - 0.1;
      this.heightMap[key] = newHeight;
      this.shiftHeight(x, y, Biomes.Biomes.ocean);
      this.shiftMoisture(x, y, Biomes.Biomes.ocean);
      this.shiftTemperature(x, y, Biomes.Biomes.ocean);
      return Biomes.Biomes.ocean;
    }

    // add a single tile thick border of sandydirt around moistdirt coasts to improve autotiling
    if (terrain === Biomes.Biomes.moistdirt) {
      if (
        this.isAdjacentToBiome(x, y, this.terrainAdjacencyD2Map, [
          Biomes.Biomes.ocean,
        ])
      ) {
        this.shiftHeight(x, y, Biomes.Biomes.sandydirt);
        this.shiftMoisture(x, y, Biomes.Biomes.sandydirt);
        this.shiftTemperature(x, y, Biomes.Biomes.sandydirt);
        return Biomes.Biomes.sandydirt;
      }
    }
    return terrain;
  }

  private smoothBiomeTransitions(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const biome = this.biomeMap[key];

    // beach doesn't autotile with moistdirt, so add a layer of sandydirt, which does
    if (biome.id == Biomes.Biomes.beach.id) {
      if (
        this.isAdjacentToBiome(x, y, this.terrainAdjacencyD1Map, [
          Biomes.Biomes.moistdirt,
        ])
      ) {
        this.shiftHeight(x, y, Biomes.Biomes.sandydirt);
        this.shiftTemperature(x, y, Biomes.Biomes.sandydirt);
        this.shiftMoisture(x, y, Biomes.Biomes.sandydirt);
        return Biomes.Biomes.sandydirt;
      }
    }

    return biome;
  }

  private shiftHeight(x: number, y: number, newBiome: Biome) {
    const key = MapWorld.coordsToKey(x, y);
    const height = this.heightMap[key];
    this.heightMap[key] = Biomes.shiftToBiome(
      height,
      newBiome.generationOptions.height
    );
    this.heightLayerMap[key] = MapWorld.biomeHeightToLayer(
      this.heightMap[key],
      newBiome
    );
  }

  private shiftTemperature(x: number, y: number, newBiome: Biome) {
    const key = MapWorld.coordsToKey(x, y);
    const temp = this.tempMap.tempMap[key];
    this.tempMap.tempMap[key] = Biomes.shiftToBiome(
      temp,
      newBiome.generationOptions.temperature
    );
  }

  private shiftMoisture(x: number, y: number, newBiome: Biome) {
    const key = MapWorld.coordsToKey(x, y);
    const moisture = this.moistureMap.moistureMap[key];
    this.moistureMap.moistureMap[key] = Biomes.shiftToBiome(
      moisture,
      newBiome.generationOptions.moisture
    );
  }

  private addTemperatureTerrain(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const biome = this.biomeMap[key];
    const validTerrainTypes = [
      Biomes.Biomes.moistdirt,
      Biomes.Biomes.snowmoistdirt,
    ];
    const maps = {
      height: this.heightMap,
      temperature: this.tempMap.tempMap,
      moisture: this.moistureMap.moistureMap,
    };
    if (biome.id == Biomes.Biomes.hillsmid.id) {
      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillshigh.generationOptions
        ) &&
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.snowhillshillsmid.generationOptions
        ) &&
        this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
          Biomes.Biomes.hillsmid,
          Biomes.Biomes.hillshigh,
        ])
      ) {
        return Biomes.Biomes.snowhillshillsmid;
      }
    }

    if (
      validTerrainTypes.includes(biome) &&
      Biomes.inRangeOfAll(
        x,
        y,
        maps,
        Biomes.Biomes.snowmoistdirt.generationOptions
      ) &&
      this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, validTerrainTypes)
    ) {
      return Biomes.Biomes.snowmoistdirt;
    }

    return biome;
  }

  private addTemperatureFeatures(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const terrain = this.terrainMap[key];
    const height = this.heightMap[key];
    const temp = this.tempMap.tempMap[key];
    const moisture = this.moistureMap.moistureMap[key];
    const biome = this.biomeMap[key];
    const adjacentBiomes = this.biomeAdjacencyD2Map[key];

    // if (biome.id == Biomes.Biomes.snowydirt.id) {
    //   if (
    //     Biomes.inRange(height, Biomes.Biomes.snow.generationOptions.height) &&
    //     Biomes.inRange(moisture, Biomes.Biomes.snow.generationOptions.moisture)
    //   ) {
    //     if (
    //       this.isSurroundedBy(x, y, this.biomeAdjacencyD2Map, [
    //         Biomes.Biomes.snowydirt,
    //         Biomes.Biomes.snow,
    //       ])
    //     ) {
    //       return Biomes.Biomes.snow;
    //     }
    //   }
    // }

    return biome;
  }

  private addMidLayers(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const height = this.heightMap[key];
    const biome = this.biomeMap[key];
    const isMidHeight = Biomes.inRangeOf(
      height,
      Biomes.Biomes.hillsmid.generationOptions.height
    );
    const isMoistdirtBase = biome.id == Biomes.Biomes.moistdirt.id;
    if (isMidHeight && isMoistdirtBase) {
      if (
        this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
          Biomes.Biomes.moistdirt,
          Biomes.Biomes.hillsmid,
        ])
      ) {
        return Biomes.Biomes.hillsmid;
      }
    }
    if (isMidHeight) {
      this.shiftHeight(x, y, biome);
    }
    return biome;
  }

  private addUpperLayers(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const height = this.heightMap[key];
    const biome = this.biomeMap[key];
    const isUpperHeight = Biomes.inRangeOf(
      height,
      Biomes.Biomes.hillshigh.generationOptions.height
    );
    const isMidhillsBase = biome.id == Biomes.Biomes.hillsmid.id;

    if (isUpperHeight && isMidhillsBase) {
      // only add high hills if surrounded by mid hills
      if (
        this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
          Biomes.Biomes.hillsmid,
          Biomes.Biomes.hillshigh,
        ])
      ) {
        this.shiftHeight(x, y, Biomes.Biomes.hillshigh);
        return Biomes.Biomes.hillshigh;
      }
    }
    if (isUpperHeight) {
      this.shiftHeight(x, y, biome);
    }
    return biome;
  }

  private addLowerLayers(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const height = this.heightMap[key];
    const biome = this.biomeMap[key];
    const isLowerHeight = Biomes.inRangeOf(
      height,
      Biomes.Biomes.valley.generationOptions.height
    );
    const isMoistDirt = biome.id == Biomes.Biomes.moistdirt.id;
    if (isLowerHeight && isMoistDirt) {
      if (
        this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
          Biomes.Biomes.moistdirt,
          Biomes.Biomes.valley,
        ])
      ) {
        return Biomes.Biomes.valley;
      }
    }

    if (isLowerHeight) {
      this.shiftHeight(x, y, biome);
    }

    return biome;
  }

  // private regenerateAdjacencyMap(map: "terrain" | "biome") {
  //   for (let x = 0; x < this.game.options.gameSize.width; x++) {
  //     for (let y = 0; y < this.game.options.gameSize.height; y++) {
  //       const key = MapWorld.coordsToKey(x, y);
  //       if (map === "terrain") {
  //         this.terrainAdjacencyD1Map[key] = this.assignAdjacentBiomes(
  //           x,
  //           y,
  //           this.terrainMap,
  //           1
  //         );
  //         this.terrainAdjacencyD2Map[key] = this.assignAdjacentBiomes(
  //           x,
  //           y,
  //           this.terrainMap,
  //           2
  //         );
  //       } else if (map === "biome") {
  //         this.biomeAdjacencyD1Map[key] = this.assignAdjacentBiomes(
  //           x,
  //           y,
  //           this.biomeMap,
  //           1
  //         );
  //         this.biomeAdjacencyD2Map[key] = this.assignAdjacentBiomes(
  //           x,
  //           y,
  //           this.biomeMap,
  //           2
  //         );
  //       }
  //     }
  //   }
  // }

  private regenerateAdjacencyMap(
    map: "terrain" | "biome" | "height" | "heightLayer"
  ) {
    for (let x = 0; x < this.game.options.gameSize.width; x++) {
      for (let y = 0; y < this.game.options.gameSize.height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        const index = this.game.positionToIndex(x, y, Layer.TERRAIN);
        if (map === "terrain") {
          this.terrainAdjacencyD1Map[index] = this.assignAdjacentBiomes(
            x,
            y,
            this.terrainMap,
            1
          );
          this.terrainAdjacencyD2Map[index] = this.assignAdjacentBiomes(
            x,
            y,
            this.terrainMap,
            2
          );
        } else if (map === "biome") {
          this.biomeAdjacencyD1Map[index] = this.assignAdjacentBiomes(
            x,
            y,
            this.biomeMap,
            2
          );
          this.biomeAdjacencyD2Map[index] = this.assignAdjacentBiomes(
            x,
            y,
            this.biomeMap,
            2
          );
        } else if (map === "height") {
          this.heightAdjacencyD1Map[index] = this.assignAdjacentHeights(
            x,
            y,
            this.heightMap,
            1
          );
          this.heightAdjacencyD2Map[index] = this.assignAdjacentHeights(
            x,
            y,
            this.heightMap,
            2
          );
        } else if (map === "heightLayer") {
          this.heightLayerAdjacencyD1Map[index] =
            this.assignAdjacentHeightLayers(x, y, this.heightLayerMap, 1);
          this.heightLayerAdjacencyD2Map[index] =
            this.assignAdjacentHeightLayers(x, y, this.heightLayerMap, 2);
        }
      }
    }
  }

  assignAdjacentBiomes(
    x: number,
    y: number,
    map: { [key: string]: Biome },
    distance = 1
  ): Biome[] {
    const key = MapWorld.coordsToKey(x, y);
    const heightVal = this.heightMap[key];
    const terrain = this.terrainMap[key];
    const adjacentBiomes = [];
    let pos: Point;
    let biome: Biome;
    for (let xOffset = -distance; xOffset <= distance; xOffset++) {
      for (let yOffset = -distance; yOffset <= distance; yOffset++) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }
        pos = new Point(x + xOffset, y + yOffset);
        biome = map[MapWorld.coordsToKey(pos.x, pos.y)];
        adjacentBiomes.push(biome);
      }
    }
    return adjacentBiomes;
  }

  assignAdjacentHeights(
    x: number,
    y: number,
    map: { [key: string]: number },
    distance = 1
  ): number[] {
    const key = MapWorld.coordsToKey(x, y);
    const adjacentHeights = [];
    let pos: Point;
    let height: number;
    for (let xOffset = -distance; xOffset <= distance; xOffset++) {
      for (let yOffset = -distance; yOffset <= distance; yOffset++) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }
        pos = new Point(x + xOffset, y + yOffset);
        height = map[MapWorld.coordsToKey(pos.x, pos.y)];
        adjacentHeights.push(height);
      }
    }
    return adjacentHeights;
  }

  assignAdjacentHeightLayers(
    x: number,
    y: number,
    map: { [key: string]: HeightLayer },
    distance = 1
  ): HeightLayer[] {
    const key = MapWorld.coordsToKey(x, y);
    const adjacentHeightLayers = [];
    let pos: Point;
    let heightLayer: HeightLayer;
    for (let xOffset = -distance; xOffset <= distance; xOffset++) {
      for (let yOffset = -distance; yOffset <= distance; yOffset++) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }
        pos = new Point(x + xOffset, y + yOffset);
        heightLayer = map[MapWorld.coordsToKey(pos.x, pos.y)];
        adjacentHeightLayers.push(heightLayer);
      }
    }
    return adjacentHeightLayers;
  }

  isAdjacentToBiome(
    x: number,
    y: number,
    adjacencyMap: Biome[][],
    terrain: Biome[]
  ): boolean {
    const key = MapWorld.coordsToKey(x, y);
    const index = this.game.positionToIndex(x, y, Layer.TERRAIN);
    const adjacentTerrain = adjacencyMap[index];
    // console
    //   .throttle(100)
    //   .log("adjacentTerrain", adjacentTerrain, terrain, x, y, key, index);
    for (let i = 0; i < adjacentTerrain.length; i++) {
      if (terrain.includes(adjacentTerrain[i])) {
        return true;
      }
    }
    return false;
  }

  getAdjacentBiomes(
    x: number,
    y: number,
    adjacencyMap: { [key: string]: Biome[] }
  ): Biome[] {
    return adjacencyMap[MapWorld.coordsToKey(x, y)];
  }

  getAdjacent(x: number, y: number, adjacencyMap: any[][]): any[] {
    return adjacencyMap[this.game.positionToIndex(x, y, Layer.TERRAIN)];
  }

  isSurroundedBy(
    x: number,
    y: number,
    adjacencyMap: Biome[][],
    terrain: Biome[]
  ): boolean {
    const index = this.game.positionToIndex(x, y, Layer.TERRAIN);
    const adjacentTerrain = adjacencyMap[index];
    if (x == 241 && y == 278) {
      console.log("adjacentTerrain for " + x + ", " + y, adjacentTerrain);
    }
    for (let i = 0; i < adjacentTerrain.length; i++) {
      if (!terrain.includes(adjacentTerrain[i])) {
        return false;
      }
    }
    return true;
  }

  assignBiome(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const heightVal = this.heightMap[key];
    const moistureVal = this.moistureMap.getMoistureByKey(key);
    const terrain = this.terrainMap[key];
    const maps = {
      height: this.heightMap,
      temperature: this.tempMap.tempMap,
      moisture: this.moistureMap.moistureMap,
    };

    if (terrain === Biomes.Biomes.ocean) {
      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.oceandeep.generationOptions
        )
      ) {
        return Biomes.Biomes.oceandeep;
      }
      return Biomes.Biomes.ocean;
    }

    if (terrain === Biomes.Biomes.sandydirt) {
      if (
        Biomes.inRangeOfAll(x, y, maps, Biomes.Biomes.beach.generationOptions)
      ) {
        return Biomes.Biomes.beach;
      }
      return Biomes.Biomes.sandydirt;
    }

    if (terrain === Biomes.Biomes.moistdirt) {
      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillshigh.generationOptions
        )
      ) {
        // later processing could turn this into hillshigh
        return Biomes.Biomes.hillsmid;
      }

      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillsmid.generationOptions
        )
      ) {
        return Biomes.Biomes.hillsmid;
      }

      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillslow.generationOptions
        )
      ) {
        return Biomes.Biomes.hillslow;
      }

      if (
        Biomes.inRangeOfAll(x, y, maps, Biomes.Biomes.swamp.generationOptions)
      ) {
        return Biomes.Biomes.swamp;
      }

      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.hillgrass.generationOptions
        )
      ) {
        return Biomes.Biomes.hillgrass;
      }

      if (
        Biomes.inRangeOfAll(
          x,
          y,
          maps,
          Biomes.Biomes.shortgrass.generationOptions
        )
      ) {
        return Biomes.Biomes.shortgrass;
      }

      if (
        Biomes.inRangeOfAll(x, y, maps, Biomes.Biomes.grass.generationOptions)
      ) {
        return Biomes.Biomes.grass;
      }
      return Biomes.Biomes.moistdirt;
    }
  }

  generateAutotileMap(rawMap: { [key: string]: Biome }) {
    // console.log("rawMap to start with: ", rawMap);
    this.autotileMap = Autotile.autotile(rawMap);
    let autotileIndex;
    let biome: Biome;
    let biomeId: BiomeId;
    let season: Season;
    let tile: Tile;
    season = this.game.timeManager.season;

    Object.keys(this.autotileMap).forEach((positionKey: string) => {
      autotileIndex = this.autotileMap[positionKey];
      biome = rawMap[positionKey];
      biomeId = biome.id;
      if (!biome?.autotilePrefix) {
        // use the base tile rather than autotiling
        tile = Tile.Tilesets[biomeId][season][BaseTileKey];
      } else {
        tile = Tile.Tilesets[biomeId][season][autotileIndex];
      }

      if (!tile) {
        console.log(
          `AUTOTILE ERROR: ${biomeId} - ${season} - ${autotileIndex}`
        );
      }
      const pos = MapWorld.keyToPoint(positionKey);
      const index = this.game.positionToIndex(pos.x, pos.y, Layer.TERRAIN);
      this.tileMap[index] = tile;
    });
  }

  setTile(x: number, y: number, tile: Tile): void {
    this.tileMap[this.game.positionToIndex(x, y, Layer.TERRAIN)] = tile;
    this.dirtyTiles.push(this.game.positionToIndex(x, y, Layer.TERRAIN));
  }

  // getRandomTilePositions(
  //   biomeType: BiomeId,
  //   quantity: number = 1,
  //   onlyPassable = true
  // ): Point[] {
  //   let buffer: Point[] = [];
  //   let result: Point[] = [];
  //   for (let key in this.tileMap) {
  //     // this goes through every single tile
  //     // DONT ADD UNNECESSARY CODE TO THE OUTER LOOP
  //     if (this.tileMap[key].biomeId === biomeType) {
  //       const pos = MapWorld.keyToPoint(key);
  //       if (!onlyPassable || (onlyPassable && this.isPassable(pos.x, pos.y))) {
  //         buffer.push(pos);
  //       }
  //     }
  //   }

  //   let index: number;
  //   while (buffer.length > 0 && result.length < quantity) {
  //     index = Math.floor(RNG.getUniform() * buffer.length);
  //     result.push(buffer.splice(index, 1)[0]);
  //   }
  //   return result;
  // }

  getRandomTilePositions(
    biomeType: BiomeId,
    quantity: number = 1,
    onlyPassable = true,
    isPlant: boolean = false
  ): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    let key: string;
    // go through every tile in map
    // if isPlant- add that tile * ratio of tile size diff to buffer
    // for (let tileIndex in this.tileMap) {
    this.tileMap.forEach((tile, tileIndex) => {
      // this goes through every single tile
      // DONT ADD UNNECESSARY CODE TO THE OUTER LOOP
      if (tile?.biomeId === biomeType) {
        let pos = this.game.indexToPosition(tileIndex, Layer.TERRAIN);
        // let pos = MapWorld.keyToPoint(tileIndex);
        if (!onlyPassable || (onlyPassable && this.isPassable(pos.x, pos.y))) {
          if (isPlant) {
            pos = Tile.translatePoint(pos, Layer.TERRAIN, Layer.PLANT);
            buffer.push(
              pos,
              new Point(pos.x + 1, pos.y),
              new Point(pos.x, pos.y + 1),
              new Point(pos.x + 1, pos.y + 1)
            );
          } else {
            buffer.push(pos);
          }
        }
      }
    });

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      const pos = buffer[index];
      result.push(new Point(pos.x, pos.y));
      // result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  getTile(x: number, y: number): Tile {
    return this.tileMap[this.game.positionToIndex(x, y, Layer.TERRAIN)];
  }

  getBiome(x: number, y: number): Biome {
    return this.biomeMap[MapWorld.coordsToKey(x, y)];
  }

  isPassable(x: number, y: number): boolean {
    const key = MapWorld.coordsToKey(x, y);
    const biome = this.biomeMap[key];
    const autotile = this.autotileMap[key];
    const isBorderTile = Autotile.isTileIndexAutoTileBorder(autotile);
    const impassibleBorderBiome = ImpassibleBorder.includes(biome?.id);
    let impassible = false;
    if (impassibleBorderBiome && isBorderTile) {
      impassible = true;
    }

    return biome && !impassible;
  }

  getTotalLight(x: number, y: number): number {
    const key = MapWorld.coordsToKey(x, y);
    const lightFromShadows = this.shadowMap.shadowMap[key];
    const lightFromOcc = this.shadowMap.occlusionMap[key];
    const cloudLevel = this.cloudMap.cloudMap[key];
    let lightFromClouds = 1;
    if (cloudLevel > this.cloudMap.cloudMinLevel) {
      // reduce the light by the amount of cloud cover
      lightFromClouds =
        1 - (this.cloudMap.cloudMap[key] - this.cloudMap.cloudMinLevel);
    } else if (cloudLevel < this.cloudMap.sunbeamMaxLevel) {
      // increase light by how much sunbeam there is
      lightFromClouds = 1 + this.cloudMap.cloudMap[key];
    }
    // console.throttle(250).log("lightFromClouds", lightFromClouds, cloudLevel);

    const ambientLight = this.game.timeManager.remainingPhasePercent;
    let finalLight =
      lightFromShadows * ambientLight * lightFromOcc * lightFromClouds;
    // can go over 1 due to lightening effect from sunbeams/clouds
    if (finalLight < 0) {
      finalLight = 0;
    }
    if (finalLight > 1) {
      finalLight = 1;
    }
    return finalLight;
  }

  draw(): void {
    for (let tileIndex of this.dirtyTiles) {
      const tilePos = this.game.indexToPosition(tileIndex, Layer.TERRAIN);
      const tile = this.tileMap[tileIndex];
      this.game.renderer.removeFromScene(tileIndex, Layer.TERRAIN);
      this.game.renderer.addToScene(
        tilePos,
        Layer.TERRAIN,
        Sprite.from(tile.spritePath)
      );
    }
    // Clear the changed tiles after drawing them
    this.dirtyTiles = [];
  }

  onTileEnterViewport(positions: Point[]): void {
    this.shadowMap.onEnter(positions);
    this.cloudMap.onEnter(positions);
  }

  isPointInMap(point: Point): boolean {
    return (
      point.x >= 0 &&
      point.x < this.game.options.gameSize.width &&
      point.y >= 0 &&
      point.y < this.game.options.gameSize.height
    );
  }
}
