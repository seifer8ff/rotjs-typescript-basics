import { Color, RNG } from "rot-js";
import { Game } from "./game";
import { BaseTileKey, Tile } from "./tile";
import { Point } from "./point";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import { LightManager } from "./light-manager";
import { getMapStats, lerp } from "./misc-utility";
import { MapTemperature } from "./map-temperature";
import { MapMoisture } from "./map-moisture";
import { Season } from "./time-manager";
import { Biome, BiomeId, Biomes, ImpassibleBorder } from "./biomes";
import { Color as ColorType } from "rot-js/lib/color";
import { MapSunlight } from "./map-sunlight";
import { MapPoles } from "./map-poles";

export type Map = ValueMap | BiomeMap | TileMap;

export type ValueMap = {
  [key: string]: number;
};

export type BiomeMap = {
  [key: string]: Biome;
};

export type TileMap = {
  [key: string]: Tile;
};

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
  public sunMap: MapSunlight;
  public polesMap: MapPoles;
  public seaLevel: number;

  public terrainAdjacencyD1Map: { [key: string]: Biome[] }; // adjacency map with distance of 1 tile
  public terrainAdjacencyD2Map: { [key: string]: Biome[] };
  public biomeAdjacencyD1Map: { [key: string]: Biome[] }; // adjacency map with distance of 1 tile
  public biomeAdjacencyD2Map: { [key: string]: Biome[] };
  private dirtyTiles: string[];
  private landHeight: number;
  private valleyScaleFactor: number;
  private edgePadding: number;
  private islandMask: number;

  constructor(private game: Game) {
    this.tileMap = {};
    this.biomeMap = {};
    this.autotileMap = {};
    this.heightMap = {};
    this.heightLayerMap = {};
    this.moistureMap = new MapMoisture(this.game, this);
    this.tempMap = new MapTemperature(this.game, this);
    this.sunMap = new MapSunlight(this.game, this);
    this.polesMap = new MapPoles(this.game, this);
    this.terrainMap = {};
    this.seaLevel = Biomes.Biomes.ocean.generationOptions.height.max;
    this.terrainAdjacencyD1Map = {};
    this.terrainAdjacencyD2Map = {};
    this.biomeAdjacencyD1Map = {};
    this.biomeAdjacencyD2Map = {};
    this.dirtyTiles = [];
    this.landHeight = 0.5;
    this.valleyScaleFactor = 2;
    this.edgePadding = 0;
    this.islandMask = 0.38;
  }

  public static heightToLayer(height: number): HeightLayer {
    // if (height < Biomes.Biomes.valley.generationOptions.height.min) {
    //   return HeightLayer.Hole;
    // }
    // if (
    //   height < Biomes.Biomes.moistdirt.generationOptions.height.min &&
    //   height > Biomes.Biomes.ocean.generationOptions.height.max
    // ) {
    //   return HeightLayer.Valley;
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
    const heightLayer = MapWorld.heightToLayer(height);
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
    this.tileMap = {};
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
        this.biomeMap[key] = this.addUpperLayers(x, y);
        this.biomeMap[key] = this.addLowerLayers(x, y);
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("biome");
    // add secondary features
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.biomeMap[key] = this.addTemperatureFeatures(x, y);
        this.biomeMap[key] = this.addUpperLayers(x, y);
        this.biomeMap[key] = this.addLowerLayers(x, y);
      }
    }
    this.regenerateAdjacencyMap("biome");
    // process biomes
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.biomeMap[key] = this.processBiomes(x, y);
        this.dirtyTiles.push(key); // all tiles need to be rendered
      }
    }
    // update adjacency maps again
    this.regenerateAdjacencyMap("biome");
    console.log("moistureMap", this.moistureMap.moistureMap);
    this.sunMap.generateSunMap();

    // finally, generate the tile map
    if (this.game.shouldAutotile) {
      this.generateAutotileMap(this.biomeMap);
    } else {
      this.generateBasetileMap(this.biomeMap);
    }

    this.lightManager = new LightManager(this.game, this);
  }

  public getHeightLayer(x: number, y: number): HeightLayer {
    const key = MapWorld.coordsToKey(x, y);
    return MapWorld.heightToLayer(this.heightMap[key]);
  }

  private generateBasetileMap(rawMap: { [key: string]: Biome }) {
    for (let key in rawMap) {
      const biome = rawMap[key];
      const tile =
        Tile.Tilesets[biome.id][this.game.timeManager.season][BaseTileKey];

      if (!tile) {
        console.log(
          `BASETILE ERROR: ${biome.id} - ${this.game.timeManager.season}`
        );
      }
      this.tileMap[key] = tile;
    }
  }

  getHeight(
    x: number,
    y: number,
    mapWidth: number,
    mapHeight: number,
    noise: Simplex
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
    let height = 0.7 * this.getScaledNoise(noise, 3 * noiseX, 3 * noiseY);
    height += 0.5 * this.getScaledNoise(noise, 4 * noiseX, 4 * noiseY);
    height += 0.3 * this.getScaledNoise(noise, 8 * noiseX, 8 * noiseY);
    height += 0.3 * this.getScaledNoise(noise, 15 * noiseX, 15 * noiseY);
    height = height / (0.4 + 0.5 + 0.3 + 0.2); // scale to between 0 and 1

    height = Math.pow(height, this.valleyScaleFactor); // reshape valleys/mountains

    // reduce height near edges of map
    const dx = (2 * x) / mapWidth - 1;
    const dy = (2 * y) / mapHeight - 1;
    const d = 1 - (1 - Math.pow(dx, 2)) * (1 - Math.pow(dy, 2));
    height = lerp(this.islandMask, height, 1 - d);

    return height;
  }

  getScaledNoise(noise: Simplex, x: number, y: number): number {
    return (noise.get(x, y) + 1) / 2;
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
    // const heightVal = this.heightMap[key];
    const terrain = this.terrainMap[key];
    const adjacentTerrain = this.terrainAdjacencyD2Map[key];
    // const moistureVal = this.moistureMap.getMoistureByKey(key);

    // check if any adjacent terrain is null- if so, set to ocean
    if (adjacentTerrain.some((terrain) => terrain == null)) {
      const newHeight = Biomes.Biomes.ocean.generationOptions.height.max - 0.1;
      this.heightMap[key] = newHeight;
      return Biomes.Biomes.ocean;
    }

    // add a single tile thick border of sandydirt around moistdirt coasts to improve autotiling
    if (terrain === Biomes.Biomes.moistdirt) {
      if (
        this.isAdjacentToBiome(x, y, this.terrainAdjacencyD2Map, [
          Biomes.Biomes.ocean,
        ])
      ) {
        return Biomes.Biomes.sandydirt;
      }
    }
    return terrain;
  }

  private processBiomes(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const terrain = this.terrainMap[key];
    const biome = this.biomeMap[key];
    const adjacentBiomes = this.biomeAdjacencyD2Map[key];

    // beach doesn't autotile with moistdirt, so add a layer of sandydirt, which does
    if (biome.id == Biomes.Biomes.beach.id) {
      if (
        this.isAdjacentToBiome(x, y, this.terrainAdjacencyD1Map, [
          Biomes.Biomes.moistdirt,
        ])
      ) {
        return Biomes.Biomes.sandydirt;
      }
    }

    // hillslow and hillsmid shouldn't be too skinny

    return biome;
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

  private addUpperLayers(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const terrain = this.terrainMap[key];
    const height = this.heightMap[key];
    const biome = this.biomeMap[key];
    const adjacentBiomes = this.biomeAdjacencyD2Map[key];

    if (biome.id == Biomes.Biomes.hillsmid.id) {
      if (
        Biomes.inRangeOf(
          height,
          Biomes.Biomes.hillshigh.generationOptions.height
        )
      ) {
        if (
          this.isSurroundedBy(x, y, this.biomeAdjacencyD1Map, [
            Biomes.Biomes.hillsmid,
            Biomes.Biomes.hillshigh,
          ])
        ) {
          return Biomes.Biomes.hillshigh;
        }
      }
    }

    return biome;
  }

  private addLowerLayers(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const terrain = this.terrainMap[key];
    const height = this.heightMap[key];
    const biome = this.biomeMap[key];
    const adjacentBiomes = this.biomeAdjacencyD2Map[key];

    if (biome.id == Biomes.Biomes.moistdirt.id) {
      if (
        Biomes.inRangeOf(height, Biomes.Biomes.valley.generationOptions.height)
      ) {
        if (
          this.isSurroundedBy(x, y, this.biomeAdjacencyD2Map, [
            Biomes.Biomes.moistdirt,
            Biomes.Biomes.valley,
          ])
        ) {
          return Biomes.Biomes.valley;
        }
      }
    }

    return biome;
  }

  // private regenerateAdjacencyMap(map: "terrain" | "biome") {
  //   for (let x = 0; x < this.game.gameSize.width; x++) {
  //     for (let y = 0; y < this.game.gameSize.height; y++) {
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

  private regenerateAdjacencyMap(map: "terrain" | "biome") {
    for (let x = 0; x < this.game.gameSize.width; x++) {
      for (let y = 0; y < this.game.gameSize.height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        if (map === "terrain") {
          this.terrainAdjacencyD1Map[key] = this.assignAdjacentBiomes(
            x,
            y,
            this.terrainMap,
            1
          );
          this.terrainAdjacencyD2Map[key] = this.assignAdjacentBiomes(
            x,
            y,
            this.terrainMap,
            2
          );
        } else if (map === "biome") {
          this.biomeAdjacencyD1Map[key] = this.assignAdjacentBiomes(
            x,
            y,
            this.biomeMap,
            1
          );
          this.biomeAdjacencyD2Map[key] = this.assignAdjacentBiomes(
            x,
            y,
            this.biomeMap,
            2
          );
        }
      }
    }
  }

  // assignAdjacentBiomes(x: number, y: number, map: "terrain" | "biome") {
  //   const distance = 2;
  //   const key = MapWorld.coordsToKey(x, y);
  //   const heightVal = this.heightMap[key];
  //   const terrain = this.terrainMap[key];
  //   const adjacentD2Biomes = [];
  //   const adjacentD1Biomes = [];
  //   let pos: Point;
  //   let biome: Biome;
  //   for (let xOffset = -distance; xOffset <= distance; xOffset++) {
  //     for (let yOffset = -distance; yOffset <= distance; yOffset++) {
  //       if (xOffset === 0 && yOffset === 0) {
  //         continue;
  //       }
  //       pos = new Point(x + xOffset, y + yOffset);
  //       biome = map[MapWorld.coordsToKey(pos.x, pos.y)];
  //       if (Math.abs(xOffset) === 1 && Math.abs(yOffset) === 1) {
  //         adjacentD1Biomes.push(biome);
  //       }
  //       adjacentD2Biomes.push(biome);
  //     }
  //   }
  //   if (map === "terrain") {
  //     this.terrainAdjacencyD1Map[key] = adjacentD1Biomes;
  //     this.terrainAdjacencyD2Map[key] = adjacentD2Biomes;
  //   } else if (map === "biome") {
  //     this.biomeAdjacencyD1Map[key] = adjacentD1Biomes;
  //     this.biomeAdjacencyD2Map[key] = adjacentD2Biomes;
  //   }
  // }

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

  isAdjacentToBiome(
    x: number,
    y: number,
    adjacencyMap: { [key: string]: Biome[] },
    terrain: Biome[]
  ): boolean {
    const key = MapWorld.coordsToKey(x, y);
    const adjacentTerrain = adjacencyMap[key];
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

  isSurroundedBy(
    x: number,
    y: number,
    adjacencyMap: { [key: string]: Biome[] },
    terrain: Biome[]
  ): boolean {
    const key = MapWorld.coordsToKey(x, y);
    const adjacentTerrain = adjacencyMap[key];
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
    let tileIndex;
    let biome: Biome;
    let biomeId: BiomeId;
    let season: Season;
    let tile: Tile;
    season = this.game.timeManager.season;

    Object.keys(this.autotileMap).forEach((pos) => {
      tileIndex = this.autotileMap[pos];
      biome = rawMap[pos];
      biomeId = biome.id;
      if (!biome?.autotilePrefix) {
        // use the base tile rather than autotiling
        tile = Tile.Tilesets[biomeId][season][BaseTileKey];
      } else {
        tile = Tile.Tilesets[biomeId][season][tileIndex];
      }

      if (!tile) {
        console.log(`AUTOTILE ERROR: ${biomeId} - ${season} - ${tileIndex}`);
      }
      this.tileMap[pos] = tile;
    });
  }

  setTile(x: number, y: number, tile: Tile): void {
    this.tileMap[MapWorld.coordsToKey(x, y)] = tile;
    this.dirtyTiles.push(MapWorld.coordsToKey(x, y));
  }

  getRandomTilePositions(biomeType: BiomeId, quantity: number = 1): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (let key in this.tileMap) {
      // console.log("this.map[key]", key, this.map[key]);
      if (this.tileMap[key].biomeId === biomeType) {
        buffer.push(MapWorld.keyToPoint(key));
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  getTile(x: number, y: number): Tile {
    return this.tileMap[MapWorld.coordsToKey(x, y)];
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

  draw(): void {
    for (let key of this.dirtyTiles) {
      if (key) {
        const tile = this.tileMap[key];
        this.game.renderer.removeFromScene(
          MapWorld.keyToPoint(key),
          key,
          Layer.TERRAIN
        );
        this.game.renderer.addToScene(
          MapWorld.keyToPoint(key),
          Layer.TERRAIN,
          tile.sprite
        );
      }
    }
    // Clear the changed tiles after drawing them
    this.dirtyTiles = [];
  }
}
