import * as PIXI from "pixi.js";
import { Game } from "./game";
import { Point } from "./point";
import { Tile } from "./tile";
import { Color } from "rot-js";
import { MapWorld } from "./map-world";
export enum Layer {
  TERRAIN,
  GROUNDFX,
  PLANT,
  ENTITY,
  UI,
}
import { CompositeTilemap } from "@pixi/tilemap";
import { Viewport } from "./camera";
import { settings } from "@pixi/tilemap";
import { GameSettings } from "./game-settings";
import { positionToIndex } from "./misc-utility";

export type Renderable =
  | PIXI.Sprite
  | PIXI.AnimatedSprite
  | PIXI.ParticleContainer
  | string;

export class Renderer {
  // 3x3 grid of tilemaps to render the terrain
  public terrainLayer = Array.from({ length: 9 }, () => new CompositeTilemap());
  public groundFXLayer = new PIXI.Container();
  public plantLayer = new PIXI.Container();
  public entityLayer = new PIXI.Container();
  public uiLayer = new PIXI.Container();
  private spriteCache: Renderable[];

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
    this.groundFXLayer.zIndex = 10;
    this.plantLayer.zIndex = 25;
    this.plantLayer.sortableChildren = true;
    this.entityLayer.zIndex = 15;
    this.uiLayer.zIndex = 100;
    this.spriteCache = [];
  }

  addLayersToStage(stage: PIXI.Container): void {
    let colorMatrix = new PIXI.ColorMatrixFilter();
    colorMatrix.night(3, true);
    this.terrainLayer.forEach((layer, index) => {
      // if (index % 2) {
      // layer.filters = [colorMatrix];
      // }

      stage.addChild(layer as PIXI.DisplayObject);
    });
    stage.addChild(this.groundFXLayer as PIXI.DisplayObject);
    stage.addChild(this.plantLayer as PIXI.DisplayObject);
    stage.addChild(this.entityLayer as PIXI.DisplayObject);
    stage.addChild(this.uiLayer as PIXI.DisplayObject);
  }

  renderChunkedLayers(
    layers: Layer[],
    width: number,
    height: number,
    viewportCenterTile: Point
  ) {
    const chunkCountPerSide = 3;
    const chunkWidthTiles = Math.ceil(width / chunkCountPerSide);
    const chunkHeightTiles = Math.ceil(height / chunkCountPerSide);

    layers.forEach((layer) => {
      if (layer !== Layer.ENTITY && layer !== Layer.TERRAIN) {
        this.clearLayer(layer, false);
      }
    });

    const centerChunk = Math.floor(chunkCountPerSide / 2);
    for (let i = -centerChunk; i <= centerChunk; i++) {
      for (let j = -centerChunk; j <= centerChunk; j++) {
        // calculate chunkIndex where [-1,-1] is 0 and [2,2] is 9
        const chunkIndex =
          (i + centerChunk) * chunkCountPerSide + (j + centerChunk);

        // clear just this chunk of terrain layer (BUT NO OTHER LAYERS)
        this.clearLayer(Layer.TERRAIN, false, chunkIndex);
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

  renderLayers(
    layers: Layer[],
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    chunkIndex: number
  ): void {
    let right: number;
    let bottom: number;
    let left: number;
    let top: number;
    let ratio: number = 1; // most layers are the default Tile.size
    let viewportCenterX = centerX;
    let viewportCenterY = centerY;
    let displayObj: Renderable;
    const globalLighting = GameSettings.options.toggles.enableGlobalLights;

    for (let layer of layers) {
      if (layer === Layer.PLANT) {
        ratio = Tile.size / Tile.plantSize;
        viewportCenterX = Tile.translate(centerX, Layer.TERRAIN, Layer.PLANT);
        viewportCenterY = Tile.translate(centerY, Layer.TERRAIN, Layer.PLANT);
      } else {
        ratio = 1;
        viewportCenterX = centerX;
        viewportCenterY = centerY;
      }

      right = Math.ceil(viewportCenterX + (width / 2) * ratio);
      bottom = Math.ceil(viewportCenterY + (height / 2) * ratio);
      left = Math.ceil(viewportCenterX - (width / 2) * ratio);
      top = Math.ceil(viewportCenterY - (height / 2) * ratio);

      const gameWidth = GameSettings.options.gameSize.width * ratio;
      const gameHeight = GameSettings.options.gameSize.height * ratio;

      right = Math.min(gameWidth, right);
      bottom = Math.min(gameHeight, bottom);
      left = Math.max(0, left);
      top = Math.max(0, top);

      for (let x = left; x < right; x++) {
        for (let y = top; y < bottom; y++) {
          let index: number = positionToIndex(x, y, layer);
          if (index < 0) {
            // invalid index returned
            continue;
          }
          displayObj = this.spriteCache[index];

          switch (layer) {
            case Layer.TERRAIN: {
              // this.tintObjectWithChildren(displayObj, new Point(x, y));
              this.terrainLayer[chunkIndex].tile(
                displayObj as string,
                Math.floor(
                  x * (Tile.size / this.terrainLayer[chunkIndex].scale.x) -
                    Tile.size / this.terrainLayer[chunkIndex].scale.x / 2
                ), // half size as layer is scaled up by 2
                Math.floor(
                  y * (Tile.size / this.terrainLayer[chunkIndex].scale.y) -
                    Tile.size / this.terrainLayer[chunkIndex].scale.x / 2
                )
                // { alpha: 0.1 }
              );
              break;
            }
            case Layer.GROUNDFX: {
              if (!displayObj) {
                continue;
              }
              // this.tintObjectWithChildren(displayObj, new Point(x, y));
              this.groundFXLayer.addChild(displayObj as PIXI.DisplayObject);
              break;
            }
            case Layer.PLANT: {
              if (!displayObj) {
                continue;
              }
              if (globalLighting) {
                const terrainPoint = Tile.translatePoint(
                  new Point(x, y),
                  Layer.PLANT,
                  Layer.TERRAIN
                );
                this.tintObjectWithChildren(displayObj, terrainPoint);
              }

              // displayObj.zIndex = GameSettings.options.gameSize.height * ratio - y;
              this.plantLayer.addChild(displayObj as PIXI.DisplayObject);
              break;
            }
            case Layer.ENTITY: {
              if (!displayObj) {
                continue;
              }
              if (globalLighting) {
                this.tintObjectWithChildren(displayObj, new Point(x, y), true);
              }
              this.entityLayer.addChild(displayObj as PIXI.DisplayObject);
              break;
            }
            case Layer.UI: {
              if (!displayObj) {
                continue;
              }
              this.uiLayer.addChild(displayObj as PIXI.DisplayObject);
              break;
            }
          }
        }
      }
    }
  }

  // add the sprite to the cache, to be rendered on the next render pass
  // TODO: don't create the sprite here, just take a sprite or animated sprite and add it to the cache
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
      case Layer.PLANT: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        if (isSprite) {
          (displayObj as PIXI.Sprite).position.x = position.x * Tile.plantSize;
          (displayObj as PIXI.Sprite).position.y = position.y * Tile.plantSize;
        }
        break;
      }
      case Layer.TERRAIN: {
        break;
      }
      case Layer.GROUNDFX: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        (displayObj as PIXI.Sprite).position.x = position.x * Tile.plantSize;
        (displayObj as PIXI.Sprite).position.y = position.y * Tile.plantSize;
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

  public getTintForPosition(position: Point, hightlight: boolean = false) {
    const lightMap = this.game.map.lightManager.lightMap;
    const sunMap = this.game.map.shadowMap.shadowMap;
    const occlusionMap = this.game.map.shadowMap.occlusionMap;
    const cloudMap = this.game.map.cloudMap.cloudMap;

    return Color.toHex(
      this.game.map.lightManager.getLightColorFor(
        position.x,
        position.y,
        lightMap,
        sunMap,
        occlusionMap,
        cloudMap,
        hightlight
      )
    );
  }

  private tintObjectWithChildren(
    obj: Renderable,
    position: Point,
    highlight: boolean = false
  ) {
    let tint: string;
    tint = this.getTintForPosition(position, highlight);
    if (typeof obj === "string") {
      return;
    }

    if ("tint" in obj && !(obj instanceof PIXI.ParticleContainer)) {
      // double tinting particle container and particles leads to dark sprites
      obj["tint"] = tint;
    }
    if ("children" in obj) {
      (obj["children"] as Renderable[]).forEach((child) => {
        if (typeof child !== "string" && "tint" in child) {
          child["tint"] = tint;
        }
      });
    }
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
      case Layer.TERRAIN: {
        // this.terrainLayer.removeChild(cachedObj);
        break;
      }
      case Layer.GROUNDFX: {
        this.groundFXLayer.removeChild(cachedObj as PIXI.DisplayObject);
        break;
      }
      case Layer.PLANT: {
        this.plantLayer.removeChild(cachedObj as PIXI.DisplayObject);
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

  clearCache(layer?: Layer): void {
    if (layer) {
      // iterate through all indexes of spriteCache layer and set to null
      const layerCount =
        GameSettings.options.gameSize.width *
        GameSettings.options.gameSize.height;
      for (let i = layer * layerCount; i < (layer + 1) * layerCount; i++) {
        this.spriteCache[i] = null;
      }
    } else {
      this.spriteCache = [];
    }
  }

  clearScene(clearCache = false): void {
    this.clearLayer(Layer.TERRAIN, clearCache);
    this.clearLayer(Layer.GROUNDFX, clearCache);
    this.clearLayer(Layer.PLANT, clearCache);
    this.clearLayer(Layer.ENTITY, clearCache);
    this.clearLayer(Layer.UI, clearCache);
  }

  clearLayers(layers: Layer[], clearCache = false): void {
    for (let layer of layers) {
      this.clearLayer(layer, clearCache);
    }
  }

  clearLayer(layer: Layer, clearCache = false, chunkIndex?: number): void {
    if (clearCache) {
      this.clearCache(layer);
    }
    switch (layer) {
      case Layer.TERRAIN: {
        if (chunkIndex !== undefined) {
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
        this.plantLayer.removeChildren();
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
