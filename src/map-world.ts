import { RNG } from "rot-js";
import { Game } from "./game";
import { BaseTileKey, Biome, BiomeId, Impassible, Tile } from "./tile";
import { Point } from "./point";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import { LightManager } from "./light-manager";
import { lerp } from "./misc-utility";
import { MapTemperature } from "./map-temperature";
import { MapMoisture } from "./map-moisture";
import { Season } from "./time-manager";

export class MapWorld {
  public lightManager: LightManager;
  public terrainMap: { [key: string]: Biome }; // the base terrain of the map (sand, dirt, ocean)
  public biomeMap: { [key: string]: Biome }; // the final map of biomes
  public tileMap: { [key: string]: Tile }; // the final map of tiles to be drawn (may or may not be autotiled)
  public heightMap: { [key: string]: number };
  public tempMap: MapTemperature;
  public moistureMap: MapMoisture;
  public seaLevel: number;

  public adjacencyD1Map: { [key: string]: Biome[] }; // adjacency map with distance of 1 tile
  public adjacencyD2Map: { [key: string]: Biome[] };
  private dirtyTiles: string[];
  private landHeight: number;
  private valleyScaleFactor: number;
  private edgePadding: number;
  private islandMask: number;

  constructor(private game: Game) {
    this.tileMap = {};
    this.biomeMap = {};
    this.heightMap = {};
    this.moistureMap = new MapMoisture(this.game, this);
    this.tempMap = new MapTemperature(this.game, this);
    this.terrainMap = {};
    this.seaLevel = Tile.Biomes.ocean.generationOptions.height.max;
    this.adjacencyD1Map = {};
    this.adjacencyD2Map = {};
    this.dirtyTiles = [];
    this.landHeight = 0.5;
    this.valleyScaleFactor = 2;
    this.edgePadding = 0;
    this.islandMask = 0.38;
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

    const noise = new Simplex();

    // first pass, generate base height and assign terrain
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.heightMap[key] = this.getHeight(x, y, width, height, noise);
        this.terrainMap[key] = this.assignTerrain(x, y);
      }
    }
    // generate the adjacency map for future passes
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.adjacencyD1Map[key] = this.assignAdjacentBiomes(x, y, 1);
        this.adjacencyD2Map[key] = this.assignAdjacentBiomes(x, y, 2);
      }
    }
    // second pass, process terrain from first pass to smooth out issues
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.terrainMap[key] = this.processTerrain(x, y);
      }
    }
    // update adjacency maps again
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.adjacencyD1Map[key] = this.assignAdjacentBiomes(x, y, 1);
        this.adjacencyD2Map[key] = this.assignAdjacentBiomes(x, y, 2);
      }
    }
    // third pass, generate climate maps
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.moistureMap.generateMoistureFor(x, y, width, height, noise);
        this.tempMap.generateInitialTemp(x, y, width, height, noise);
      }
    }
    // assign the final biome map
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.biomeMap[key] = this.assignBiome(x, y);
        // this.dirtyTiles.push(key); // all tiles need to be rendered
      }
    }
    // update adjacency maps again
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.adjacencyD1Map[key] = this.assignAdjacentBiomes(x, y, 1);
        this.adjacencyD2Map[key] = this.assignAdjacentBiomes(x, y, 2);
      }
    }
    // process biomes
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.biomeMap[key] = this.processBiomes(x, y);
        this.dirtyTiles.push(key); // all tiles need to be rendered
      }
    }
    // update adjacency maps again
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.adjacencyD1Map[key] = this.assignAdjacentBiomes(x, y, 1);
        this.adjacencyD2Map[key] = this.assignAdjacentBiomes(x, y, 2);
      }
    }
    console.log("moistureMap", this.moistureMap.moistureMap);

    // finally, generate the tile map
    if (this.game.shouldAutotile) {
      this.autotileMap(this.biomeMap);
    } else {
      this.basetileMap(this.biomeMap);
    }

    this.lightManager = new LightManager(this.game, this);
  }

  private basetileMap(rawMap: { [key: string]: Biome }) {
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
    if (Tile.inRange(heightVal, Tile.Biomes.ocean.generationOptions.height)) {
      return Tile.Biomes.ocean;
    }

    if (
      Tile.inRange(heightVal, Tile.Biomes.moistdirt.generationOptions.height)
    ) {
      return Tile.Biomes.moistdirt;
    }

    if (
      Tile.inRange(heightVal, Tile.Biomes.sandydirt.generationOptions.height)
    ) {
      return Tile.Biomes.sandydirt;
    }
  }

  private processTerrain(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    // const heightVal = this.heightMap[key];
    const terrain = this.terrainMap[key];
    const adjacentTerrain = this.adjacencyD2Map[key];
    // const moistureVal = this.moistureMap.getMoistureByKey(key);

    // check if any adjacent terrain is null- if so, set to ocean
    if (adjacentTerrain.some((terrain) => terrain == null)) {
      const newHeight = Tile.Biomes.ocean.generationOptions.height.max - 0.1;
      this.heightMap[key] = newHeight;
      return Tile.Biomes.ocean;
    }

    // add a single tile thick border of sandydirt around moistdirt coasts to improve autotiling
    if (terrain === Tile.Biomes.moistdirt) {
      if (
        this.isAdjacentToBiome(x, y, this.adjacencyD2Map, [Tile.Biomes.ocean])
      ) {
        return Tile.Biomes.sandydirt;
      }
    }
    return terrain;
  }

  private processBiomes(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const terrain = this.terrainMap[key];
    const biome = this.biomeMap[key];
    const adjacentBiomes = this.adjacencyD2Map[key];

    if (biome.id == Tile.Biomes.beach.id) {
      if (
        this.isAdjacentToBiome(x, y, this.adjacencyD1Map, [
          Tile.Biomes.moistdirt,
        ])
      ) {
        return Tile.Biomes.sandydirt;
      }
    }

    return biome;
  }

  assignAdjacentBiomes(x: number, y: number, distance = 1): Biome[] {
    const key = MapWorld.coordsToKey(x, y);
    const heightVal = this.heightMap[key];
    const terrain = this.terrainMap[key];
    const adjacentTerrain = [];
    let pos: Point;
    let biome: Biome;
    for (let xOffset = -distance; xOffset <= distance; xOffset++) {
      for (let yOffset = -distance; yOffset <= distance; yOffset++) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }
        pos = new Point(x + xOffset, y + yOffset);
        biome = this.terrainMap[MapWorld.coordsToKey(pos.x, pos.y)];
        adjacentTerrain.push(biome);
      }
    }
    return adjacentTerrain;
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

  getAdjacentBiomes(x: number, y: number): Biome[] {
    return this.adjacencyD2Map[MapWorld.coordsToKey(x, y)];
  }

  assignBiome(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const heightVal = this.heightMap[key];
    const moistureVal = this.moistureMap.getMoistureByKey(key);
    const terrain = this.terrainMap[key];

    if (terrain === Tile.Biomes.ocean) {
      if (
        Tile.inRange(heightVal, Tile.Biomes.oceandeep.generationOptions.height)
      ) {
        return Tile.Biomes.oceandeep;
      }
      return Tile.Biomes.ocean;
    }

    if (terrain === Tile.Biomes.sandydirt) {
      if (
        Tile.inRange(heightVal, Tile.Biomes.beach.generationOptions.height)
        // && Tile.inRange(moistureVal, Tile.Biomes.beach.generationOptions.moisture)
      ) {
        return Tile.Biomes.beach;
      }
      return Tile.Biomes.sandydirt;
    }

    if (terrain === Tile.Biomes.moistdirt) {
      if (
        Tile.inRange(heightVal, Tile.Biomes.swamp.generationOptions.height) &&
        Tile.inRange(moistureVal, Tile.Biomes.swamp.generationOptions.moisture)
      ) {
        return Tile.Biomes.swamp;
      }

      if (
        Tile.inRange(heightVal, Tile.Biomes.valley.generationOptions.height) &&
        Tile.inRange(moistureVal, Tile.Biomes.valley.generationOptions.moisture)
      ) {
        return Tile.Biomes.valley;
      }

      if (
        Tile.inRange(heightVal, Tile.Biomes.hills.generationOptions.height) &&
        Tile.inRange(moistureVal, Tile.Biomes.hills.generationOptions.moisture)
      ) {
        return Tile.Biomes.hills;
      }

      if (
        Tile.inRange(
          moistureVal,
          Tile.Biomes.forestgrass.generationOptions.moisture
        )
      ) {
        return Tile.Biomes.forestgrass;
      }

      if (
        Tile.inRange(moistureVal, Tile.Biomes.grass.generationOptions.moisture)
      ) {
        return Tile.Biomes.grass;
      }
      return Tile.Biomes.moistdirt;
    }
  }

  autotileMap(rawMap: { [key: string]: Biome }) {
    // console.log("rawMap to start with: ", rawMap);
    const autotileMap = Autotile.autotile(rawMap);
    let tileIndex;
    let biome: Biome;
    let biomeId: BiomeId;
    let season: Season;
    let tile: Tile;
    season = this.game.timeManager.season;

    Object.keys(autotileMap).forEach((pos) => {
      tileIndex = autotileMap[pos];
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

  isPassable(x: number, y: number): boolean {
    const key = MapWorld.coordsToKey(x, y);
    const biome = this.biomeMap[key];
    return key in this.biomeMap && !Impassible.includes(biome.id);
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
