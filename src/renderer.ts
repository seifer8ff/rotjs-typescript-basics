import * as PIXI from "pixi.js";
import { Game } from "./game";
import { Point } from "./point";
import { Tile } from "./tile";
import { Color } from "rot-js";
import { MapWorld } from "./map-world";
import { CompositeTilemap } from "@pixi/tilemap";
import { ViewportBounds } from "./camera";
export enum Layer {
  TERRAIN,
  GROUNDFX,
  PLANT,
  ENTITY,
  UI,
}

export class Renderer {
  public terrainLayer = new CompositeTilemap();
  // public terrainLayer = new PIXI.Container();
  public groundFXLayer = new PIXI.Container();
  public plantLayer = new PIXI.Container();
  public entityLayer = new PIXI.Container();
  public uiLayer = new PIXI.Container();
  private spriteCache: PIXI.DisplayObject[];
  private displayObjCache: {
    [layer: string]: {
      [pos: string]: PIXI.DisplayObject;
    };
  };

  constructor(private game: Game) {
    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.RENDER_OPTIONS.antialias = false;
    this.terrainLayer.zIndex = 5;
    this.terrainLayer.scale.set(2);
    this.groundFXLayer.zIndex = 10;
    this.plantLayer.zIndex = 25;
    this.plantLayer.sortableChildren = true;
    this.entityLayer.zIndex = 15;
    this.uiLayer.zIndex = 100;
    this.spriteCache = [];

    // this.displayObjCache = {
    //   [Layer.TERRAIN]: {},
    //   [Layer.GROUNDFX]: {},
    //   [Layer.PLANT]: {},
    //   [Layer.ENTITY]: {},
    //   [Layer.UI]: {},
    // };
  }

  addLayersToStage(stage: PIXI.Container): void {
    stage.addChild(this.terrainLayer);
    stage.addChild(this.groundFXLayer);
    stage.addChild(this.plantLayer);
    stage.addChild(this.entityLayer);
    stage.addChild(this.uiLayer);
  }

  renderLayer(layer: Layer, bounds: ViewportBounds): void {
    const right = bounds.x2;
    const bottom = bounds.y2;
    const left = bounds.x1;
    const top = bounds.y1;

    this.terrainLayer.clear();
    for (let x = 0; x < this.game.options.gameSize.width; x++) {
      for (let y = 0; y < this.game.options.gameSize.height; y++) {
        // for (let x = left; x < right; x++) {
        //   for (let y = top; y < bottom; y++) {
        const key = MapWorld.coordsToKey(x, y);
        let displayObj: PIXI.DisplayObject;
        // let index: number = this.game.positionToIndex(x, y, layer);
        // if (layer === Layer.TERRAIN) {
        //   console.throttle(10).log("Index", index, x, y, layer);
        // }

        // if (index < 0) {
        //   // console
        //   //   .throttle(250)
        //   //   .log("Index out of bounds", index, x, y, layer);
        //   continue;
        //   // return;
        // }
        // continue;

        switch (layer) {
          case Layer.TERRAIN: {
            // displayObj = this.spriteCache[index];
            // if (displayObj == null) {
            //   console.log("---- no display obj");
            //   break;
            // }
            // this.tintObjectWithChildren(displayObj, new Point(x, y));
            // this.terrainLayer.tile(
            //   (displayObj as PIXI.Sprite).texture,
            //   Math.floor((x * Tile.size) / 2),
            //   Math.floor((y * Tile.size) / 2)
            // );
            this.terrainLayer.tile(
              // (displayObj as PIXI.Sprite).texture,
              Tile.testOcean.iconPath,
              x * 16,
              y * 16,
              // Math.floor(x * (Tile.size / 2)),
              // Math.floor(y * (Tile.size / 2)),
              {
                alpha: 0.1,
                // tileHeight: Tile.size,
                // tileWidth: Tile.size,
              }
            );
            // this.terrainLayer.addChild(displayObj);
            break;
          }
          case Layer.GROUNDFX: {
            // displayObj = this.spriteCache[index];
            // if (displayObj == null) {
            //   break;
            // }
            // // this.tintObjectWithChildren(displayObj, new Point(x, y));
            // this.groundFXLayer.addChild(displayObj);
            break;
          }
          case Layer.PLANT: {
            // displayObj = this.spriteCache[index];
            // if (displayObj == null) {
            //   break;
            // }
            // const terrainPoint = Tile.translatePoint(
            //   new Point(x, y),
            //   Layer.PLANT,
            //   Layer.TERRAIN
            // );
            // this.tintObjectWithChildren(displayObj, terrainPoint);

            // // displayObj.zIndex = this.game.options.gameSize.height * ratio - y;
            // this.plantLayer.addChild(displayObj);
            break;
          }
          case Layer.ENTITY: {
            // displayObj = this.spriteCache[index];
            // if (displayObj == null) {
            //   break;
            // }
            // this.tintObjectWithChildren(displayObj, new Point(x, y), true);
            // this.entityLayer.addChild(displayObj);
            break;
          }
          case Layer.UI: {
            // displayObj = this.spriteCache[index];
            // if (displayObj == null) {
            //   break;
            // }
            // this.uiLayer.addChild(displayObj);
            break;
          }
        }
      }
    }
  }

  // renderLayers(
  //   layers: Layer[],
  //   width: number,
  //   height: number,
  //   viewportCenterTile: Point
  // ): void {
  //   let centerViewport: Point;
  //   let right: number;
  //   let bottom: number;
  //   let left: number;
  //   let top: number;

  //   for (let layer of layers) {
  //     if (layer === Layer.PLANT || layer === Layer.GROUNDFX) {
  //       const ratio = Tile.size / Tile.plantSize;
  //       centerViewport = Tile.translatePoint(
  //         viewportCenterTile,
  //         Layer.TERRAIN,
  //         Layer.PLANT
  //       );
  //       console.throttle(250).log("centerViewport PLANTS", centerViewport);
  //       const viewportBounds = this.game.userInterface.camera.getViewportBounds(
  //         this.game.userInterface.camera.viewport,
  //         layer
  //       );
  //       if (!viewportBounds) {
  //         console
  //           .throttle(250)
  //           .log("No viewportBounds", this.game.userInterface.camera.viewport);
  //         return;
  //       }
  //       right = viewportBounds.x2;
  //       bottom = viewportBounds.y2;
  //       left = viewportBounds.x1;
  //       top = viewportBounds.y1;
  //       // right = centerViewport.x + Math.ceil((width / 2) * ratio);
  //       // bottom = centerViewport.y + Math.ceil((height / 2) * ratio);
  //       // left = centerViewport.x - Math.floor((width / 2) * ratio);
  //       // top = centerViewport.y - Math.floor((height / 2) * ratio);
  //     } else {
  //       const viewportBounds = this.game.userInterface.camera.getViewportBounds(
  //         this.game.userInterface.camera.viewport,
  //         layer
  //       );
  //       if (!viewportBounds) {
  //         console
  //           .throttle(250)
  //           .log("No viewportBounds", this.game.userInterface.camera.viewport);
  //         return;
  //       }
  //       centerViewport = viewportCenterTile;
  //       right = viewportBounds.x2;
  //       bottom = viewportBounds.y2;
  //       left = viewportBounds.x1;
  //       top = viewportBounds.y1;
  //       // centerViewport = viewportCenterTile;
  //       // right = centerViewport.x + Math.ceil(width / 2);
  //       // bottom = centerViewport.y + Math.ceil(height / 2);
  //       // left = centerViewport.x - Math.floor(width / 2);
  //       // top = centerViewport.y - Math.floor(height / 2);
  //     }
  //     if (layer !== Layer.ENTITY) {
  //       this.clearLayer(layer);
  //     }

  //     for (let x = left; x < right; x++) {
  //       for (let y = top; y < bottom; y++) {
  //         const key = MapWorld.coordsToKey(x, y);
  //         let displayObj: PIXI.DisplayObject;
  //         let index: number = this.game.positionToIndex(x, y, layer);
  //         // if (index < 0) {
  //         //   // console
  //         //   //   .throttle(250)
  //         //   //   .log("Index out of bounds", index, x, y, layer);
  //         //   continue;
  //         //   // return;
  //         // }
  //         // continue;

  //         switch (layer) {
  //           case Layer.TERRAIN: {
  //             displayObj = this.spriteCache[index];
  //             // this.tintObjectWithChildren(displayObj, new Point(x, y));
  //             this.terrainLayer.tile(
  //               (displayObj as PIXI.Sprite).texture,
  //               (x * Tile.size) / 2,
  //               (y * Tile.size) / 2
  //             );
  //             // this.terrainLayer.addChild(displayObj);
  //             break;
  //           }
  //           case Layer.GROUNDFX: {
  //             displayObj = this.spriteCache[index];
  //             if (displayObj == null) {
  //               continue;
  //             }
  //             // this.tintObjectWithChildren(displayObj, new Point(x, y));
  //             this.groundFXLayer.addChild(displayObj);
  //             break;
  //           }
  //           case Layer.PLANT: {
  //             displayObj = this.spriteCache[index];
  //             if (displayObj == null) {
  //               continue;
  //             }
  //             const terrainPoint = Tile.translatePoint(
  //               new Point(x, y),
  //               Layer.PLANT,
  //               Layer.TERRAIN
  //             );
  //             this.tintObjectWithChildren(displayObj, terrainPoint);

  //             // displayObj.zIndex = this.game.options.gameSize.height * ratio - y;
  //             this.plantLayer.addChild(displayObj);
  //             break;
  //           }
  //           case Layer.ENTITY: {
  //             displayObj = this.spriteCache[index];
  //             if (displayObj == null) {
  //               continue;
  //             }
  //             this.tintObjectWithChildren(displayObj, new Point(x, y), true);
  //             this.entityLayer.addChild(displayObj);
  //             break;
  //           }
  //           case Layer.UI: {
  //             displayObj = this.spriteCache[index];
  //             if (displayObj == null) {
  //               continue;
  //             }
  //             this.uiLayer.addChild(displayObj);
  //             break;
  //           }
  //         }
  //       }
  //     }
  //   }
  // }

  // renderLayers(
  //   layers: Layer[],
  //   width: number,
  //   height: number,
  //   viewportCenterTile: Point
  // ): void {
  //   let centerViewport: Point;
  //   let right: number;
  //   let bottom: number;
  //   let left: number;
  //   let top: number;

  //   for (let layer of layers) {
  //     if (layer === Layer.PLANT || layer === Layer.GROUNDFX) {
  //       const ratio = Tile.size / Tile.plantSize;
  //       centerViewport = Tile.translatePoint(
  //         viewportCenterTile,
  //         Layer.TERRAIN,
  //         Layer.PLANT
  //       );
  //       console.throttle(250).log("centerViewport PLANTS", centerViewport);
  //       const viewportBounds = this.game.userInterface.camera.getViewportBounds(
  //         this.game.userInterface.camera.viewport,
  //         layer
  //       );
  //       if (!viewportBounds) {
  //         console
  //           .throttle(250)
  //           .log("No viewportBounds", this.game.userInterface.camera.viewport);
  //         return;
  //       }
  //       right = viewportBounds.x2;
  //       bottom = viewportBounds.y2;
  //       left = viewportBounds.x1;
  //       top = viewportBounds.y1;
  //       // right = centerViewport.x + Math.ceil((width / 2) * ratio);
  //       // bottom = centerViewport.y + Math.ceil((height / 2) * ratio);
  //       // left = centerViewport.x - Math.floor((width / 2) * ratio);
  //       // top = centerViewport.y - Math.floor((height / 2) * ratio);
  //     } else {
  //       const viewportBounds = this.game.userInterface.camera.getViewportBounds(
  //         this.game.userInterface.camera.viewport,
  //         layer
  //       );
  //       if (!viewportBounds) {
  //         console
  //           .throttle(250)
  //           .log("No viewportBounds", this.game.userInterface.camera.viewport);
  //         return;
  //       }
  //       centerViewport = viewportCenterTile;
  //       right = viewportBounds.x2;
  //       bottom = viewportBounds.y2;
  //       left = viewportBounds.x1;
  //       top = viewportBounds.y1;
  //       // centerViewport = viewportCenterTile;
  //       // right = centerViewport.x + Math.ceil(width / 2);
  //       // bottom = centerViewport.y + Math.ceil(height / 2);
  //       // left = centerViewport.x - Math.floor(width / 2);
  //       // top = centerViewport.y - Math.floor(height / 2);
  //     }
  //     if (layer !== Layer.ENTITY) {
  //       this.clearLayer(layer);
  //     }

  //     for (let x = left; x < right; x++) {
  //       for (let y = top; y < bottom; y++) {
  //         const key = MapWorld.coordsToKey(x, y);
  //         let displayObj: PIXI.DisplayObject;
  //         let index: number = this.game.positionToIndex(x, y, layer);
  //         if (index < 0) {
  //           // console
  //           //   .throttle(250)
  //           //   .log("Index out of bounds", index, x, y, layer);
  //           continue;
  //           // return;
  //         }
  //         // continue;

  //         switch (layer) {
  //           case Layer.TERRAIN: {
  //             displayObj = this.spriteCache[index];
  //             // this.tintObjectWithChildren(displayObj, new Point(x, y));
  //             this.terrainLayer.tile(
  //               (displayObj as PIXI.Sprite).texture,
  //               (x * Tile.size) / 2,
  //               (y * Tile.size) / 2
  //             );
  //             // this.terrainLayer.addChild(displayObj);
  //             break;
  //           }
  //           case Layer.GROUNDFX: {
  //             displayObj = this.spriteCache[index];
  //             if (displayObj == null) {
  //               continue;
  //             }
  //             // this.tintObjectWithChildren(displayObj, new Point(x, y));
  //             this.groundFXLayer.addChild(displayObj);
  //             break;
  //           }
  //           case Layer.PLANT: {
  //             displayObj = this.spriteCache[index];
  //             if (displayObj == null) {
  //               continue;
  //             }
  //             const terrainPoint = Tile.translatePoint(
  //               new Point(x, y),
  //               Layer.PLANT,
  //               Layer.TERRAIN
  //             );
  //             this.tintObjectWithChildren(displayObj, terrainPoint);

  //             // displayObj.zIndex = this.game.options.gameSize.height * ratio - y;
  //             this.plantLayer.addChild(displayObj);
  //             break;
  //           }
  //           case Layer.ENTITY: {
  //             displayObj = this.spriteCache[index];
  //             if (displayObj == null) {
  //               continue;
  //             }
  //             this.tintObjectWithChildren(displayObj, new Point(x, y), true);
  //             this.entityLayer.addChild(displayObj);
  //             break;
  //           }
  //           case Layer.UI: {
  //             displayObj = this.spriteCache[index];
  //             if (displayObj == null) {
  //               continue;
  //             }
  //             this.uiLayer.addChild(displayObj);
  //             break;
  //           }
  //         }
  //       }
  //     }
  //   }
  // }

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
        // if (isSprite) {
        //   (displayObj as PIXI.Sprite).anchor.set(0.5);

        //   displayObj.scale.set(2);
        // }
        // displayObj.position.x = position.x * Tile.size;
        // displayObj.position.y = position.y * Tile.size;
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
    // this.displayObjCache[layer][`${position.x},${position.y}`] = displayObj;
    // Calculate the index
    let index = this.game.positionToIndex(position.x, position.y, layer);
    this.spriteCache[index] = displayObj;
    console.throttle(750).log("sprite cache", this.spriteCache.length);
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
    // check if tint valid
    let tintValid = tint.length === 7 && tint[0] === "#";
    if (!tintValid) {
      console.log("Invalid tint", tint, position);
      return;
    }
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
    const newIndex = this.game.positionToIndex(newPos.x, newPos.y, layer);
    const oldIndex = this.game.positionToIndex(oldPos.x, oldPos.y, layer);
    this.spriteCache[newIndex] = this.spriteCache[oldIndex];
    this.spriteCache[oldIndex] = null;
    // this.displayObjCache[layer][newKey] = this.displayObjCache[layer][oldKey];
    // this.displayObjCache[layer][oldKey] = null;
  }

  // remove the sprite from the cache and from the scene, immediately
  removeFromScene(
    position: Point,
    displayObj: PIXI.DisplayObject | string,
    layer: Layer
  ): void {
    let cachedObj: PIXI.DisplayObject;
    const index = this.game.positionToIndex(position.x, position.y, layer);
    if (typeof displayObj === "string") {
      // cachedObj = this.displayObjCache[layer][displayObj];
      cachedObj = this.spriteCache[index];
    } else {
      cachedObj = displayObj;
    }
    // remove from spriteByPos
    this.spriteCache[index] = undefined;
    // this.displayObjCache[layer][`${position.x},${position.y}`] = undefined;
    switch (layer) {
      case Layer.TERRAIN: {
        // this.terrainLayer.removeChild(cachedObj);
        // TODO: how to handle removing terrain immediately? fill with white?
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
      // this.displayObjCache[layer] = {};
    } else {
      this.spriteCache = [];
      // this.displayObjCache = {
      //   [Layer.TERRAIN]: {},
      //   [Layer.GROUNDFX]: {},
      //   [Layer.PLANT]: {},
      //   [Layer.ENTITY]: {},
      //   [Layer.UI]: {},
      // };
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
        // this.terrainLayer.removeChildren();
        this.terrainLayer.clear();
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
    // const sprite = this.displayObjCache[layer][tileKey];
    const tilePos = MapWorld.keyToPoint(tileKey);
    const sprite =
      this.spriteCache[this.game.positionToIndex(tilePos.x, tilePos.y, layer)];
    if (sprite) {
      sprite.transform.position.x = x;
      sprite.transform.position.y = y;
    }
  }

  getSpriteTransformPosition(tilePos: Point, layer: Layer): [number, number] {
    // const sprite =
    //   this.displayObjCache[layer][MapWorld.coordsToKey(tilePos.x, tilePos.y)];
    const sprite =
      this.spriteCache[this.game.positionToIndex(tilePos.x, tilePos.y, layer)];
    if (sprite) {
      return [sprite.x, sprite.y];
    }
    return null;
  }

  getFromCache(tilePos: Point, layer: Layer): PIXI.DisplayObject {
    // return this.displayObjCache[layer][
    //   MapWorld.coordsToKey(tilePos.x, tilePos.y)
    // ];
    return this.spriteCache[
      this.game.positionToIndex(tilePos.x, tilePos.y, layer)
    ];
  }
}
