import * as PIXI from "pixi.js";
import { Game } from "./game";
import { Point } from "./point";
import { Tile } from "./tile";
import { Color } from "rot-js";
import { Color as ColorType } from "rot-js/lib/color";
import { HeightLayer, MapWorld } from "./map-world";
import { adjustRgbSaturation, rgbToGrayscale } from "./misc-utility";
export enum Layer {
  TERRAIN,
  PLANT,
  ENTITY,
  UI,
}

export class Renderer {
  public terrainLayer = new PIXI.Container();
  public plantLayer = new PIXI.Container();
  public entityLayer = new PIXI.Container();
  public uiLayer = new PIXI.Container();
  private spriteCache: { [layer: string]: { [pos: string]: PIXI.Sprite } };

  constructor(private game: Game) {
    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.RENDER_OPTIONS.antialias = false;
    this.terrainLayer.zIndex = 5;
    this.plantLayer.zIndex = 10;
    this.entityLayer.zIndex = 15;
    this.uiLayer.zIndex = 100;
    this.spriteCache = {
      [Layer.TERRAIN]: {},
      [Layer.PLANT]: {},
      [Layer.ENTITY]: {},
      [Layer.UI]: {},
    };
  }

  // render specified layers from the sprite cache to the screen
  renderLayers(
    layers: Layer[],
    width: number,
    height: number,
    viewportCenterTile: Point
  ): void {
    this.clearLayers(layers);
    const lightMap = this.game.map.lightManager.lightMap;
    const sunMap = this.game.map.shadowMap.shadowMap;
    const occlusionMap = this.game.map.shadowMap.occlusionMap;
    const cloudMap = this.game.map.cloudMap.cloudMap;
    const centeredWidth = viewportCenterTile.x + Math.ceil(width / 2);
    const centeredHeight = viewportCenterTile.y + Math.ceil(height / 2);
    const left = viewportCenterTile.x - Math.ceil(width / 2);
    const top = viewportCenterTile.y - Math.ceil(height / 2);

    for (let x = left; x < centeredWidth; x++) {
      for (let y = top; y < centeredHeight; y++) {
        for (let layer of layers) {
          if (
            x < 0 ||
            y < 0 ||
            x >= this.game.options.gameSize.width ||
            y >= this.game.options.gameSize.height
          ) {
            continue;
          }
          const key = MapWorld.coordsToKey(x, y);
          let sprite = this.spriteCache[layer][key];

          if (!sprite) {
            continue;
          }

          switch (layer) {
            case Layer.TERRAIN: {
              sprite.tint = Color.toHex(
                this.game.map.lightManager.getLightColorFor(
                  x,
                  y,
                  lightMap,
                  sunMap,
                  occlusionMap,
                  cloudMap
                )
              );
              this.terrainLayer.addChild(sprite);
              break;
            }
            case Layer.PLANT: {
              sprite.tint = Color.toHex(
                this.game.map.lightManager.getLightColorFor(
                  x,
                  y,
                  lightMap,
                  sunMap,
                  occlusionMap,
                  cloudMap
                )
              );
              this.plantLayer.addChild(sprite);
              break;
            }
            case Layer.ENTITY: {
              sprite.tint = Color.toHex(
                this.game.map.lightManager.getLightColorFor(
                  x,
                  y,
                  lightMap,
                  sunMap,
                  occlusionMap,
                  cloudMap,
                  true
                )
              );
              this.entityLayer.addChild(sprite);
              break;
            }
            case Layer.UI: {
              this.uiLayer.addChild(sprite);
              break;
            }
          }
        }
      }
    }
  }

  // add the sprite to the cache, to be rendered on the next render pass
  addToScene(
    position: Point,
    layer: Layer,
    spriteUrl: string,
    tint?: string
  ): void {
    let pixiSprite = PIXI.Sprite.from(spriteUrl);
    pixiSprite.anchor.set(0.5);
    pixiSprite.position.x = position.x * Tile.size;
    pixiSprite.position.y = position.y * Tile.size;
    if (tint) {
      pixiSprite.tint = tint || "0xFFFFFF";
    }
    // TODO: remove sprite from cache if it already exists
    this.spriteCache[layer][`${position.x},${position.y}`] = pixiSprite;
  }

  // update a sprites position in the cache, to be rendered on the next render pass
  updateSpritePosition(oldPos: Point, newPos: Point, layer: Layer): void {
    this.spriteCache[layer][`${newPos.x},${newPos.y}`] =
      this.spriteCache[layer][`${oldPos.x},${oldPos.y}`];
    this.spriteCache[layer][`${oldPos.x},${oldPos.y}`] = null;
  }

  // remove the sprite from the cache and from the scene, immediately
  removeFromScene(
    position: Point,
    sprite: PIXI.Sprite | string,
    layer: Layer
  ): void {
    let spriteObj: PIXI.Sprite;
    if (typeof sprite === "string") {
      spriteObj = this.spriteCache[layer][sprite];
    } else {
      spriteObj = sprite;
    }
    // remove from spriteByPos
    this.spriteCache[layer][`${position.x},${position.y}`] = undefined;
    switch (layer) {
      case Layer.TERRAIN: {
        this.terrainLayer.removeChild(spriteObj);
        break;
      }
      case Layer.PLANT: {
        this.plantLayer.removeChild(spriteObj);
        break;
      }
      case Layer.ENTITY: {
        this.entityLayer.removeChild(spriteObj);
      }
      case Layer.UI: {
        this.uiLayer.removeChild(spriteObj);
      }
    }
  }

  clearCache(layer?: Layer): void {
    if (layer) {
      this.spriteCache[layer] = {};
    } else {
      this.spriteCache = {
        [Layer.TERRAIN]: {},
        [Layer.PLANT]: {},
        [Layer.ENTITY]: {},
        [Layer.UI]: {},
      };
    }
  }

  clearScene(clearCache = false): void {
    this.clearLayer(Layer.TERRAIN, clearCache);
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
      this.spriteCache[layer] = {};
    }
    switch (layer) {
      case Layer.TERRAIN: {
        this.terrainLayer.removeChildren();
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
  moveSpriteTransform(
    tileKey: string,
    layer: Layer,
    x: number,
    y: number
  ): void {
    const sprite = this.spriteCache[layer][tileKey];
    if (sprite) {
      sprite.transform.position.x = x;
      sprite.transform.position.y = y;
    }
  }

  getSpriteTransformPosition(tilePos: Point, layer: Layer): [number, number] {
    const sprite =
      this.spriteCache[layer][MapWorld.coordsToKey(tilePos.x, tilePos.y)];
    if (sprite) {
      return [sprite.transform.position.x, sprite.transform.position.y];
    }
    return null;
  }
}
