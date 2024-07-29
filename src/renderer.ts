import * as PIXI from "pixi.js";
import { Game } from "./game";
import { Point } from "./point";
import { Tile } from "./tile";
import { Color } from "rot-js";
import { MapWorld } from "./map-world";
export enum Layer {
  TERRAIN = 1,
  GROUNDFX,
  ENTITY,
  PLANT,
  TREE,
  UI,
}
import { CompositeTilemap } from "@pixi/tilemap";
import { settings } from "@pixi/tilemap";
import { GameSettings } from "./game-settings";
import { positionToIndex } from "./misc-utility";
import { RGBAColor } from "./light-manager";

export type Renderable =
  | PIXI.Sprite
  | PIXI.AnimatedSprite
  | PIXI.ParticleContainer;

export class Renderer {
  public chunkCountPerSide = 3; // must be ODD number
  // 3x3 grid of tilemaps to render the terrain
  public terrainLayer = Array.from(
    { length: this.chunkCountPerSide * this.chunkCountPerSide },
    () => new CompositeTilemap()
  );
  public groundFXLayer = new PIXI.Container();
  public plantLayer = Array.from(
    { length: this.chunkCountPerSide * this.chunkCountPerSide },
    () => new CompositeTilemap()
  );
  public treeLayer = new PIXI.Container();
  public entityLayer = new PIXI.Container();
  public uiLayer = new PIXI.Container();
  private spriteCache: (Renderable | undefined)[] = [];
  private spriteIndexCache: Int32Array = new Int32Array(0);

  constructor(private game: Game) {
    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.RENDER_OPTIONS.antialias = false;
    settings.use32bitIndex = true;
    settings.TEXTILE_SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

    this.terrainLayer.forEach((layer) => {
      layer.zIndex = 5;
      const tileScale = Math.ceil(Tile.size / Tile.terrainTilePixelSize);
      layer.scale.set(tileScale); // scale up from 16px to Tile.size (32px)
    });
    this.groundFXLayer.zIndex = 20;
    this.plantLayer.forEach((layer) => {
      layer.zIndex = 35;
    });
    this.treeLayer.zIndex = 45;
    this.treeLayer.sortableChildren = true;
    this.entityLayer.zIndex = 55;
    this.uiLayer.zIndex = 10;
  }

  public init(): void {
    this.clearScene();
    this.clearCache();
    this.spriteCache = [];
    const layerCount = Layer.UI + 1;
    let layerSize =
      GameSettings.options.gameSize.width *
      Tile.tileDensityRatio *
      GameSettings.options.gameSize.height *
      Tile.tileDensityRatio; // account for dense grid, like for plants
    layerSize *= layerCount; // account for each layer
    this.spriteIndexCache = new Int32Array(layerSize).fill(-1);
  }

  addLayersToStage(stage: PIXI.Container): void {
    this.terrainLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    stage.addChild(this.groundFXLayer as PIXI.DisplayObject);
    this.plantLayer.forEach((layer, index) => {
      stage.addChild(layer as PIXI.DisplayObject);
    });
    stage.addChild(this.treeLayer as PIXI.DisplayObject);
    stage.addChild(this.entityLayer as PIXI.DisplayObject);
    stage.addChild(this.uiLayer as PIXI.DisplayObject);
  }

  renderChunkedLayers(
    layers: Layer[],
    width: number,
    height: number,
    viewportCenterTile: Point
  ) {
    const chunkWidthTiles = Math.ceil(width / this.chunkCountPerSide);
    const chunkHeightTiles = Math.ceil(height / this.chunkCountPerSide);
    let clearTerrainLayer = false;
    let clearPlantLayer = false;

    for (let layer of layers) {
      switch (layer) {
        case Layer.TERRAIN:
          clearTerrainLayer = true;
          break;
        case Layer.PLANT:
          clearPlantLayer = true;
          break;
        default:
          this.clearSceneLayer(layer);
          break;
      }
    }

    const centerChunk = Math.floor(this.chunkCountPerSide / 2);
    for (let i = -centerChunk; i <= centerChunk; i++) {
      for (let j = -centerChunk; j <= centerChunk; j++) {
        // calculate chunkIndex where [-1,-1] is 0 and [2,2] is 9
        const chunkIndex =
          (i + centerChunk) * this.chunkCountPerSide + (j + centerChunk);

        // clear just this chunk of terrain layer (BUT NO OTHER LAYERS)
        if (clearTerrainLayer) {
          this.clearSceneLayer(Layer.TERRAIN, chunkIndex);
        }

        if (clearPlantLayer) {
          this.clearSceneLayer(Layer.PLANT, chunkIndex);
        }

        this.renderLayers(
          layers,
          chunkWidthTiles,
          chunkHeightTiles,
          viewportCenterTile.x + i * chunkWidthTiles,
          viewportCenterTile.y + j * chunkHeightTiles,
          chunkIndex
        );
      }
    }
  }

  renderLayer(
    layer: Layer,
    tileX: number,
    tileY: number,
    chunkIndex: number = -1,
    tint: RGBAColor | string | undefined = undefined
  ) {
    let index = positionToIndex(tileX, tileY, layer);
    if (index < 0) {
      // invalid index returned
      return;
    }
    let tileID: number;
    let tile: Tile;
    let displayObj: Renderable;

    switch (layer) {
      case Layer.TERRAIN: {
        tileID = this.spriteIndexCache[index];
        tile = Tile.tiles[tileID];

        this.terrainLayer[chunkIndex].tile(
          tile.spritePath,
          Math.floor(
            tileX * (Tile.size / this.terrainLayer[chunkIndex].scale.x) -
              Tile.size / this.terrainLayer[chunkIndex].scale.x / 2
          ), // half size as layer is scaled up by 2
          Math.floor(
            tileY * (Tile.size / this.terrainLayer[chunkIndex].scale.y) -
              Tile.size / this.terrainLayer[chunkIndex].scale.x / 2
          ),
          { alpha: 1, tint: tint as RGBAColor }
        );
        break;
      }
      case Layer.GROUNDFX: {
        displayObj = this.spriteCache[index];
        if (!displayObj) {
          return;
        }
        // this.tintObjectWithChildren(displayObj, new Point(x, y));
        this.groundFXLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
      case Layer.PLANT: {
        tileID = this.spriteIndexCache[index];
        if (tileID === -1) {
          return;
        }
        tile = Tile.tiles[tileID];

        if (!tile) {
          return;
        }
        this.plantLayer[chunkIndex].tile(
          tile.spritePath,
          Math.floor(tileX * Tile.denseSize - Tile.size / 2), // half size as layer is scaled up by 2
          Math.floor(tileY * Tile.denseSize - Tile.size / 2),
          {
            alpha: 1,
            tint: tint as RGBAColor,
          }
        );
        break;
      }
      case Layer.TREE: {
        displayObj = this.spriteCache[index];
        if (!displayObj) {
          return;
        }

        // displayObj.zIndex = GameSettings.options.gameSize.height * ratio - y;
        this.treeLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
      case Layer.ENTITY: {
        displayObj = this.spriteCache[index];
        if (!displayObj) {
          return;
        }
        this.entityLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
      case Layer.UI: {
        displayObj = this.spriteCache[index];
        if (!displayObj) {
          return;
        }
        this.uiLayer.addChild(displayObj as PIXI.DisplayObject);
        break;
      }
    }
  }

  renderLayers(
    layers: Layer[],
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    chunkIndex: number
  ): void {
    const shouldTint = GameSettings.shouldTint();
    let right: number;
    let bottom: number;
    let left: number;
    let top: number;
    let tint: RGBAColor | string | undefined = undefined;
    let gameWidth: number = GameSettings.options.gameSize.width;
    let gameHeight: number = GameSettings.options.gameSize.height;
    let tileX: number;
    let tileY: number;

    right = Math.ceil(centerX + width / 2);
    bottom = Math.ceil(centerY + height / 2);
    left = Math.ceil(centerX - width / 2);
    top = Math.ceil(centerY - height / 2);

    right = Math.max(Math.min(gameWidth, right), 0);
    bottom = Math.max(Math.min(gameHeight, bottom), 0);
    left = Math.min(right, Math.max(0, left));
    top = Math.min(bottom, Math.max(0, top));
    for (let x = left; x < right; x += 1) {
      for (let y = top; y < bottom; y += 1) {
        for (let layer of layers) {
          if (shouldTint) {
            if (layer === Layer.TERRAIN || layer === Layer.PLANT) {
              // other layers are tinted in a separate step during the game loop
              // for perf reasons
              tint = this.game.map.lightManager.getRGBALightFor(x, y, false);
            }
          }

          tileX = x;
          tileY = y;
          if (layer === Layer.PLANT || layer === Layer.TREE) {
            tileX = Tile.translate(x, Layer.TERRAIN, Layer.PLANT);
            tileY = Tile.translate(y, Layer.TERRAIN, Layer.PLANT);
            for (let i = 0; i < Tile.tileDensityRatio / 2; i++) {
              for (let j = 0; j < Tile.tileDensityRatio / 2; j++) {
                tileX = tileX + i;
                tileY = tileY + j;
                this.renderLayer(layer, tileX, tileY, chunkIndex, tint);
              }
            }
          } else {
            this.renderLayer(layer, tileX, tileY, chunkIndex, tint);
          }
        }
      }
    }
  }

  // add the sprite/particle container, etc to the cache, to be rendered on the next render pass
  addToScene(
    position: Point,
    layer: Layer,
    displayObj: Renderable,
    initialTint?: string
  ): void {
    let isSprite = false;

    if (!displayObj) {
      // throw (new Error("No sprite provided"), position, layer, sprite, tint);
      console
        .throttle(250)
        .log(
          "Error: addToScene: no displayObj provided",
          position,
          layer,
          displayObj,
          initialTint
        );
      return;
    }
    isSprite =
      displayObj instanceof PIXI.Sprite ||
      displayObj instanceof PIXI.AnimatedSprite;

    switch (layer) {
      case Layer.TREE:
      case Layer.PLANT:
      case Layer.TERRAIN:
        break;
      case Layer.GROUNDFX: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.denseSize;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.denseSize;
        break;
      }
      case Layer.UI: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
          (displayObj as PIXI.Sprite).scale.set(2);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.size;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.size;
        break;
      }
      case Layer.ENTITY: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.size;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.size;
        break;
      }
    }

    if (initialTint && isSprite) {
      (displayObj as PIXI.Sprite).tint = initialTint || "0xFFFFFF";
    }

    let index = positionToIndex(position.x, position.y, layer);
    this.spriteCache[index] = displayObj;
  }

  addTileIdToScene(position: Point, layer: Layer, tileId: number): void {
    let index = positionToIndex(position.x, position.y, layer);
    this.spriteIndexCache[index] = tileId;
  }

  public tintObjectWithChildren(obj: Renderable, tint: string) {
    if (!("tint" in obj)) return;
    if (obj["tint"] === tint) return;

    if ("children" in obj) {
      (obj["children"] as Renderable[]).forEach((child) =>
        this.tintObjectWithChildren(child, tint)
      );
    }

    if (obj instanceof PIXI.ParticleContainer) return;

    obj["tint"] = tint;
  }

  // update a sprites position in the cache, to be rendered on the next render pass
  updateSpriteCachePosition(oldPos: Point, newPos: Point, layer: Layer): void {
    const newIndex = positionToIndex(newPos.x, newPos.y, layer);
    const oldIndex = positionToIndex(oldPos.x, oldPos.y, layer);
    this.spriteCache[newIndex] = this.spriteCache[oldIndex];
    this.spriteCache[oldIndex] = null;
  }

  // remove the sprite from the cache and from the scene, immediately
  removeFromScene(tileIndex: number, layer: Layer): void {
    let cachedObj: Renderable;
    cachedObj = this.spriteCache[tileIndex];
    // remove from spriteByPos
    this.spriteCache[tileIndex] = undefined;
    if (typeof cachedObj === "string") {
      return;
    }
    switch (layer) {
      case Layer.PLANT:
      case Layer.TERRAIN:
        break;
      case Layer.GROUNDFX: {
        this.groundFXLayer.removeChild(cachedObj as PIXI.DisplayObject);
        break;
      }
      case Layer.ENTITY: {
        this.entityLayer.removeChild(cachedObj as PIXI.DisplayObject);
      }
      case Layer.UI: {
        this.uiLayer.removeChild(cachedObj as PIXI.DisplayObject);
      }
    }
  }

  removeFromCache(tilePos: Point, layer: Layer): void {
    // set to null rather than removing the index
    // to prevent shifting all of the indexes
    this.spriteCache[positionToIndex(tilePos.x, tilePos.y, layer)] = null;
  }

  //
  // NEXT PERF IMPROVEMENT:
  // spriteCache is too large of an array on large worlds
  // same with spriteIndexCache
  // need to somehow reduce this- maybe an array per layer?
  // maybe auto chunking when index is over a certain size?
  //

  // old:
  // MOVE TO KEEPING A LIST OF SPARSE LAYERS AND JUST CLEARING THOSE INDICES
  // THIS WILL DRASTICALLY IMPROVE PERF
  clearCache(layer?: Layer): void {
    if (layer) {
      const width = GameSettings.options.gameSize.width;
      const height = GameSettings.options.gameSize.height;
      const widthInTiles = width * Tile.tileDensityRatio;
      const heightInTiles = height * Tile.tileDensityRatio;
      const totalTiles = widthInTiles * heightInTiles;
      const start = (layer - 1) * totalTiles;
      const end = layer * totalTiles;
      if (layer === Layer.TERRAIN || layer === Layer.PLANT) {
        // only clear the spriteIndexCache for tileMap layers
        this.spriteIndexCache.fill(-1, start, end);
      } else {
        this.spriteCache.fill(null, start, end);
        // // Start at the minimum of 'start' or the first defined index if 'start' is out of bounds
        // const effectiveStart = Math.max(start, 0);
        // // End at the minimum of 'end' or the last index of the array
        // const effectiveEnd = Math.min(end, this.spriteCache.length - 1);

        // // TODO: just switch the sprite cache to a simple list, with position and sprite or something.
        // // that prevents needing to iterate through entire array every frame

        // for (let i = effectiveStart; i <= effectiveEnd; i++) {
        //   if (this.spriteCache[i] !== undefined) {
        //     this.spriteCache[i] = null;
        //   }
        // }
      }
    } else if (!layer) {
      this.clearCache(Layer.PLANT);
      this.clearCache(Layer.TREE);
      this.clearCache(Layer.UI);
    }
  }

  // clearCache(layer?: Layer): void {
  //   if (layer) {
  //     const width = GameSettings.options.gameSize.width;
  //     const height = GameSettings.options.gameSize.height;
  //     const widthInTiles = width * Tile.tileDensityRatio;
  //     const heightInTiles = height * Tile.tileDensityRatio;
  //     const totalTiles = widthInTiles * heightInTiles;
  //     const start = (layer - 1) * totalTiles;
  //     const end = layer * totalTiles;
  //     this.spriteIndexCache.fill(-1, start, end);

  //     // special method of copying and clearing the array
  //     // this is faster than any other method of clearing the array so far
  //     for (let i = start; i < length - totalTiles; i++) {
  //       this.spriteCache[i] = this.spriteCache[i + totalTiles];
  //     }
  //     // Adjust the length of the array to remove the duplicate elements at the end
  //     if (this.spriteCache.length > totalTiles) {
  //       this.spriteCache.length -= totalTiles;
  //     }
  //   } else if (!layer) {
  //     this.clearCache(Layer.PLANT);
  //     this.clearCache(Layer.TREE);
  //     this.clearCache(Layer.UI);
  //   }
  // }

  clearCacheViewport(
    width: number,
    height: number,
    viewportCenterTile: Point,
    layer?: Layer
  ): void {
    if (layer) {
      // if (layer === Layer.TERRAIN || layer === Layer.PLANT) {
      //   return;
      // }

      let right: number;
      let bottom: number;
      let left: number;
      let top: number;
      let ratio: number = 1; // most layers are the default Tile.size
      let viewportCenterX = viewportCenterTile.x;
      let viewportCenterY = viewportCenterTile.y;
      let index = -1;
      let gameWidth = GameSettings.options.gameSize.width;
      let gameHeight = GameSettings.options.gameSize.height;

      if (layer === Layer.PLANT || layer === Layer.TREE) {
        ratio = Tile.tileDensityRatio;
        viewportCenterX = Tile.translate(
          viewportCenterX,
          Layer.TERRAIN,
          Layer.PLANT
        );
        viewportCenterY = Tile.translate(
          viewportCenterY,
          Layer.TERRAIN,
          Layer.PLANT
        );
      } else {
        ratio = 1;
        viewportCenterX = viewportCenterX;
        viewportCenterY = viewportCenterY;
      }

      gameWidth = GameSettings.options.gameSize.width * ratio;
      gameHeight = GameSettings.options.gameSize.height * ratio;

      right = Math.ceil(viewportCenterX + (width / 2) * ratio);
      bottom = Math.ceil(viewportCenterY + (height / 2) * ratio);
      left = Math.ceil(viewportCenterX - (width / 2) * ratio);
      top = Math.ceil(viewportCenterY - (height / 2) * ratio);

      right = Math.max(Math.min(gameWidth, right), 0);
      bottom = Math.max(Math.min(gameHeight, bottom), 0);
      left = Math.min(right, Math.max(0, left));
      top = Math.min(bottom, Math.max(0, top));

      // console.log(
      //   "clearing viewport",
      //   left - right,
      //   (left - right) * (top - bottom)
      // );

      for (let x = left; x < right; x++) {
        for (let y = top; y < bottom; y++) {
          index = positionToIndex(x, y, layer);
          // if (index < 0) {
          //   // invalid index returned
          //   continue;
          // }
          // if (layer !== Layer.TERRAIN && layer !== Layer.PLANT) {
          this.spriteCache[index] = null;
          // this.spriteCache[index] = this.spriteCache.length - 1;
          // this.spriteCache.length -= 1;
          this.spriteIndexCache[index] = -1;
          // }
        }
      }
    } else if (!layer) {
    }
  }

  clearScene(): void {
    this.clearSceneLayer(Layer.TERRAIN);
    this.clearSceneLayer(Layer.GROUNDFX);
    this.clearSceneLayer(Layer.PLANT);
    this.clearSceneLayer(Layer.TREE);
    this.clearSceneLayer(Layer.ENTITY);
    this.clearSceneLayer(Layer.UI);
  }

  clearSceneLayers(layers: Layer[]): void {
    for (let layer of layers) {
      this.clearSceneLayer(layer);
    }
  }

  clearSceneLayer(layer: Layer, chunkIndex?: number): void {
    if (!this.spriteCache?.length || !this.spriteIndexCache?.length) {
      return;
    }
    switch (layer) {
      case Layer.TERRAIN: {
        if (chunkIndex >= 0) {
          this.terrainLayer[chunkIndex].clear();
        } else {
          this.terrainLayer.forEach((layer) => {
            layer.clear();
          });
        }
        break;
      }
      case Layer.GROUNDFX: {
        this.groundFXLayer.removeChildren();
        break;
      }
      case Layer.PLANT: {
        if (chunkIndex >= 0) {
          this.plantLayer[chunkIndex].clear();
        } else {
          this.plantLayer.forEach((layer) => {
            layer.clear();
          });
        }
        break;
      }
      case Layer.TREE: {
        this.treeLayer.removeChildren();
        break;
      }
      case Layer.ENTITY: {
        this.entityLayer.removeChildren();
      }
      case Layer.UI: {
        this.uiLayer.removeChildren();
      }
    }
  }

  // move a sprites position on the screen, but leave its tile position unchanged
  moveCachedSpriteTransform(
    tileKey: string,
    layer: Layer,
    x: number,
    y: number
  ): void {
    const tilePos = MapWorld.keyToPoint(tileKey);
    const sprite =
      this.spriteCache[positionToIndex(tilePos.x, tilePos.y, layer)];
    if (sprite && typeof sprite !== "string") {
      sprite.transform.position.x = x;
      sprite.transform.position.y = y;
    }
  }

  getSpriteTransformPosition(tilePos: Point, layer: Layer): Point {
    const sprite =
      this.spriteCache[positionToIndex(tilePos.x, tilePos.y, layer)];
    if (sprite && typeof sprite !== "string") {
      return new Point(
        sprite.transform.position.x,
        sprite.transform.position.y
      );
    }
    return null;
  }

  getFromCache(tilePos: Point, layer: Layer): Renderable {
    return this.spriteCache[positionToIndex(tilePos.x, tilePos.y, layer)];
  }
}
