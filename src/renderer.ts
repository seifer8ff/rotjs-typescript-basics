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
    const lightMap = this.game.map.lightManager.lightMap;
    const sunMap = this.game.map.shadowMap.shadowMap;
    const occlusionMap = this.game.map.shadowMap.occlusionMap;
    const cloudMap = this.game.map.cloudMap.cloudMap;
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
      // if (layer === Layer.PLANT) {
      //   const ratio = Tile.size / Tile.plantSize;
      //   centerViewport = new Point(
      //     centerViewport.x / ratio,
      //     centerViewport.y / ratio
      //   );
      //   centeredWidth = centerViewport.x + Math.floor(width / ratio) / 2;
      //   centeredHeight = centerViewport.y + Math.floor(height / ratio) / 2;
      //   left = centerViewport.x - Math.ceil(width / ratio) / 2;
      //   top = centerViewport.y - Math.ceil(height / ratio) / 2;
      // } else {
      //   centerViewport = viewportCenterTile;
      //   centeredWidth = centerViewport.x + Math.floor(width / 2);
      //   centeredHeight = centerViewport.y + Math.floor(height / 2);
      //   left = centerViewport.x - Math.ceil(width / 2);
      //   top = centerViewport.y - Math.ceil(height / 2);
      // }

      // this.game.scheduler.postTask(
      //   () => {
      //     this.clearLayer(layer);
      //     for (let x = left; x < right; x++) {
      //       for (let y = top; y < bottom; y++) {
      //         const key = MapWorld.coordsToKey(x, y);
      //         let sprite = this.spriteCache[layer][key];

      //         if (!sprite) {
      //           continue;
      //         }

      //         switch (layer) {
      //           case Layer.TERRAIN: {
      //             sprite.tint = Color.toHex(
      //               this.game.map.lightManager.getLightColorFor(
      //                 x,
      //                 y,
      //                 lightMap,
      //                 sunMap,
      //                 occlusionMap,
      //                 cloudMap
      //               )
      //             );
      //             this.terrainLayer.addChild(sprite);
      //             break;
      //           }
      //           case Layer.PLANT: {
      //             const ratio = Tile.size / Tile.plantSize;
      //             sprite.tint = Color.toHex(
      //               this.game.map.lightManager.getLightColorFor(
      //                 Math.floor(x / ratio), // get the light color of the larger tile
      //                 Math.floor(y / ratio),
      //                 lightMap,
      //                 sunMap,
      //                 occlusionMap,
      //                 cloudMap
      //               )
      //             );
      //             this.plantLayer.addChild(sprite);
      //             break;
      //           }
      //           case Layer.ENTITY: {
      //             if (sprite instanceof PIXI.AnimatedSprite) {
      //               sprite.animationSpeed =
      //                 this.game.options.animationSpeed *
      //                 this.game.timeManager.timeScale;
      //             }
      //             sprite.tint = Color.toHex(
      //               this.game.map.lightManager.getLightColorFor(
      //                 x,
      //                 y,
      //                 lightMap,
      //                 sunMap,
      //                 occlusionMap,
      //                 cloudMap,
      //                 true
      //               )
      //             );
      //             this.entityLayer.addChild(sprite);
      //             break;
      //           }
      //           case Layer.UI: {
      //             this.uiLayer.addChild(sprite);
      //             break;
      //           }
      //         }
      //       }
      //     }
      //   },
      //   {
      //     priority: "user-visible",
      //   }
      // );

      this.clearLayer(layer);

      // if (layer === Layer.PLANT) {
      //   // let sprite = this.spriteCache[layer][`0,0`];
      //   let sprite = PIXI.Sprite.from(Tile.shrub.spritePath);

      //   // const ratio = Tile.size / Tile.plantSize;
      //   // const width = this.game.userInterface.camera.viewportUnpadded.width;

      //   // right = centerViewport.x + (width / 2) * ratio;
      //   // bottom = centerViewport.y + (height / 2) * ratio;
      //   // left = centerViewport.x - (width / 2) * ratio;
      //   // top = centerViewport.y - (height / 2) * ratio;

      //   sprite.position.x = centerViewport.x * Tile.plantSize;
      //   sprite.position.y = centerViewport.y * Tile.plantSize;

      //   // if (sprite) {
      //   this.plantLayer.addChild(sprite);
      //   // }

      //   return;
      // }

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
              if (displayObj instanceof PIXI.AnimatedSprite) {
                displayObj.animationSpeed =
                  this.game.options.animationSpeed *
                  this.game.timeManager.timeScale;
                // if (!sprite.playing) {
                //   sprite.play();
                // }
              }
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

      // // now draw the effects
      // if (layer === Layer.GROUNDFX) {
      //   // get all graphics from cache and draw them
      //   for (let x = left; x < right; x++) {
      //     for (let y = top; y < bottom; y++) {
      //       const key = MapWorld.coordsToKey(x, y);
      //       let sprite = this.spriteCache[layer][key];

      //       if (!sprite) {
      //         continue;
      //       }

      //       this.groundFXLayer.addChild(sprite);
      //     }
      //   }
      // }
    }
  }

  // render specified layers from the sprite cache to the screen
  // renderLayers(
  //   layers: Layer[],
  //   width: number,
  //   height: number,
  //   viewportCenterTile: Point
  // ): void {

  //   this.clearLayers(layers);
  //   const lightMap = this.game.map.lightManager.lightMap;
  //   const sunMap = this.game.map.shadowMap.shadowMap;
  //   const occlusionMap = this.game.map.shadowMap.occlusionMap;
  //   const cloudMap = this.game.map.cloudMap.cloudMap;
  //   let centerViewport: Point;
  //   let centeredWidth: number;
  //   let centeredHeight: number;
  //   let left: number;
  //   let top: number;

  //   for (let layer of layers) {
  //     if (layer === Layer.PLANT) {
  //       centerViewport = new Point(centerViewport.x * 2, centerViewport.y * 2);
  //       centeredWidth = centerViewport.x + width;
  //       centeredHeight = centerViewport.y + height;
  //       left = centerViewport.x - width;
  //       top = centerViewport.y - height;
  //     } else {
  //       centerViewport = viewportCenterTile;
  //       centeredWidth = centerViewport.x + Math.floor(width / 2);
  //       centeredHeight = centerViewport.y + Math.floor(height / 2);
  //       left = centerViewport.x - Math.ceil(width / 2);
  //       top = centerViewport.y - Math.ceil(height / 2);
  //     }
  //     for (let x = left; x < centeredWidth; x++) {
  //       for (let y = top; y < centeredHeight; y++) {
  //         // if (
  //         //   x < 0 ||
  //         //   y < 0 ||
  //         //   x >= this.game.options.gameSize.width ||
  //         //   y >= this.game.options.gameSize.height
  //         // ) {
  //         //   continue;
  //         // }
  //         const key = MapWorld.coordsToKey(x, y);
  //         let sprite = this.spriteCache[layer][key];

  //         if (!sprite) {
  //           continue;
  //         }

  //         switch (layer) {
  //           case Layer.TERRAIN: {
  //             sprite.tint = Color.toHex(
  //               this.game.map.lightManager.getLightColorFor(
  //                 x,
  //                 y,
  //                 lightMap,
  //                 sunMap,
  //                 occlusionMap,
  //                 cloudMap
  //               )
  //             );
  //             this.terrainLayer.addChild(sprite);
  //             break;
  //           }
  //           case Layer.PLANT: {
  //             sprite.tint = Color.toHex(
  //               this.game.map.lightManager.getLightColorFor(
  //                 Math.floor(x / 2), // get the light color of the larger tile
  //                 Math.floor(y / 2),
  //                 lightMap,
  //                 sunMap,
  //                 occlusionMap,
  //                 cloudMap
  //               )
  //             );
  //             this.plantLayer.addChild(sprite);
  //             break;
  //           }
  //           case Layer.ENTITY: {
  //             if (sprite instanceof PIXI.AnimatedSprite) {
  //               sprite.animationSpeed =
  //                 this.game.options.animationSpeed *
  //                 this.game.timeManager.timeScale;
  //             }
  //             sprite.tint = Color.toHex(
  //               this.game.map.lightManager.getLightColorFor(
  //                 x,
  //                 y,
  //                 lightMap,
  //                 sunMap,
  //                 occlusionMap,
  //                 cloudMap,
  //                 true
  //               )
  //             );
  //             this.entityLayer.addChild(sprite);
  //             break;
  //           }
  //           case Layer.UI: {
  //             this.uiLayer.addChild(sprite);
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
  //   this.clearLayers(layers);
  //   const lightMap = this.game.map.lightManager.lightMap;
  //   const sunMap = this.game.map.shadowMap.shadowMap;
  //   const occlusionMap = this.game.map.shadowMap.occlusionMap;
  //   const cloudMap = this.game.map.cloudMap.cloudMap;
  //   const centeredWidth = viewportCenterTile.x + Math.ceil(width / 2);
  //   const centeredHeight = viewportCenterTile.y + Math.ceil(height / 2);
  //   const left = viewportCenterTile.x - Math.ceil(width / 2);
  //   const top = viewportCenterTile.y - Math.ceil(height / 2);

  //   for (let x = left; x < centeredWidth; x++) {
  //     for (let y = top; y < centeredHeight; y++) {
  //       for (let layer of layers) {
  //         if (
  //           x < 0 ||
  //           y < 0 ||
  //           x >= this.game.options.gameSize.width ||
  //           y >= this.game.options.gameSize.height
  //         ) {
  //           continue;
  //         }
  //         const key = MapWorld.coordsToKey(x, y);
  //         let sprite = this.spriteCache[layer][key];

  //         if (!sprite) {
  //           continue;
  //         }

  //         switch (layer) {
  //           case Layer.TERRAIN: {
  //             sprite.tint = Color.toHex(
  //               this.game.map.lightManager.getLightColorFor(
  //                 x,
  //                 y,
  //                 lightMap,
  //                 sunMap,
  //                 occlusionMap,
  //                 cloudMap
  //               )
  //             );
  //             this.terrainLayer.addChild(sprite);
  //             break;
  //           }
  //           case Layer.PLANT: {
  //             sprite.tint = Color.toHex(
  //               this.game.map.lightManager.getLightColorFor(
  //                 Math.floor(x / 2),
  //                 Math.floor(y / 2),
  //                 lightMap,
  //                 sunMap,
  //                 occlusionMap,
  //                 cloudMap
  //               )
  //             );
  //             this.plantLayer.addChild(sprite);
  //             break;
  //           }
  //           case Layer.ENTITY: {
  //             if (sprite instanceof PIXI.AnimatedSprite) {
  //               sprite.animationSpeed =
  //                 this.game.options.animationSpeed *
  //                 this.game.timeManager.timeScale;
  //             }
  //             sprite.tint = Color.toHex(
  //               this.game.map.lightManager.getLightColorFor(
  //                 x,
  //                 y,
  //                 lightMap,
  //                 sunMap,
  //                 occlusionMap,
  //                 cloudMap,
  //                 true
  //               )
  //             );
  //             this.entityLayer.addChild(sprite);
  //             break;
  //           }
  //           case Layer.UI: {
  //             this.uiLayer.addChild(sprite);
  //             break;
  //           }
  //         }
  //       }
  //     }
  //   }
  // }

  // // add the sprite to the cache, to be rendered on the next render pass
  // // TODO: don't create the sprite here, just take a sprite or animated sprite and add it to the cache
  // addToScene(
  //   position: Point,
  //   layer: Layer,
  //   spriteUrl: string,
  //   tint?: string,
  //   animated = false
  // ): void {
  //   let pixiSprite: PIXI.Sprite | PIXI.AnimatedSprite;

  //   if (animated) {
  //     const animations = PIXI.Assets.cache.get(spriteUrl).data.frames;
  //     const animKeys = Object.keys(animations).sort();
  //     pixiSprite = PIXI.AnimatedSprite.fromFrames(animKeys);
  //     (pixiSprite as PIXI.AnimatedSprite).animationSpeed =
  //       this.game.options.animationSpeed * this.game.timeManager.timeScale;
  //     (pixiSprite as PIXI.AnimatedSprite).loop = true;
  //     (pixiSprite as PIXI.AnimatedSprite).play();
  //     // console.log("add to scene", pixiSprite);
  //   } else {
  //     pixiSprite = PIXI.Sprite.from(spriteUrl);
  //   }

  //   pixiSprite.anchor.set(0.5);

  //   pixiSprite.position.x = position.x * Tile.size;
  //   pixiSprite.position.y = position.y * Tile.size;
  //   pixiSprite.scale.set(1);
  //   if (layer === Layer.PLANT) {
  //     const ratio = Tile.size / Tile.plantSize;
  //     pixiSprite.position.x = position.x * Tile.plantSize;
  //     pixiSprite.position.y = position.y * Tile.plantSize;
  //   } else if (layer === Layer.TERRAIN) {
  //     pixiSprite.scale.set(2);
  //   } else if (layer === Layer.UI) {
  //     pixiSprite.scale.set(2);
  //   } else if (layer === Layer.ENTITY) {
  //     pixiSprite.scale.set(1);
  //   }

  //   // pixiSprite.position.x = position.x * Tile.size - Tile.size / 2;
  //   // pixiSprite.position.y = position.y * Tile.size - Tile.size / 2;
  //   // pixiSprite.scale.set(1);
  //   // if (layer === Layer.PLANT) {
  //   //   const ratio = Tile.size / Tile.plantSize;
  //   //   pixiSprite.position.x =
  //   //     position.x * Tile.plantSize - Tile.size / 2 - Tile.plantSize / 2;
  //   //   pixiSprite.position.y =
  //   //     position.y * Tile.plantSize - Tile.size / 2 - Tile.plantSize / 2;
  //   // } else if (layer === Layer.TERRAIN) {
  //   //   pixiSprite.scale.set(2);
  //   // } else if (layer === Layer.UI) {
  //   //   pixiSprite.scale.set(2);
  //   // }

  //   if (tint) {
  //     pixiSprite.tint = tint || "0xFFFFFF";
  //   }
  //   // TODO: remove sprite from cache if it already exists
  //   this.spriteCache[layer][`${position.x},${position.y}`] = pixiSprite;
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
    // let pixiSprite: PIXI.Sprite | PIXI.AnimatedSprite;

    // if (animated) {
    //   const animations = PIXI.Assets.cache.get(sprite).data.frames;
    //   const animKeys = Object.keys(animations).sort();
    //   pixiSprite = PIXI.AnimatedSprite.fromFrames(animKeys);
    //   (pixiSprite as PIXI.AnimatedSprite).animationSpeed =
    //     this.game.options.animationSpeed * this.game.timeManager.timeScale;
    //   (pixiSprite as PIXI.AnimatedSprite).loop = true;
    //   (pixiSprite as PIXI.AnimatedSprite).play();
    //   // console.log("add to scene", pixiSprite);
    // } else {
    //   pixiSprite = PIXI.Sprite.from(sprite);
    // }

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
        // this.tintObjectWithChildren(displayObj, terrainPoint, true);
        displayObj.position.x = position.x * Tile.plantSize;
        displayObj.position.y = position.y * Tile.plantSize;
        // displayObj.zIndex =
        //   this.game.options.gameSize.height * ratio - terrainPoint.y;
        displayObj.scale.set(1);
        // console.log("add sprite to plant", sprite, position.x, position.y);
        break;
      }
      case Layer.TERRAIN: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);

          displayObj.scale.set(2);
        }
        // this.tintObjectWithChildren(displayObj, position);
        displayObj.position.x = position.x * Tile.size;
        displayObj.position.y = position.y * Tile.size;
        break;
      }
      case Layer.GROUNDFX: {
        if (isSprite) {
          (displayObj as PIXI.Sprite).anchor.set(0.5);
        }
        // this.tintObjectWithChildren(displayObj, position);
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
          displayObj.scale.set(1);
        }
        // this.tintObjectWithChildren(displayObj, position, true);
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

  // addToScene(
  //   position: Point,
  //   layer: Layer,
  //   sprite: PIXI.Sprite | PIXI.AnimatedSprite | PIXI.Graphics,
  //   tint?: string
  // ): void {
  //   // let pixiSprite: PIXI.Sprite | PIXI.AnimatedSprite;

  //   // if (animated) {
  //   //   const animations = PIXI.Assets.cache.get(sprite).data.frames;
  //   //   const animKeys = Object.keys(animations).sort();
  //   //   pixiSprite = PIXI.AnimatedSprite.fromFrames(animKeys);
  //   //   (pixiSprite as PIXI.AnimatedSprite).animationSpeed =
  //   //     this.game.options.animationSpeed * this.game.timeManager.timeScale;
  //   //   (pixiSprite as PIXI.AnimatedSprite).loop = true;
  //   //   (pixiSprite as PIXI.AnimatedSprite).play();
  //   //   // console.log("add to scene", pixiSprite);
  //   // } else {
  //   //   pixiSprite = PIXI.Sprite.from(sprite);
  //   // }

  //   if (!sprite) {
  //     // throw (new Error("No sprite provided"), position, layer, sprite, tint);
  //     console
  //       .throttle(250)
  //       .log(
  //         "Error: addToScene: no sprite provided",
  //         position,
  //         layer,
  //         sprite,
  //         tint
  //       );
  //   }

  //   // console.log("sprite", sprite);
  //   // if (
  //   //   sprite instanceof PIXI.Sprite ||
  //   //   sprite instanceof PIXI.AnimatedSprite
  //   // ) {
  //   //   sprite.anchor.set(0.5);
  //   //   // sprite.position.x = position.x;
  //   //   // sprite.position.y = position.y;
  //   //   sprite.scale.set(1);
  //   // }

  //   if (layer === Layer.PLANT) {
  //     if (
  //       sprite instanceof PIXI.Sprite ||
  //       sprite instanceof PIXI.AnimatedSprite
  //     ) {
  //       sprite.anchor.set(0.5);
  //       // sprite.position.x = position.x;
  //       // sprite.position.y = position.y;
  //       const ratio = Tile.size / Tile.plantSize;
  //       sprite.position.x = position.x * Tile.plantSize;
  //       sprite.position.y = position.y * Tile.plantSize;
  //       sprite.scale.set(1);
  //     }

  //     // console.log("add sprite to plant", sprite, position.x, position.y);
  //   } else if (layer === Layer.TERRAIN) {
  //     if (
  //       sprite instanceof PIXI.Sprite ||
  //       sprite instanceof PIXI.AnimatedSprite
  //     ) {
  //       sprite.anchor.set(0.5);
  //       sprite.position.x = position.x * Tile.size;
  //       sprite.position.y = position.y * Tile.size;
  //       sprite.scale.set(2);
  //     }
  //   } else if (layer === Layer.GROUNDFX) {
  //     if (
  //       sprite instanceof PIXI.Sprite ||
  //       sprite instanceof PIXI.AnimatedSprite
  //     ) {
  //       sprite.anchor.set(0.5);
  //       // sprite.anchor.set(0.5, 1);
  //       // sprite.position.x = position.x;
  //       // sprite.position.y = position.y;
  //       const ratio = Tile.size / Tile.plantSize;

  //       // sprite.scale.set(1);
  //     }
  //     sprite.position.x = position.x * Tile.plantSize;
  //     sprite.position.y = position.y * Tile.plantSize;
  //     // console.log("sprite children length", sprite.children.length);
  //     // sprite.position.x = position.x * Tile.plantSize;
  //     // sprite.position.y = position.y * Tile.plantSize;
  //     // sprite.scale.set(1);
  //     // console.log("add sprite to groundFX", sprite, position.x, position.y);
  //   } else if (layer === Layer.UI) {
  //     if (
  //       sprite instanceof PIXI.Sprite ||
  //       sprite instanceof PIXI.AnimatedSprite
  //     ) {
  //       sprite.anchor.set(0.5);
  //       sprite.position.x = position.x * Tile.size;
  //       sprite.position.y = position.y * Tile.size;
  //       sprite.scale.set(2);
  //     }
  //   } else if (layer === Layer.ENTITY) {
  //     if (
  //       sprite instanceof PIXI.Sprite ||
  //       sprite instanceof PIXI.AnimatedSprite
  //     ) {
  //       sprite.anchor.set(0.5);
  //       sprite.position.x = position.x * Tile.size;
  //       sprite.position.y = position.y * Tile.size;
  //       sprite.scale.set(1);
  //     }
  //   }

  //   if (tint) {
  //     sprite.tint = tint || "0xFFFFFF";
  //   }

  //   // const oldSprite = this.spriteCache[layer][`${position.x},${position.y}`];
  //   // if (oldSprite && sprite instanceof PIXI.Graphics) {
  //   //   // console.log("do nothing for tree");
  //   // } else {
  //   //   this.spriteCache[layer][`${position.x},${position.y}`] = sprite;
  //   // }
  //   this.spriteCache[layer][`${position.x},${position.y}`] = sprite;
  //   // // TODO: remove sprite from cache if it already exists
  //   // this.spriteCache[layer][`${position.x},${position.y}`] = sprite;
  // }

  // // add the sprite to the cache, to be rendered on the next render pass
  // // TODO: don't create the sprite here, just take a sprite or animated sprite and add it to the cache
  // addToScene(
  //   position: Point,
  //   layer: Layer,
  //   sprite: PIXI.Sprite | PIXI.AnimatedSprite | PIXI.Graphics,
  //   tint?: string
  // ): void {
  //   // let pixiSprite: PIXI.Sprite | PIXI.AnimatedSprite;

  //   // if (animated) {
  //   //   const animations = PIXI.Assets.cache.get(sprite).data.frames;
  //   //   const animKeys = Object.keys(animations).sort();
  //   //   pixiSprite = PIXI.AnimatedSprite.fromFrames(animKeys);
  //   //   (pixiSprite as PIXI.AnimatedSprite).animationSpeed =
  //   //     this.game.options.animationSpeed * this.game.timeManager.timeScale;
  //   //   (pixiSprite as PIXI.AnimatedSprite).loop = true;
  //   //   (pixiSprite as PIXI.AnimatedSprite).play();
  //   //   // console.log("add to scene", pixiSprite);
  //   // } else {
  //   //   pixiSprite = PIXI.Sprite.from(sprite);
  //   // }

  //   if (!sprite) {
  //     // throw (new Error("No sprite provided"), position, layer, sprite, tint);
  //     console.log(
  //       "Error: addToScene: no sprite provided",
  //       position,
  //       layer,
  //       sprite,
  //       tint
  //     );
  //   }

  // if (!(sprite instanceof PIXI.Graphics)) {
  //   // console.log("sprite", sprite);
  //   sprite.anchor.set(0.5);

  //   sprite.position.x = position.x;
  //   sprite.position.y = position.y;
  //   sprite.scale.set(1);
  //   if (layer === Layer.PLANT) {
  //     const ratio = Tile.size / Tile.plantSize;
  //     sprite.position.x = position.x * Tile.plantSize;
  //     sprite.position.y = position.y * Tile.plantSize;
  //     // console.log("add sprite to plant", sprite, position.x, position.y);
  //   } else if (layer === Layer.TERRAIN) {
  //     sprite.position.x = position.x * Tile.size;
  //     sprite.position.y = position.y * Tile.size;
  //     sprite.scale.set(2);
  //   } else if (layer === Layer.GROUNDFX) {
  //     console.log("add sprite to groundFX", sprite, position.x, position.y);
  //   } else if (layer === Layer.UI) {
  //     sprite.position.x = position.x * Tile.size;
  //     sprite.position.y = position.y * Tile.size;
  //     sprite.scale.set(2);
  //   } else if (layer === Layer.ENTITY) {
  //     sprite.position.x = position.x * Tile.size;
  //     sprite.position.y = position.y * Tile.size;
  //     sprite.scale.set(1);
  //   }
  // }

  //   if (tint) {
  //     sprite.tint = tint || "0xFFFFFF";
  //   }

  //   const oldSprite = this.spriteCache[layer][`${position.x},${position.y}`];
  //   if (oldSprite && sprite instanceof PIXI.Graphics) {
  //     // console.log("do nothing for tree");
  //   } else {
  //     this.spriteCache[layer][`${position.x},${position.y}`] = sprite;
  //   }
  //   // // TODO: remove sprite from cache if it already exists
  //   // this.spriteCache[layer][`${position.x},${position.y}`] = sprite;
  // }

  // addToScene(
  //   position: Point,
  //   layer: Layer,
  //   spriteUrl: string,
  //   tint?: string,
  //   animated = false
  // ): void {
  //   let pixiSprite: PIXI.Sprite | PIXI.AnimatedSprite;

  //   if (animated) {
  //     const animations = PIXI.Assets.cache.get(spriteUrl).data.frames;
  //     const animKeys = Object.keys(animations).sort();
  //     pixiSprite = PIXI.AnimatedSprite.fromFrames(animKeys);
  //     (pixiSprite as PIXI.AnimatedSprite).animationSpeed =
  //       this.game.options.animationSpeed * this.game.timeManager.timeScale;
  //     (pixiSprite as PIXI.AnimatedSprite).loop = true;
  //     (pixiSprite as PIXI.AnimatedSprite).play();
  //     console.log("add to scene", pixiSprite);
  //   } else {
  //     pixiSprite = PIXI.Sprite.from(spriteUrl);
  //   }

  //   pixiSprite.anchor.set(0.5);
  //   if (layer === Layer.PLANT) {
  //     pixiSprite.position.x =
  //       position.x * Tile.plantSize - Tile.size / 2 - Tile.plantSize / 2;
  //     pixiSprite.position.y =
  //       position.y * Tile.plantSize - Tile.size / 2 - Tile.plantSize / 2;
  //   } else {
  //     pixiSprite.position.x = position.x * Tile.size - Tile.size / 2;
  //     pixiSprite.position.y = position.y * Tile.size - Tile.size / 2;
  //   }

  //   if (tint) {
  //     pixiSprite.tint = tint || "0xFFFFFF";
  //   }
  //   // TODO: remove sprite from cache if it already exists
  //   this.spriteCache[layer][`${position.x},${position.y}`] = pixiSprite;
  // }

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
        // this.plantLayer.removeChildren();
        // let particleContainers = this.plantLayer.children.filter(
        //   (child) => child instanceof PIXI.ParticleContainer
        // );
        // particleContainers.forEach((child) => {
        //   // (child as PIXI.ParticleContainer).dispose();
        //   (child as PIXI.ParticleContainer).removeChildren();
        //   // child.destroy({ children: true, texture: false, baseTexture: false });
        // });
        // particleContainers = null;
        // this.plantLayer.removeChildren();

        this.plantLayer.removeChildren();
        // .forEach((child) => {
        //   if (child instanceof PIXI.ParticleContainer) {
        //     // (child as PIXI.ParticleContainer).
        //     // (child as PIXI.ParticleContainer).removeChildren();
        //     // (child as PIXI.ParticleContainer).removeChildren();
        //     // child.destroy({ children: true, texture: false, baseTexture: false });
        //   } else {
        //     // child.destroy();
        //   }
        // });

        // const children = this.plantLayer.removeChildren();
        // children.forEach((child) => {
        //   if (child instanceof PIXI.ParticleContainer) {
        //     (child as PIXI.ParticleContainer).dispose();
        //     // child.destroy({ children: true, texture: false, baseTexture: false });
        //   } else {
        //     child.destroy();
        //   }
        // });
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
