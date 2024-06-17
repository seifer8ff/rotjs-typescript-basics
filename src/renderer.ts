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

export class Renderer {
  public terrainLayer = new PIXI.Container();
  public groundFXLayer = new PIXI.Container();
  public plantLayer = new PIXI.Container();
  public entityLayer = new PIXI.Container();
  public uiLayer = new PIXI.Container();
  private spriteCache: PIXI.DisplayObject[];

  constructor(private game: Game) {
    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.RENDER_OPTIONS.antialias = false;
    this.terrainLayer.zIndex = 5;
    this.groundFXLayer.zIndex = 10;
    this.plantLayer.zIndex = 25;
    this.plantLayer.sortableChildren = true;
    this.entityLayer.zIndex = 15;
    this.uiLayer.zIndex = 100;
    this.spriteCache = [];
  }

  addLayersToStage(stage: PIXI.Container): void {
    stage.addChild(this.terrainLayer);
    stage.addChild(this.groundFXLayer);
    stage.addChild(this.plantLayer);
    stage.addChild(this.entityLayer);
    stage.addChild(this.uiLayer);
  }

  renderLayers(
    layers: Layer[],
    width: number,
    height: number,
    viewportCenterTile: Point
  ): void {
    let centerViewport: Point;
    let right: number;
    let bottom: number;
    let left: number;
    let top: number;

    for (let layer of layers) {
      const ratio =
        layer === Layer.PLANT || layer === Layer.GROUNDFX
          ? Tile.size / Tile.plantSize
          : 1;
      centerViewport =
        layer === Layer.PLANT || layer === Layer.GROUNDFX
          ? Tile.translatePoint(viewportCenterTile, Layer.TERRAIN, Layer.PLANT)
          : viewportCenterTile;

      right = centerViewport.x + Math.ceil((width / 2) * ratio);
      bottom = centerViewport.y + Math.ceil((height / 2) * ratio);
      left = Math.max(0, centerViewport.x - Math.floor((width / 2) * ratio));
      top = Math.max(0, centerViewport.y - Math.floor((height / 2) * ratio));

      const gameWidth = this.game.options.gameSize.width * ratio;
      const gameHeight = this.game.options.gameSize.height * ratio;

      right = Math.min(gameWidth, right);
      bottom = Math.min(gameHeight, bottom);

      if (layer !== Layer.ENTITY) {
        this.clearLayer(layer);
      }

      for (let x = left; x < right; x++) {
        for (let y = top; y < bottom; y++) {
          const key = MapWorld.coordsToKey(x, y);
          let index: number = this.game.positionToIndex(x, y, layer);
          if (index < 0) {
            // invalid index returned
            continue;
          }
          let displayObj = this.spriteCache[index];

          switch (layer) {
            case Layer.TERRAIN: {
              this.tintObjectWithChildren(displayObj, new Point(x, y));
              this.terrainLayer.addChild(displayObj);
              break;
            }
            case Layer.GROUNDFX: {
              if (!displayObj) {
                continue;
              }
              // this.tintObjectWithChildren(displayObj, new Point(x, y));
              this.groundFXLayer.addChild(displayObj);
              break;
            }
            case Layer.PLANT: {
              if (!displayObj) {
                continue;
              }
              const terrainPoint = Tile.translatePoint(
                new Point(x, y),
                Layer.PLANT,
                Layer.TERRAIN
              );
              this.tintObjectWithChildren(displayObj, terrainPoint);

              // displayObj.zIndex = this.game.options.gameSize.height * ratio - y;
              this.plantLayer.addChild(displayObj);
              break;
            }
            case Layer.ENTITY: {
              if (!displayObj) {
                continue;
              }
              this.tintObjectWithChildren(displayObj, new Point(x, y), true);
              this.entityLayer.addChild(displayObj);
              break;
            }
            case Layer.UI: {
              if (!displayObj) {
                continue;
              }
              this.uiLayer.addChild(displayObj);
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
    displayObj: PIXI.DisplayObject,
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
        // const ratio = Tile.size / Tile.plantSize;
        // const terrainPoint = new Point(
        //   Math.floor(position.x / ratio),
        //   Math.floor(position.y / ratio)
        // );
        // displayObj.zIndex =
        //   this.game.options.gameSize.height * ratio - terrainPoint.y;
        displayObj.position.x = position.x * Tile.plantSize;
        displayObj.position.y = position.y * Tile.plantSize;
        // displayObj.scale.set(1);
        // console.log("add sprite to plant", sprite, position.x, position.y);
        break;
      }
      case Layer.TERRAIN: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);

          displayObj.scale.set(2);
        }
        displayObj.position.x = position.x * Tile.size;
        displayObj.position.y = position.y * Tile.size;
        break;
      }
      case Layer.GROUNDFX: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        displayObj.position.x = position.x * Tile.plantSize;
        displayObj.position.y = position.y * Tile.plantSize;
        break;
      }
      case Layer.UI: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
          displayObj.scale.set(2);
        }
        displayObj.position.x = position.x * Tile.size;
        displayObj.position.y = position.y * Tile.size;
        break;
      }
      case Layer.ENTITY: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
          // displayObj.scale.set(1);
        }
        displayObj.position.x = position.x * Tile.size;
        displayObj.position.y = position.y * Tile.size;
        break;
      }
    }

    if (initialTint && isSprite) {
      (displayObj as PIXI.Sprite).tint = initialTint || "0xFFFFFF";
    }

    let index = this.game.positionToIndex(position.x, position.y, layer);
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
    obj: PIXI.DisplayObject,
    position: Point,
    highlight: boolean = false
  ) {
    let tint: string;
    tint = this.getTintForPosition(position, highlight);
    if ("tint" in obj && !(obj instanceof PIXI.ParticleContainer)) {
      // double tinting particle container and particles leads to dark sprites
      obj["tint"] = tint;
    }
    if ("children" in obj) {
      (obj["children"] as PIXI.DisplayObject[]).forEach((child) => {
        if ("tint" in child) {
          child["tint"] = tint;
        }
      });
    }
  }

  // update a sprites position in the cache, to be rendered on the next render pass
  updateSpriteCachePosition(oldPos: Point, newPos: Point, layer: Layer): void {
    const newIndex = this.game.positionToIndex(newPos.x, newPos.y, layer);
    const oldIndex = this.game.positionToIndex(oldPos.x, oldPos.y, layer);
    this.spriteCache[newIndex] = this.spriteCache[oldIndex];
    this.spriteCache[oldIndex] = null;
  }

  // remove the sprite from the cache and from the scene, immediately
  removeFromScene(tileIndex: number, layer: Layer): void {
    let cachedObj: PIXI.DisplayObject;
    cachedObj = this.spriteCache[tileIndex];
    // remove from spriteByPos
    this.spriteCache[tileIndex] = undefined;
    switch (layer) {
      case Layer.TERRAIN: {
        this.terrainLayer.removeChild(cachedObj);
        break;
      }
      case Layer.GROUNDFX: {
        this.groundFXLayer.removeChild(cachedObj);
        break;
      }
      case Layer.PLANT: {
        this.plantLayer.removeChild(cachedObj);
        break;
      }
      case Layer.ENTITY: {
        this.entityLayer.removeChild(cachedObj);
      }
      case Layer.UI: {
        this.uiLayer.removeChild(cachedObj);
      }
    }
  }

  clearCache(layer?: Layer): void {
    if (layer) {
      // iterate through all indexes of spriteCache layer and set to null
      const layerCount =
        this.game.options.gameSize.width * this.game.options.gameSize.height;
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

  clearLayer(layer: Layer, clearCache = false): void {
    if (clearCache) {
      this.clearCache(layer);
    }
    switch (layer) {
      case Layer.TERRAIN: {
        this.terrainLayer.removeChildren();
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
      this.spriteCache[this.game.positionToIndex(tilePos.x, tilePos.y, layer)];
    if (sprite) {
      sprite.transform.position.x = x;
      sprite.transform.position.y = y;
    }
  }

  getSpriteTransformPosition(tilePos: Point, layer: Layer): [number, number] {
    const sprite =
      this.spriteCache[this.game.positionToIndex(tilePos.x, tilePos.y, layer)];
    if (sprite) {
      return [sprite.x, sprite.y];
    }
    return null;
  }

  getFromCache(tilePos: Point, layer: Layer): PIXI.DisplayObject {
    return this.spriteCache[
      this.game.positionToIndex(tilePos.x, tilePos.y, layer)
    ];
  }
}
