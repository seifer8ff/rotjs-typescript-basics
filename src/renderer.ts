import * as PIXI from "pixi.js";
import { Game } from "./game";

export enum Layer {
  TERRAIN,
  PLANT,
  ENTITY,
}

export class Renderer {
  public terrainLayer = new PIXI.Container();
  public plantLayer = new PIXI.Container();
  public entityLayer = new PIXI.Container();

  constructor(private game: Game) {
    PIXI.settings.ROUND_PIXELS = true;
    PIXI.settings.RENDER_OPTIONS.antialias = false;
    this.terrainLayer.zIndex = 5;
    this.plantLayer.zIndex = 10;
    this.entityLayer.zIndex = 15;
  }

  addToScene(sprite: PIXI.Sprite, layer: Layer): void {
    switch (layer) {
      case Layer.TERRAIN: {
        this.terrainLayer.addChild(sprite);
        break;
      }
      case Layer.PLANT: {
        this.plantLayer.addChild(sprite);
      }
      case Layer.ENTITY: {
        this.entityLayer.addChild(sprite);
      }
    }
  }
  removeFromScene(sprite: PIXI.Sprite, layer: Layer): void {
    switch (layer) {
      case Layer.TERRAIN: {
        this.terrainLayer.removeChild(sprite);
        break;
      }
      case Layer.PLANT: {
        this.plantLayer.removeChild(sprite);
        break;
      }
      case Layer.ENTITY: {
        this.entityLayer.removeChild(sprite);
      }
    }
  }
  clearScene(): void {
    this.terrainLayer.removeChildren();
    this.entityLayer.removeChildren();
    this.plantLayer.removeChildren();
  }
}
