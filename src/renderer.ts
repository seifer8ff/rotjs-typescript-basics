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
  private displayObjCache: {
    [layer: string]: {
      [pos: string]: PIXI.DisplayObject;
    };
  };

  constructor(private game: Game) {
    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.RENDER_OPTIONS.antialias = false;
    this.terrainLayer.zIndex = 5;
    this.groundFXLayer.zIndex = 10;
    this.plantLayer.zIndex = 25;
    this.plantLayer.sortableChildren = true;
    this.entityLayer.zIndex = 15;
    this.uiLayer.zIndex = 100;
    this.displayObjCache = {
      [Layer.TERRAIN]: {},
      [Layer.GROUNDFX]: {},
      [Layer.PLANT]: {},
      [Layer.ENTITY]: {},
      [Layer.UI]: {},
    };
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
      if (layer === Layer.PLANT || layer === Layer.GROUNDFX) {
        const ratio = Tile.size / Tile.plantSize;
        centerViewport = new Point(
          viewportCenterTile.x * ratio,
          viewportCenterTile.y * ratio
        );
        // console.log(
        //   "center vs plant center",
        //   viewportCenterTile.x,
        //   centerViewport.x
        // );
        right = centerViewport.x + (width / 2) * ratio;
        bottom = centerViewport.y + (height / 2) * ratio;
        left = centerViewport.x - (width / 2) * ratio;
        top = centerViewport.y - (height / 2) * ratio;
      } else {
        centerViewport = viewportCenterTile;
        right = centerViewport.x + Math.floor(width / 2);
        bottom = centerViewport.y + Math.floor(height / 2);
        left = centerViewport.x - Math.ceil(width / 2);
        top = centerViewport.y - Math.ceil(height / 2);
      }
      if (layer !== Layer.ENTITY) {
        this.clearLayer(layer);
      }

      for (let x = left; x < right; x++) {
        for (let y = top; y < bottom; y++) {
          const key = MapWorld.coordsToKey(x, y);
          let displayObj = this.displayObjCache[layer][key];
          let isSprite = false;

          if (!displayObj) {
            continue;
          }

          isSprite =
            displayObj instanceof PIXI.Sprite ||
            displayObj instanceof PIXI.AnimatedSprite;

          switch (layer) {
            case Layer.TERRAIN: {
              this.tintObjectWithChildren(displayObj, new Point(x, y));
              this.terrainLayer.addChild(displayObj);
              break;
            }
            case Layer.GROUNDFX: {
              // this.tintObjectWithChildren(displayObj, new Point(x, y));
              this.groundFXLayer.addChild(displayObj);
              break;
            }
            case Layer.PLANT: {
              const ratio = Tile.size / Tile.plantSize;
              const terrainPoint = new Point(
                Math.floor(x / ratio),
                Math.floor(y / ratio)
              );
              this.tintObjectWithChildren(displayObj, terrainPoint);

              // displayObj.zIndex = this.game.options.gameSize.height * ratio - y;
              this.plantLayer.addChild(displayObj);
              break;
            }
            case Layer.ENTITY: {
              this.tintObjectWithChildren(displayObj, new Point(x, y), true);
              this.entityLayer.addChild(displayObj);
              break;
            }
            case Layer.UI: {
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

    // const oldSprite = this.spriteCache[layer][`${position.x},${position.y}`];
    // if (oldSprite && sprite instanceof PIXI.Graphics) {
    //   // console.log("do nothing for tree");
    // } else {
    //   this.spriteCache[layer][`${position.x},${position.y}`] = sprite;
    // }
    this.displayObjCache[layer][`${position.x},${position.y}`] = displayObj;
    // // TODO: remove sprite from cache if it already exists
    // this.spriteCache[layer][`${position.x},${position.y}`] = sprite;
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
    const newKey = MapWorld.coordsToKey(newPos.x, newPos.y);
    const oldKey = MapWorld.coordsToKey(oldPos.x, oldPos.y);
    this.displayObjCache[layer][newKey] = this.displayObjCache[layer][oldKey];
    this.displayObjCache[layer][oldKey] = null;
  }

  // remove the sprite from the cache and from the scene, immediately
  removeFromScene(
    position: Point,
    displayObj: PIXI.DisplayObject | string,
    layer: Layer
  ): void {
    let cachedObj: PIXI.DisplayObject;
    if (typeof displayObj === "string") {
      cachedObj = this.displayObjCache[layer][displayObj];
    } else {
      cachedObj = displayObj;
    }
    // remove from spriteByPos
    this.displayObjCache[layer][`${position.x},${position.y}`] = undefined;
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
      this.displayObjCache[layer] = {};
    } else {
      this.displayObjCache = {
        [Layer.TERRAIN]: {},
        [Layer.GROUNDFX]: {},
        [Layer.PLANT]: {},
        [Layer.ENTITY]: {},
        [Layer.UI]: {},
      };
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
      this.displayObjCache[layer] = {};
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
    const sprite = this.displayObjCache[layer][tileKey];
    if (sprite) {
      sprite.transform.position.x = x;
      sprite.transform.position.y = y;
    }
  }

  getSpriteTransformPosition(tilePos: Point, layer: Layer): [number, number] {
    const sprite =
      this.displayObjCache[layer][MapWorld.coordsToKey(tilePos.x, tilePos.y)];
    if (sprite) {
      return [sprite.x, sprite.y];
    }
    return null;
  }

  getFromCache(tilePos: Point, layer: Layer): PIXI.DisplayObject {
    return this.displayObjCache[layer][
      MapWorld.coordsToKey(tilePos.x, tilePos.y)
    ];
  }
}
