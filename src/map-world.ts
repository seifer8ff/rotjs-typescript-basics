import { Color, Map as RotJsMap } from "rot-js/lib/index";
import { RNG } from "rot-js";
import { Game } from "./game";
import { Biome, BiomeType, Season, Tile, TileType } from "./tile";
import { Point } from "./point";
import { Actor } from "./entities/actor";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import PreciseShadowcasting from "rot-js/lib/fov/precise-shadowcasting";
import { LightManager } from "./light-manager";

export class MapWorld {
  public lightManager: LightManager;
  private biomeMap: { [key: string]: Biome };
  public terrainTileMap: { [key: string]: Tile };
  private heightMap: { [key: string]: number };
  private terrainMap: { [key: string]: Biome };
  private adjacencyMap: { [key: string]: Biome[] };
  private dirtyTiles: string[];
  private landHeight: number;
  private valleyScaleFactor: number;
  private edgePadding: number;
  private islandMask: number;

  constructor(private game: Game) {
    this.terrainTileMap = {};
    this.biomeMap = {};
    this.heightMap = {};
    this.terrainMap = {};
    this.adjacencyMap = {};
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
    this.terrainTileMap = {};
    this.biomeMap = {};
    this.heightMap = {}; // between 0 and 1
    this.terrainMap = {};
    this.dirtyTiles = [];

    const noise = new Simplex();

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.heightMap[key] = this.getHeight(x, y, width, height, noise);
        this.terrainMap[key] = this.assignTerrain(x, y);
      }
    }
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = MapWorld.coordsToKey(x, y);
        this.adjacencyMap[key] = this.assignAdjacentTerrain(x, y);
        this.biomeMap[key] = this.assignBiome(x, y);
        this.dirtyTiles.push(key);
      }
    }

    this.autotileMap(this.biomeMap);
    this.lightManager = new LightManager(this.game, this);
  }

  lerp(x: number, y: number, a: number): number {
    return x * (1 - a) + y * a;
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
    height = this.lerp(height, 1 - d, this.islandMask);

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

    if (Tile.inRange(heightVal, Tile.Biomes.dirt.generationOptions.height)) {
      return Tile.Biomes.dirt;
    }

    if (
      Tile.inRange(heightVal, Tile.Biomes.grassland.generationOptions.height)
    ) {
      return Tile.Biomes.grassland;
    }
  }

  assignAdjacentTerrain(x: number, y: number): Biome[] {
    const adjacencyDistance = 2;
    const key = MapWorld.coordsToKey(x, y);
    const heightVal = this.heightMap[key];
    const terrain = this.terrainMap[key];
    const adjacentTerrain = [];
    let pos: Point;
    let biome: Biome;
    for (
      let xOffset = -adjacencyDistance;
      xOffset <= adjacencyDistance;
      xOffset++
    ) {
      for (
        let yOffset = -adjacencyDistance;
        yOffset <= adjacencyDistance;
        yOffset++
      ) {
        if (xOffset === 0 && yOffset === 0) {
          continue;
        }
        pos = new Point(x + xOffset, y + yOffset);
        biome = this.terrainMap[MapWorld.coordsToKey(pos.x, pos.y)];
        if (biome) {
          adjacentTerrain.push(biome);
        }
      }
    }
    return adjacentTerrain;
  }

  isAdjacentToTerrain(x: number, y: number, terrain: Biome[]): boolean {
    const key = MapWorld.coordsToKey(x, y);
    const adjacentTerrain = this.adjacencyMap[key];
    for (let i = 0; i < adjacentTerrain.length; i++) {
      if (terrain.includes(adjacentTerrain[i])) {
        return true;
      }
    }
    return false;
  }

  assignBiome(x: number, y: number): Biome {
    const key = MapWorld.coordsToKey(x, y);
    const heightVal = this.heightMap[key];

    if (this.terrainMap[key] === Tile.Biomes.ocean) {
      if (
        Tile.inRange(
          heightVal,
          Tile.Biomes.oceandeep.generationOptions.height
        ) &&
        !this.isAdjacentToTerrain(x, y, [
          Tile.Biomes.dirt,
          Tile.Biomes.grassland,
        ])
      ) {
        return Tile.Biomes.oceandeep;
      }
      return Tile.Biomes.ocean;
    }

    if (Tile.inRange(heightVal, Tile.Biomes.dirt.generationOptions.height)) {
      if (Tile.inRange(heightVal, Tile.Biomes.sand.generationOptions.height)) {
        return Tile.Biomes.sand;
      }
      return Tile.Biomes.dirt;
    }

    if (
      Tile.inRange(heightVal, Tile.Biomes.grassland.generationOptions.height)
    ) {
      if (Tile.inRange(heightVal, Tile.Biomes.hills.generationOptions.height)) {
        return Tile.Biomes.hills;
      }

      if (
        Tile.inRange(
          heightVal,
          Tile.Biomes.swampdirt.generationOptions.height
        ) &&
        !this.isAdjacentToTerrain(x, y, [Tile.Biomes.dirt, Tile.Biomes.ocean])
      ) {
        if (
          Tile.inRange(
            heightVal,
            Tile.Biomes.swampwater.generationOptions.height
          ) &&
          this.isAdjacentToTerrain(x, y, [Tile.Biomes.swampdirt])
        ) {
          return Tile.Biomes.swampwater;
        }
        return Tile.Biomes.swampdirt;
      }

      if (
        Tile.inRange(
          heightVal,
          Tile.Biomes.forestgrass.generationOptions.height
        ) &&
        !this.isAdjacentToTerrain(x, y, [Tile.Biomes.dirt, Tile.Biomes.ocean])
      ) {
        return Tile.Biomes.forestgrass;
      }
      return Tile.Biomes.grassland;
    }
  }

  autotileMap(rawMap: { [key: string]: Biome }) {
    // console.log("rawMap to start with: ", rawMap);
    const autotileMap = Autotile.autotile(rawMap);
    let tileIndex;
    let biome: BiomeType;
    let season: Season;
    let tile: Tile;

    Object.keys(autotileMap).forEach((pos) => {
      tileIndex = autotileMap[pos];
      biome = rawMap[pos].biome;
      season = rawMap[pos].season;
      tile = Tile.Tilesets[biome][season][tileIndex];

      if (!tile) {
        console.log(`AUTOTILE ERROR: ${biome} - ${season} - ${tileIndex}`);
      }
      this.terrainTileMap[pos] = tile;
    });
  }

  setTile(x: number, y: number, tile: Tile): void {
    this.terrainTileMap[MapWorld.coordsToKey(x, y)] = tile;
    this.dirtyTiles.push(MapWorld.coordsToKey(x, y));
  }

  getRandomTilePositions(biomeType: BiomeType, quantity: number = 1): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (let key in this.terrainTileMap) {
      // console.log("this.map[key]", key, this.map[key]);
      if (this.terrainTileMap[key].biomeType === biomeType) {
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
    return this.terrainTileMap[MapWorld.coordsToKey(x, y)];
  }

  getTileType(x: number, y: number): TileType {
    return this.terrainTileMap[MapWorld.coordsToKey(x, y)].type;
  }

  isPassable(x: number, y: number): boolean {
    const key = MapWorld.coordsToKey(x, y);
    const tile = this.terrainTileMap[key];
    return (
      key in this.terrainTileMap &&
      tile?.biomeType !== Tile.Biomes.ocean.biome &&
      tile?.biomeType !== Tile.Biomes.oceandeep.biome &&
      tile?.biomeType !== Tile.Biomes.hills.biome
    );
  }

  draw(): void {
    for (let key of this.dirtyTiles) {
      if (key) {
        const tile = this.terrainTileMap[key];
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
