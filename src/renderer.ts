import * as PIXI from "pixi.js";
import { Game } from "./game";
import { Point } from "./point";
import { Tile } from "./tile";
import { Color } from "rot-js";
import { Color as ColorType } from "rot-js/lib/color";

export enum Layer {
  TERRAIN,
  PLANT,
  ENTITY,
}

export class Renderer {
  public terrainLayer = new PIXI.Container();
  public plantLayer = new PIXI.Container();
  public entityLayer = new PIXI.Container();
  private spriteCache: { [layer: string]: { [pos: string]: PIXI.Sprite } };

  constructor(private game: Game) {
    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.RENDER_OPTIONS.antialias = false;
    this.terrainLayer.zIndex = 5;
    this.plantLayer.zIndex = 10;
    this.entityLayer.zIndex = 15;
    this.spriteCache = {
      [Layer.TERRAIN]: {},
      [Layer.PLANT]: {},
      [Layer.ENTITY]: {},
    };
  }

  renderLayers(
    layers: Layer[],
    width: number,
    height: number,
    viewportCenterTile: Point
  ): void {
    this.clearScene();
    const terrainMap = this.game.map.terrainTileMap;
    const lightMap = this.game.map.lightManager.lightMap;
    const centeredWidth = viewportCenterTile.x + Math.ceil(width / 2);
    const centeredHeight = viewportCenterTile.y + Math.ceil(height / 2);
    const left = viewportCenterTile.x - Math.ceil(width / 2);
    const top = viewportCenterTile.y - Math.ceil(height / 2);
    let ambientLight = this.game.map.lightManager.ambientLight;
    let shadowLight = this.game.map.lightManager.shadowLight;

    for (let x = left; x < centeredWidth; x++) {
      for (let y = top; y < centeredHeight; y++) {
        for (let layer of layers) {
          if (
            x < 0 ||
            y < 0 ||
            x >= this.game.mapSize.width ||
            y >= this.game.mapSize.height
          ) {
            continue;
          }
          const key = `${x},${y}`;
          let sprite = this.spriteCache[layer][key];

          const baseColor =
            terrainMap[key] != Tile.water ? ambientLight : shadowLight;
          let light = ambientLight;

          if (key in lightMap && lightMap[key] != null) {
            // console.log("lightmap key", key, lightMap[key]);
            /* add light from our computation */
            light = Color.add(light, Color.fromString(lightMap[key]));
          }

          const finalColor = Color.multiply(baseColor, light);
          // highlight the entity a little bit
          const finalEntityColor = Color.interpolate(
            finalColor,
            this.game.map.lightManager.lightDefaults.sunlight,
            0.4
          );
          const finalColorHex = Color.toHex(finalColor);
          const finalEntityColorHex = Color.toHex(finalEntityColor);

          if (!sprite) {
            continue;
          }

          switch (layer) {
            case Layer.TERRAIN: {
              sprite.tint = finalColorHex;
              this.terrainLayer.addChild(sprite);
              break;
            }
            case Layer.PLANT: {
              sprite.tint = finalColorHex;
              this.plantLayer.addChild(sprite);
              break;
            }
            case Layer.ENTITY: {
              sprite.tint = finalEntityColorHex;
              this.entityLayer.addChild(sprite);
              break;
            }
          }
        }
      }
    }
  }

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
    this.spriteCache[layer][`${position.x},${position.y}`] = pixiSprite;
  }

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
      };
    }
  }

  clearScene(clearCache = false): void {
    this.clearLayer(Layer.TERRAIN, clearCache);
    this.clearLayer(Layer.PLANT, clearCache);
    this.clearLayer(Layer.ENTITY, clearCache);
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
    }
  }
}
