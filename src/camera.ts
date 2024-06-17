import { Game } from "./game";
import { Point } from "./point";
import * as PIXI from "pixi.js";
import { Tile } from "./tile";
import { UserInterface } from "./user-interface";
import { KEYS, DIRS, Util } from "rot-js";
import { InputUtility } from "./input-utility";
import TinyGesture from "tinygesture";
import { Actor, isActor } from "./entities/actor";
import { Layer } from "./renderer";
import { lerp } from "./misc-utility";
import { HeightLayer, MapWorld } from "./map-world";
import { TileStats } from "./web-components/tile-info";

export interface Viewport {
  width: number;
  height: number;
  center: Point;
}

export interface ViewportBounds {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface PointerTarget {
  position: Point;
  target: Tile | Actor;
  info?: TileStats;
}

export class Camera {
  public viewport: Viewport;
  public viewportUnpadded: Viewport;
  public viewportTiles: string[];
  public viewportTilesUnpadded: string[];
  public viewportTarget: Point | Actor;
  public pointerTarget: PointerTarget;
  private currentZoom: number;
  private defaultZoom: number;
  private minZoom: number;
  private maxZoom: number;
  private moveSpeed: number;
  private showSidebarDelayMs: number; // this shouldn't be in this class
  private maxMomentumTimeMs: number; // maximum amount of time momemtum can last
  private keyMap: { [key: number]: number };
  private momentum: {
    x: number;
    y: number;
    handlerRef: number;
    decay: number;
    durationMs: number;
  };
  private lastZoom: number;
  private lastPivot: Point;

  private momentumTimer: number; // how many ms until momentum finishes
  private showSidebarTimer: number; // how many ms until sidebar is unhidden

  constructor(private game: Game, private ui: UserInterface) {
    this.defaultZoom = 1.4;
    this.currentZoom = this.defaultZoom;
    this.minZoom = 0.2;
    this.maxZoom = 7;
    this.moveSpeed = 0.3;
    this.showSidebarDelayMs = 500;
    this.maxMomentumTimeMs = 1000;
    this.momentumTimer = 0;
    this.showSidebarTimer = 0;
    this.keyMap = {};
    this.keyMap[KEYS.VK_W] = 0; // up
    this.keyMap[KEYS.VK_D] = 2; // right
    this.keyMap[KEYS.VK_S] = 4; // down
    this.keyMap[KEYS.VK_A] = 6; // left
    this.lastPivot = new Point(0, 0);
    this.lastZoom = this.currentZoom;
    this.viewportTiles = [];
    this.viewportTilesUnpadded = [];

    this.momentum = {
      x: 0,
      y: 0,
      handlerRef: null,
      decay: 0.8,
      durationMs: 750,
    };

    this.centerViewport(
      this.ui.gameDisplay.stage,
      this.ui.gameCanvasContainer.clientWidth,
      this.ui.gameCanvasContainer.clientHeight
    );
    this.initEventListeners();
  }

  public centerViewport(
    stage: PIXI.Container,
    screenWidth: number,
    screenHeight: number
  ): void {
    const gameWidthPixels = this.game.options.gameSize.width * Tile.size;
    const gameHeightPixels = this.game.options.gameSize.height * Tile.size;
    const screenCenterX = screenWidth / 2;
    const screenCenterY = screenHeight / 2;
    const pivotX = gameWidthPixels / 2;
    const pivotY = gameHeightPixels / 2;

    stage.setTransform(
      screenCenterX,
      screenCenterY,
      this.defaultZoom,
      this.defaultZoom,
      0,
      0,
      0,
      pivotX,
      pivotY
    );
  }

  public inViewport(x: number, y: number): boolean {
    // console.log("inViewport", x, this.viewport.center.x, this.viewport.width);
    return (
      x >= 0 &&
      y >= 0 &&
      x > this.viewportUnpadded.center.x - this.viewportUnpadded.width / 2 &&
      x < this.viewportUnpadded.center.x + this.viewportUnpadded.width / 2 &&
      y > this.viewportUnpadded.center.y - this.viewportUnpadded.height / 2 &&
      y < this.viewportUnpadded.center.y + this.viewportUnpadded.height / 2
    );
  }

  centerOn(x: number, y: number) {
    this.viewportTarget = this.TileToScreenCoords(x, y);
  }

  public followActor(actor: Actor) {
    this.viewportTarget = actor;
  }

  public refreshPointerTargetInfo() {
    if (this.pointerTarget) {
      if (!isActor(this.pointerTarget.target)) {
        this.pointerTarget.info = this.game.getTileInfoAt(
          this.pointerTarget.position.x,
          this.pointerTarget.position.y
        );
      }
    }
  }

  public setPointerTarget(
    pos: Point,
    target: Tile | Actor,
    viewportTarget = false
  ) {
    if (isActor(target)) {
      this.pointerTarget = {
        position: target.position,
        target: target,
      };
      this.ui.components.sideMenu.setEntityTarget(target);
      if (viewportTarget) {
        this.viewportTarget = target;
      }
    } else {
      this.pointerTarget = {
        position: pos,
        target: target,
        info: this.game.getTileInfoAt(pos.x, pos.y),
      };
      this.ui.components.sideMenu.setEntityTarget(null);
      if (viewportTarget) {
        this.viewportTarget = pos;
      }
    }
    this.ui.components.tileInfo.setContent(this.pointerTarget);
  }

  public clearPointerTarget() {
    this.pointerTarget = null;
    this.ui.components.sideMenu.setEntityTarget(null);
  }

  public selectTileAt(
    x: number,
    y: number,
    viewportTarget = false
  ): PointerTarget {
    // check if entity at tile position
    // check if plant at tile pos
    // if so, select it
    let tile: Tile;
    let actor: Actor;

    actor = this.game.getEntityAt(x, y);
    if (!actor) {
      actor = this.game.getPlantAt(x, y);
    }
    if (actor) {
      this.setPointerTarget(actor.position, actor, viewportTarget);
      return this.pointerTarget;
    }

    // otherwise, select terrain tile at point
    tile = this.game.getTerrainTileAt(x, y);
    this.setPointerTarget(new Point(x, y), tile, viewportTarget);

    return this.pointerTarget;
  }

  public TileToScreenCoords(
    x: number,
    y: number,
    layer: Layer = Layer.TERRAIN
  ): Point {
    let scaleRatio = 1;
    // if (layer === Layer.ENTITY) {
    //   scale = Tile.size / 2;
    // }
    if (layer === Layer.PLANT) {
      scaleRatio = Tile.size / Tile.plantSize;
    }
    return new Point(x * Tile.size * scaleRatio, y * Tile.size * scaleRatio);
  }

  public setViewportZoom(stage: PIXI.Container, newZoom: number) {
    this.currentZoom = newZoom;
    stage.scale.set(newZoom);
  }

  private initEventListeners() {
    window.onresize = () =>
      this.centerViewport(
        this.ui.gameDisplay.stage,
        this.ui.gameCanvasContainer.clientWidth,
        this.ui.gameCanvasContainer.clientHeight
      );

    const gesture = new TinyGesture(this.ui.gameCanvasContainer);

    gesture.on("pinch", (event) => {
      event.preventDefault();
      this.handlePinchZoom(gesture);
    });
    gesture.on("panstart", (event) => {
      this.handlePanStart(gesture);
    });
    gesture.on("panmove", (event) => {
      this.handlePointerDrag(gesture);
    });
    gesture.on("panend", (event) => {
      this.handlePanEnd(gesture);
    });
    gesture.on("tap", (event) => {
      this.handleClick(gesture, event);
    });
    gesture.on("doubletap", (event) => {
      // The gesture was a double tap. The 'tap' event will also have been fired on
      // the first tap.

      this.handleDoubleTap(gesture);
    });

    this.ui.gameCanvasContainer.addEventListener(
      "wheel",
      this.handleMouseZoom,
      {
        passive: false,
      }
    );
    window.addEventListener("keydown", this.handleInput.bind(this), {
      passive: false,
    });
  }

  public Act(): Promise<any> {
    return InputUtility.waitForInput(this.handleInput.bind(this));
  }

  public moveCamera(stage: PIXI.Container, direction: number[]): boolean {
    stage.pivot.x +=
      (direction[0] * Tile.size * this.moveSpeed) / this.currentZoom;
    stage.pivot.y +=
      (direction[1] * Tile.size * this.moveSpeed) / this.currentZoom;
    stage.pivot.x = Math.ceil(stage.pivot.x / Tile.size) * Tile.size;
    stage.pivot.y = Math.ceil(stage.pivot.y / Tile.size) * Tile.size;
    return true;
  }

  private getViewportTiles(
    pad: boolean = false,
    layer: Layer = Layer.TERRAIN
  ): string[] {
    const { width, height, center } = pad
      ? this.viewportUnpadded
      : this.viewport;
    const tiles = [];
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    for (let x = center.x - halfWidth; x < center.x + halfWidth; x++) {
      for (let y = center.y - halfHeight; y < center.y + halfHeight; y++) {
        tiles.push(`${x},${y}`);
      }
    }
    return tiles;
  }

  public getViewport(): {
    unpadded: Viewport;
    padded: Viewport;
  } {
    const normalizedZoom = this.getNormalizedZoom();
    let unpaddedWidthInTiles =
      this.ui.gameCanvasContainer.clientWidth /
      (Tile.size * this.ui.gameDisplay.stage.scale.x);
    let unpaddedHeightInTiles =
      this.ui.gameCanvasContainer.clientHeight /
      (Tile.size * this.ui.gameDisplay.stage.scale.x);
    let paddedWidthInTiles = unpaddedWidthInTiles;
    let paddedHeightInTiles = unpaddedHeightInTiles;
    paddedWidthInTiles += Math.max(10, 0.1 * paddedWidthInTiles);
    paddedHeightInTiles += Math.max(10, 0.1 * paddedHeightInTiles);

    if (normalizedZoom < 0.12) {
      // reduce viewport size at low zoom levels
      // hidden by weather overlays
      unpaddedWidthInTiles = unpaddedWidthInTiles * 0.95;
      unpaddedHeightInTiles = unpaddedHeightInTiles * 0.95;
    }

    if (normalizedZoom < 0.1) {
      // reduce viewport size at low zoom levels
      // hidden by weather overlays
      unpaddedWidthInTiles = unpaddedWidthInTiles * 0.9;
      unpaddedHeightInTiles = unpaddedHeightInTiles * 0.9;
    }
    const center = this.getViewportCenterTile();
    unpaddedWidthInTiles = Math.ceil(unpaddedWidthInTiles);
    unpaddedHeightInTiles = Math.ceil(unpaddedHeightInTiles);
    paddedWidthInTiles = Math.ceil(paddedWidthInTiles);
    paddedHeightInTiles = Math.ceil(paddedHeightInTiles);
    return {
      unpadded: {
        width: unpaddedWidthInTiles,
        height: unpaddedHeightInTiles,
        center,
      },
      padded: {
        width: paddedWidthInTiles,
        height: paddedHeightInTiles,
        center,
      },
    };
  }

  // return the x1, x2, y1, y2 of the viewport
  // allowed to go out of 'bounds' of stage
  public getViewportBounds(viewport: Viewport, layer: Layer): ViewportBounds {
    if (!viewport) {
      return;
    }
    let x1, x2, y1, y2;
    if (layer === Layer.PLANT || layer === Layer.GROUNDFX) {
      // const translatedCenterPoint = Tile.translatePoint(
      //   viewport.center,
      //   Layer.TERRAIN,
      //   layer
      // );
      x1;
      viewport.center.x * Tile.plantSize -
        (viewport.width * Tile.plantSize) / 2;
      x2 =
        viewport.center.x * Tile.plantSize +
        (viewport.width * Tile.plantSize) / 2;
      y1 =
        viewport.center.y * Tile.plantSize -
        (viewport.height * Tile.plantSize) / 2;
      y2 =
        viewport.center.y * Tile.plantSize +
        (viewport.height * Tile.plantSize) / 2;
    } else {
      x1 = viewport.center.x - viewport.width / 2;
      x2 = viewport.center.x + viewport.width / 2;
      y1 = Math.max(0, viewport.center.y - viewport.height / 2);
      y2 = viewport.center.y + viewport.height / 2;
    }
    x1 = Math.floor(x1);
    x2 = Math.ceil(x2);
    y1 = Math.floor(y1);
    y2 = Math.ceil(y2);
    // console.throttle(50).log("returning viewport bounds", x1, x2);

    return { x1, x2, y1, y2 };
  }
  // public getViewportBounds(viewport: Viewport, layer: Layer): ViewportBounds {
  //   if (!viewport) {
  //     return;
  //   }
  //   let x1, x2, y1, y2;
  //   if (layer === Layer.PLANT || layer === Layer.GROUNDFX) {
  //     // const translatedCenterPoint = Tile.translatePoint(
  //     //   viewport.center,
  //     //   Layer.TERRAIN,
  //     //   layer
  //     // );
  //     x1 = Math.max(
  //       0,
  //       viewport.center.x * Tile.plantSize -
  //         (viewport.width * Tile.plantSize) / 2
  //     );
  //     x2 = Math.min(
  //       this.game.options.gameSize.width * Tile.plantSize,
  //       viewport.center.x * Tile.plantSize +
  //         (viewport.width * Tile.plantSize) / 2
  //     );
  //     y1 = Math.max(
  //       0,
  //       viewport.center.y * Tile.plantSize -
  //         (viewport.height * Tile.plantSize) / 2
  //     );
  //     y2 = Math.min(
  //       this.game.options.gameSize.height * Tile.plantSize,
  //       viewport.center.y * Tile.plantSize +
  //         (viewport.height * Tile.plantSize) / 2
  //     );
  //   } else {
  //     x1 = Math.max(0, viewport.center.x - viewport.width / 2);
  //     x2 = Math.min(
  //       this.game.options.gameSize.width,
  //       viewport.center.x + viewport.width / 2
  //     );
  //     y1 = Math.max(0, viewport.center.y - viewport.height / 2);
  //     y2 = Math.min(
  //       this.game.options.gameSize.height,
  //       viewport.center.y + viewport.height / 2
  //     );
  //   }
  //   x1 = Math.floor(x1);
  //   x2 = Math.ceil(x2);
  //   y1 = Math.floor(y1);
  //   y2 = Math.ceil(y2);
  //   // console.throttle(50).log("returning viewport bounds", x1, x2);

  //   return { x1, x2, y1, y2 };
  // }

  // public static translatePoint(position: Point, from: Layer, to: Layer): Point {
  //   if (from === to) return position;

  //   const ratio = Tile.size / Tile.plantSize;
  //   if (from === Layer.PLANT) {
  //     return new Point(
  //       Math.floor(position.x / ratio),
  //       Math.floor(position.y / ratio)
  //     );
  //   } else if (to === Layer.PLANT) {
  //     return new Point(position.x * ratio, position.y * ratio);
  //   }
  // }

  // public getViewportBounds(
  //   viewport: Viewport,
  //   layer: Layer
  // ): {
  //   x1: number;
  //   x2: number;
  //   y1: number;
  //   y2: number;
  // } {
  //   if (!viewport) {
  //     return;
  //   }
  //   let x1, x2, y1, y2;
  //   if (layer === Layer.PLANT || layer === Layer.GROUNDFX) {
  //     x1 = Math.max(
  //       0,
  //       viewport.center.x * Tile.plantSize -
  //         (viewport.width * Tile.plantSize) / 2
  //     );
  //     x2 = Math.min(
  //       this.game.options.gameSize.width * Tile.plantSize,
  //       viewport.center.x * Tile.plantSize +
  //         (viewport.width * Tile.plantSize) / 2
  //     );
  //     y1 = Math.max(
  //       0,
  //       viewport.center.y * Tile.plantSize -
  //         (viewport.height * Tile.plantSize) / 2
  //     );
  //     y2 = Math.min(
  //       this.game.options.gameSize.height * Tile.plantSize,
  //       viewport.center.y * Tile.plantSize +
  //         (viewport.height * Tile.plantSize) / 2
  //     );
  //   } else {
  //     x1 = Math.max(0, viewport.center.x - viewport.width / 2);
  //     x2 = Math.min(
  //       this.game.options.gameSize.width,
  //       viewport.center.x + viewport.width / 2
  //     );
  //     y1 = Math.max(0, viewport.center.y - viewport.height / 2);
  //     y2 = Math.min(
  //       this.game.options.gameSize.height,
  //       viewport.center.y + viewport.height / 2
  //     );
  //   }
  //   x1 = Math.floor(x1);
  //   x2 = Math.ceil(x2);
  //   y1 = Math.floor(y1);
  //   y2 = Math.ceil(y2);
  //   // console.throttle(250).log("returning viewport bounds", x1, x2);

  //   return { x1, x2, y1, y2 };
  // }
  // public getViewportBounds(
  //   viewport: Viewport,
  //   layer: Layer
  // ): {
  //   x1: number;
  //   x2: number;
  //   y1: number;
  //   y2: number;
  // } {
  //   if (!viewport) {
  //     return;
  //   }
  //   let x1 = Math.max(0, viewport.center.x - viewport.width / 2);
  //   let x2 = Math.min(
  //     this.game.options.gameSize.width,
  //     viewport.center.x + viewport.width / 2
  //   );
  //   let y1 = Math.max(0, viewport.center.y - viewport.height / 2);
  //   let y2 = Math.min(
  //     this.game.options.gameSize.height,
  //     viewport.center.y + viewport.height / 2
  //   );
  //   x1 = Math.floor(x1);
  //   x2 = Math.ceil(x2);
  //   y1 = Math.floor(y1);
  //   y2 = Math.ceil(y2);
  //   // console.throttle(250).log("returning viewport bounds", x1, x2);
  //   if (layer === Layer.PLANT || layer === Layer.GROUNDFX) {
  //     x1 = Math.floor(x1 * Tile.plantSize);
  //     x2 = Math.ceil(x2 * Tile.plantSize);
  //     y1 = Math.floor(y1 * Tile.plantSize);
  //     y2 = Math.ceil(y2 * Tile.plantSize);
  //   }

  //   return { x1, x2, y1, y2 };
  // }

  // public static translatePoint(position: Point, from: Layer, to: Layer): Point {
  //   if (from === to) return position;

  //   const ratio = Tile.size / Tile.plantSize;
  //   if (from === Layer.PLANT) {
  //     return new Point(
  //       Math.floor(position.x / ratio),
  //       Math.floor(position.y / ratio)
  //     );
  //   } else if (to === Layer.PLANT) {
  //     return new Point(position.x * ratio, position.y * ratio);
  //   }
  // }

  // private getViewportCenterTile(): Point {
  //   const pivotXTile =
  //     this.game.userInterface.gameDisplay.stage.pivot.x / Tile.size;
  //   const pivotYTile =
  //     this.game.userInterface.gameDisplay.stage.pivot.y / Tile.size;
  //   let tilesOffsetX =
  //     pivotXTile * this.game.userInterface.gameDisplay.stage.scale.x;
  //   tilesOffsetX = Math.ceil(pivotXTile);
  //   const xPoint = tilesOffsetX;
  //   let tilesOffsetY =
  //     (pivotYTile / Tile.size) *
  //     this.game.userInterface.gameDisplay.stage.scale.y;
  //   tilesOffsetY = Math.ceil(pivotYTile);
  //   const yPoint = tilesOffsetY;

  //   // console.log("viewport center", xPoint, yPoint);

  //   return new Point(xPoint, yPoint);
  // }

  private getViewportCenterTile(): Point {
    const pivotXTile =
      this.game.userInterface.gameDisplay.stage.pivot.x / Tile.size;
    const pivotYTile =
      this.game.userInterface.gameDisplay.stage.pivot.y / Tile.size;
    let tilesOffsetX =
      pivotXTile * this.game.userInterface.gameDisplay.stage.scale.x;
    tilesOffsetX = Math.ceil(pivotXTile);
    const xPoint = tilesOffsetX;
    let tilesOffsetY =
      (pivotYTile / Tile.size) *
      this.game.userInterface.gameDisplay.stage.scale.y;
    tilesOffsetY = Math.ceil(pivotYTile);
    const yPoint = tilesOffsetY;

    return new Point(xPoint, yPoint);
  }

  private handleInput(event: KeyboardEvent): boolean {
    let validInput = false;
    let code = event.keyCode;
    if (code in this.keyMap) {
      let diff = DIRS[8][this.keyMap[code]];
      if (this.moveCamera(this.ui.gameDisplay.stage, diff)) {
        this.viewportTarget = null;
        validInput = true;
      }
      // this.moveCamera(this.ui.gameDisplay.stage, diff);
    } else if (code === KEYS.VK_HOME) {
      this.viewportTarget = null;
      this.centerViewport(
        this.ui.gameDisplay.stage,
        this.ui.gameCanvasContainer.clientWidth,
        this.ui.gameCanvasContainer.clientHeight
      );
      validInput = true;
    }
    return validInput;
  }

  private handlePointerDrag = (g: TinyGesture) => {
    this.showSidebarTimer = this.showSidebarDelayMs;
    this.setSideMenuVisible(false);
    this.ui.gameDisplay.stage.pivot.x -=
      g.velocityX / this.ui.gameDisplay.stage.scale.x;
    this.ui.gameDisplay.stage.pivot.y -=
      g.velocityY / this.ui.gameDisplay.stage.scale.x;
    this.resetMomentum();
  };

  private resetMomentum() {
    this.momentumTimer = 0;
    this.momentum.x = 0;
    this.momentum.y = 0;
  }

  private handleClick = (g: TinyGesture, e: MouseEvent | TouchEvent) => {
    let x, y;
    if (e instanceof MouseEvent) {
      // this is more accurate than g.touchStartX for some reason
      x = e.clientX;
      y = e.clientY;
    } else {
      x = g.touchStartX;
      y = g.touchStartY;
    }
    // this.ui.components.tileSelectionIndicator.handleClick(x, y);
    const tilePos = this.screenToTilePos(x, y);
    if (tilePos) {
      this.selectTileAt(tilePos.x, tilePos.y);
    }
  };

  public screenToTilePos(x: number, y: number): Point {
    for (const key of this.viewportTilesUnpadded) {
      const point = MapWorld.keyToPoint(key);
      const sprite = this.game.renderer.getFromCache(point, Layer.TERRAIN);
      if (sprite) {
        const bounds = sprite.getBounds();
        if (bounds.contains(x, y)) {
          return point;
        }
      }
    }
  }

  private handlePanStart = (g: TinyGesture) => {
    // console.log("pan start", g.velocityX, g.velocityY);
    // console.log(
    //   "pan info",
    //   g.touchMoveX,
    //   g.touchMoveY,
    //   g.touchStartX,
    //   g.touchStartY,
    //   g.touchEndX,
    //   g.touchEndY
    // );
    this.viewportTarget = null;
    this.showSidebarTimer = this.showSidebarDelayMs;
    this.setSideMenuVisible(false);
  };

  private setSideMenuVisible(visible: boolean) {
    // only hide/show if not collapsed
    if (!this.ui.components.sideMenu.isCollapsed) {
      this.ui.components.sideMenu.setVisible(visible);
    }
  }

  private handleMomentum() {
    const percent = this.momentumTimer / this.maxMomentumTimeMs;

    this.momentum.x = lerp(this.momentum.x, 0, percent);
    this.momentum.y = lerp(this.momentum.y, 0, percent);

    this.ui.gameDisplay.stage.pivot.x -= this.momentum.x;
    this.ui.gameDisplay.stage.pivot.y -= this.momentum.y;

    if (this.momentumTimer <= 0) {
      // stop momentum
      this.resetMomentum();
      // start time for showing sidebar again
      this.showSidebarTimer = this.showSidebarDelayMs;
    }
  }

  private handlePanEnd = (g: TinyGesture) => {
    // check if user actually panned/moved the pointer
    if (g.touchMoveX || g.touchMoveY) {
      this.momentum.x = g.velocityX;
      this.momentum.y = g.velocityY;
      this.momentumTimer = this.maxMomentumTimeMs;
    }
  };

  private snapCameraToTile() {
    this.ui.gameDisplay.stage.pivot.x =
      Math.ceil(this.ui.gameDisplay.stage.pivot.x / Tile.size) * Tile.size;
    this.ui.gameDisplay.stage.pivot.y =
      Math.ceil(this.ui.gameDisplay.stage.pivot.y / Tile.size) * Tile.size;
  }

  private roundToNearestTile(x: number, y: number): Point {
    return new Point(
      Math.ceil(x / Tile.size) * Tile.size,
      Math.ceil(y / Tile.size) * Tile.size
    );
  }

  private handlePinchZoom = (g: TinyGesture) => {
    const maxScaleSpeed = 0.2; // < 1 to take effect
    const scaleSpeed = 0.2;

    let pivotX = this.ui.gameDisplay.stage.pivot.x;
    let pivotY = this.ui.gameDisplay.stage.pivot.y;
    let scale = this.ui.gameDisplay.stage.scale.x;
    let scaleDelta = scale - g.scale;
    scaleDelta = Math.max(-maxScaleSpeed, Math.min(maxScaleSpeed, scaleDelta));

    // modify the maps scale based on how much the user pinched
    scale += -1 * scaleDelta * scaleSpeed * scale;
    // clamp to reasonable values
    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));

    const roundedPivot = this.roundToNearestTile(pivotX, pivotY);

    // scale = Math.round(scale * 100) / 100;
    // scale = this.roundStagevalue(scale);

    this.currentZoom = scale;
    // update the scale and position of the stage
    // this.ui.gameDisplay.stage.setTransform(
    //   this.game.userInterface.gameDisplay.stage.position.x,
    //   this.game.userInterface.gameDisplay.stage.position.y,
    //   scale, // scale
    //   scale,
    //   null, // rotation
    //   null, // skew
    //   null,
    //   pivotX,
    //   pivotY
    // );

    this.ui.gameDisplay.stage.setTransform(
      this.game.userInterface.gameDisplay.stage.position.x,
      this.game.userInterface.gameDisplay.stage.position.y,
      scale, // scale
      scale,
      null, // rotation
      null, // skew
      null,
      pivotX,
      pivotY
    );
    if (this.game.options.showClouds) {
      this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
    }
  };

  private handleDoubleTap = (g: TinyGesture) => {
    const zoomInAmount = 1.75;
    let scale = this.ui.gameDisplay.stage.scale.x * zoomInAmount;

    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));

    this.ui.gameDisplay.stage.scale.set(scale);
    if (this.game.options.showClouds) {
      this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
    }
  };

  private roundStagevalue(value: number, scaleValue = 100): number {
    return Math.ceil(value * scaleValue) / scaleValue;
  }

  private handleMouseZoom = (e: WheelEvent) => {
    e.preventDefault();
    const scaleSpeed = 0.1;
    const maxScaleSpeed = 0.35;

    let pivotX = this.ui.gameDisplay.stage.pivot.x;
    let pivotY = this.ui.gameDisplay.stage.pivot.y;
    let scale = this.ui.gameDisplay.stage.scale.x;

    let scrollDelta = Math.max(-1, Math.min(1, e.deltaY));
    scrollDelta = Math.max(
      -maxScaleSpeed,
      Math.min(maxScaleSpeed, scrollDelta)
    );
    // modify the scale based on the scroll delta
    scale += -1 * scrollDelta * scaleSpeed * scale;
    // clamp to reasonable values
    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));

    // scale = this.roundStagevalue(scale);

    this.currentZoom = scale;
    console.log("-------- current scale", scale);

    // const roundedPivot = this.roundToNearestTile(pivotX, pivotY);

    // pivotX = Math.ceil(pivotX / Tile.size) * Tile.size;
    // pivotY = Math.ceil(pivotY / Tile.size) * Tile.size;
    // console.log("pivotX, pivotY", pivotX, pivotY);

    // update the scale and position of the stage
    this.ui.gameDisplay.stage.scale.set(scale);
    // this.ui.gameDisplay.stage.setTransform(
    //   this.game.userInterface.gameDisplay.stage.position.x,
    //   this.game.userInterface.gameDisplay.stage.position.y,
    //   scale, // scale
    //   scale,
    //   null, // rotation
    //   null, // skew
    //   null,
    //   pivotX,
    //   pivotY
    // );
    if (this.game.options.showClouds) {
      this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
    }
  };

  private updateViewport() {
    const oldTiles = new Set(this.viewportTilesUnpadded);
    const viewport = this.getViewport();
    this.viewport = viewport.padded;
    this.viewportUnpadded = viewport.unpadded;
    this.viewportTiles = this.getViewportTiles(true);
    this.viewportTilesUnpadded = this.getViewportTiles(false);
    console
      .throttle(1000)
      .log("viewport ", this.viewport, this.viewportUnpadded);

    const enteredTiles: Point[] = [];
    for (const tileKey of this.viewportTilesUnpadded) {
      if (!oldTiles.has(tileKey)) {
        const point = MapWorld.keyToPoint(tileKey);
        if (this.game.map.isPointInMap(point)) {
          enteredTiles.push(point);
        }
      }
    }

    this.game.map.onTileEnterViewport(enteredTiles);
  }

  public update(deltaTime: number) {
    if (this.showSidebarTimer > 0) {
      this.showSidebarTimer -= deltaTime * 1000;
    } else if (this.showSidebarTimer < 0) {
      this.showSidebarTimer = 0;
      this.setSideMenuVisible(true);
    }
  }

  public renderUpdate(interpPercent: number) {
    // only update viewport if:
    // zoom/scale change
    // pivot change
    if (!this.viewport) {
      this.updateViewport();
    }
    if (
      this.lastZoom !== this.currentZoom ||
      this.lastPivot.x !== this.ui.gameDisplay.stage.pivot.x ||
      this.lastPivot.y !== this.ui.gameDisplay.stage.pivot.y
    ) {
      this.lastZoom = this.currentZoom;
      this.lastPivot.x = this.ui.gameDisplay.stage.pivot.x;
      this.lastPivot.y = this.ui.gameDisplay.stage.pivot.y;
      this.updateViewport();
    }
    // if (this.momentumTimer > 0) {
    //   this.momentumTimer -= deltaTime * 1000;
    //   this.handleMomentum();
    // }
    this.moveTowardsTarget(interpPercent);

    // if (this.showSidebarTimer > 0) {
    //   this.showSidebarTimer -= deltaTime * 1000;
    // } else if (this.showSidebarTimer < 0) {
    //   this.showSidebarTimer = 0;
    //   this.setSideMenuVisible(true);
    // }
  }

  private moveTowardsTarget(deltaTime: number) {
    // move towards target
    // clear target on any touch events
    let targetPos: Point;
    if (this.viewportTarget && isActor(this.viewportTarget)) {
      targetPos = this.TileToScreenCoords(
        this.viewportTarget.position.x,
        this.viewportTarget.position.y
      );
    } else if (this.viewportTarget && this.viewportTarget instanceof Point) {
      targetPos = this.viewportTarget;
    }
    if (targetPos) {
      let newPivotX;
      let newPivotY;
      if (
        Math.abs(this.ui.gameDisplay.stage.pivot.x - targetPos.x) > 0.1 &&
        Math.abs(this.ui.gameDisplay.stage.pivot.y - targetPos.y) > 0.1
      ) {
        newPivotX = lerp(
          deltaTime,
          this.ui.gameDisplay.stage.pivot.x,
          targetPos.x
        );
        newPivotY = lerp(
          deltaTime,
          this.ui.gameDisplay.stage.pivot.y,
          targetPos.y
        );

        newPivotX = this.roundStagevalue(newPivotX);
        newPivotY = this.roundStagevalue(newPivotY);
        this.ui.gameDisplay.stage.pivot.set(newPivotX, newPivotY);
        // newPivotX =
        //   Math.ceil(this.ui.gameDisplay.stage.pivot.x / Tile.size) * Tile.size;
        // this.ui.gameDisplay.stage.pivot.x = this.lerp(
        //   this.ui.gameDisplay.stage.pivot.x,
        //   targetPos.x,
        //   deltaTime
        // );
        // this.ui.gameDisplay.stage.pivot.y = this.lerp(
        //   this.ui.gameDisplay.stage.pivot.y,
        //   targetPos.y,
        //   deltaTime
        // );
        // this.ui.gameDisplay.stage.pivot.x =
        //   Math.ceil(this.ui.gameDisplay.stage.pivot.x / Tile.size) * Tile.size;
        // this.ui.gameDisplay.stage.pivot.y =
        //   Math.ceil(this.ui.gameDisplay.stage.pivot.y / Tile.size) * Tile.size;
      } else {
        this.ui.gameDisplay.stage.pivot.set(targetPos.x, targetPos.y);
        this.viewportTarget = null;
      }
    }
  }

  public getNormalizedZoom(): number {
    return this.ui.gameDisplay.stage.scale.x / (this.maxZoom - this.minZoom);
  }

  // private handleZoom = (e: WheelEvent) => {
  //   e.preventDefault();
  //   const scaleSpeed = 0.1;

  //   const pivotX = this.ui.gameDisplay.stage.pivot.x;
  //   const pivotY = this.ui.gameDisplay.stage.pivot.y;
  //   let scale = this.ui.gameDisplay.stage.scale.x;
  //   let scaledX = (e.x - this.ui.gameDisplay.stage.x) / scale;
  //   let scaledY = (e.y - this.ui.gameDisplay.stage.y) / scale;

  //   // modify the scale based on the scroll delta
  //   scale += -1 * Math.max(-1, Math.min(1, e.deltaY)) * scaleSpeed * scale;
  //   // clamp to reasonable values
  //   scale = Math.max(0.4, Math.min(10, scale));

  //   this.currentZoom = scale;

  //   // update the scale and position of the stage
  //   this.ui.gameDisplay.stage.setTransform(
  //     -scaledX * scale + e.x, // position
  //     -scaledY * scale + e.y,
  //     scale, // scale
  //     scale,
  //     null, // rotation
  //     null, // skew
  //     null,
  //     pivotX, // keeep existing pivot
  //     pivotY
  //   );
  // };
}
