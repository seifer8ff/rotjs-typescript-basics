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
import { Stages } from "./game-state";
import { GameSettings } from "./game-settings";

export interface Viewport {
  width: number;
  height: number;
  center: Point;
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
    this.minZoom = 0.15;
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
      this.ui.application.stage,
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
    const gameWidthPixels = GameSettings.options.gameSize.width * Tile.size;
    const gameHeightPixels = GameSettings.options.gameSize.height * Tile.size;
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

  public inViewport(x: number, y: number, unpadded: boolean = true): boolean {
    let viewport = unpadded ? this.viewportUnpadded : this.viewport;
    return (
      x >= 0 &&
      y >= 0 &&
      x > viewport.center.x - viewport.width / 2 &&
      x < viewport.center.x + viewport.width / 2 &&
      y > viewport.center.y - viewport.height / 2 &&
      y < viewport.center.y + viewport.height / 2
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
    if (this.game.gameState.stage !== Stages.Play) {
      return;
    }
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
    this.ui.components.sideMenu.setEntityTarget(null);
    this.ui.components.tileInfo.setContent(null);
    this.game.renderer.removeFromCache(this.pointerTarget.position, Layer.UI);
    this.pointerTarget = null;
    this.viewportTarget = null;
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
    let screenPoint = new Point(x * Tile.size, y * Tile.size);
    if (layer === Layer.PLANT) {
      screenPoint.x = Tile.translate(x, Layer.PLANT, Layer.TERRAIN);
      screenPoint.y = Tile.translate(y, Layer.PLANT, Layer.TERRAIN);
    }
    return screenPoint;
  }

  public setViewportZoom(stage: PIXI.Container, newZoom: number) {
    this.currentZoom = newZoom;
    stage.scale.set(newZoom);
  }

  private initEventListeners() {
    window.onresize = () =>
      this.centerViewport(
        this.ui.application.stage,
        this.ui.gameCanvasContainer.clientWidth,
        this.ui.gameCanvasContainer.clientHeight
      );

    const gesture = new TinyGesture(this.ui.gameCanvasContainer);

    gesture.on("pinch", (event) => {
      event.preventDefault();
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handlePinchZoom(gesture);
    });
    gesture.on("panstart", (event) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handlePanStart(gesture);
    });
    gesture.on("panmove", (event) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handlePointerDrag(gesture);
    });
    gesture.on("panend", (event) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handlePanEnd(gesture);
    });
    gesture.on("tap", (event) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleClick(gesture, event);
    });
    gesture.on("doubletap", (event) => {
      // The gesture was a double tap. The 'tap' event will also have been fired on
      // the first tap.
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleDoubleTap(gesture);
    });

    this.ui.gameCanvasContainer.addEventListener("wheel", (e: WheelEvent) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleMouseZoom(e),
        {
          passive: false,
        };
    });
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (this.game.gameState.stage !== Stages.Play) {
        return;
      }
      this.handleInput(e),
        {
          passive: false,
        };
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

  private getViewportTiles(pad: boolean = false): string[] {
    const { width, height, center } = pad
      ? this.viewport
      : this.viewportUnpadded;
    const tiles = [];
    const halfWidth = Math.ceil(width / 2); // include any partial tiles
    const halfHeight = Math.ceil(height / 2);
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
    const center = this.getViewportCenterTile();

    const unpaddedWidthTiles =
      this.ui.gameCanvasContainer.clientWidth /
      (Tile.size * this.ui.application.stage.scale.x);
    const unpaddedHeightTiles =
      this.ui.gameCanvasContainer.clientHeight /
      (Tile.size * this.ui.application.stage.scale.x);
    const paddedWidthTiles =
      unpaddedWidthTiles + Math.max(10, 0.1 * unpaddedWidthTiles);
    const paddedHeightTiles =
      unpaddedHeightTiles + Math.max(10, 0.1 * unpaddedHeightTiles);
    return {
      unpadded: {
        width: Math.ceil(unpaddedWidthTiles) + 1,
        height: Math.ceil(unpaddedHeightTiles) + 1,
        center,
      },
      padded: {
        width: Math.ceil(paddedWidthTiles),
        height: Math.ceil(paddedHeightTiles),
        center,
      },
    };
  }

  private getViewportCenterTile(): Point {
    const halfTileSize = Tile.size / 2;
    const pivotXTile =
      (this.game.userInterface.application.stage.pivot.x + halfTileSize) /
      Tile.size;
    const pivotYTile =
      (this.game.userInterface.application.stage.pivot.y + halfTileSize) /
      Tile.size;
    let tilesOffsetX =
      pivotXTile * this.game.userInterface.application.stage.scale.x;
    tilesOffsetX = Math.ceil(pivotXTile) - 1; // Adjusting for centering
    const xPoint = tilesOffsetX;
    let tilesOffsetY =
      (pivotYTile / Tile.size) *
      this.game.userInterface.application.stage.scale.y;
    tilesOffsetY = Math.ceil(pivotYTile) - 1; // Adjusting for centering
    const yPoint = tilesOffsetY;

    return new Point(xPoint, yPoint);
  }

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

  //   return new Point(xPoint, yPoint);
  // }

  private handleInput(event: KeyboardEvent): boolean {
    let validInput = false;
    let code = event.keyCode;
    if (code in this.keyMap) {
      let diff = DIRS[8][this.keyMap[code]];
      if (this.moveCamera(this.ui.application.stage, diff)) {
        this.viewportTarget = null;
        validInput = true;
      }
      // this.moveCamera(this.ui.gameDisplay.stage, diff);
    } else if (code === KEYS.VK_HOME) {
      this.viewportTarget = null;
      this.centerViewport(
        this.ui.application.stage,
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
    this.ui.application.stage.pivot.x -=
      g.velocityX / this.ui.application.stage.scale.x;
    this.ui.application.stage.pivot.y -=
      g.velocityY / this.ui.application.stage.scale.x;
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
    const tilePos = this.screenToTilePos(x, y);
    console.log("----- tilePos", tilePos);
    if (this.game.map.isPointInMap(tilePos)) {
      // if (tilePos) {
      this.selectTileAt(tilePos.x, tilePos.y);
    } else {
      this.clearPointerTarget();
    }
  };

  public screenToTilePos(x: number, y: number): Point {
    let stageScale = this.ui.application.stage.scale.x;
    let centerTile = this.viewport.center;
    let pivotPoint = this.ui.application.stage.pivot;
    let screenCenterX = this.ui.gameCanvasContainer.clientWidth / 2;
    let screenCenterY = this.ui.gameCanvasContainer.clientHeight / 2;
    // offset from click to center of screen, represented in tiles.
    // this will be the offset from the center of the tile
    // so an offset of 0.5, means that the click was at the left edge of the tile one to the right from the center
    const clickOffsetFromScreenCenterX =
      (x - screenCenterX) / (Tile.size * stageScale); // in tiles
    const clickOffsetFromScreenCenterY =
      (y - screenCenterY) / (Tile.size * stageScale);
    // offset from pivot point to center of centerTile, in tiles
    // this exists because the camera isn't perfectly centered in a tile
    const pivotOffsetFromTileCenterX =
      (pivotPoint.x - centerTile.x * Tile.size) / Tile.size;
    const pivotOffsetFromTileCenterY =
      (pivotPoint.y - centerTile.y * Tile.size) / Tile.size;

    return new Point(
      Math.round(
        centerTile.x + clickOffsetFromScreenCenterX + pivotOffsetFromTileCenterX
      ),
      Math.round(
        centerTile.y + clickOffsetFromScreenCenterY + pivotOffsetFromTileCenterY
      )
    );
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

    this.ui.application.stage.pivot.x -= this.momentum.x;
    this.ui.application.stage.pivot.y -= this.momentum.y;

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
    this.ui.application.stage.pivot.x =
      Math.ceil(this.ui.application.stage.pivot.x / Tile.size) * Tile.size;
    this.ui.application.stage.pivot.y =
      Math.ceil(this.ui.application.stage.pivot.y / Tile.size) * Tile.size;
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

    let pivotX = this.ui.application.stage.pivot.x;
    let pivotY = this.ui.application.stage.pivot.y;
    let scale = this.ui.application.stage.scale.x;
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

    this.ui.application.stage.setTransform(
      this.game.userInterface.application.stage.position.x,
      this.game.userInterface.application.stage.position.y,
      scale, // scale
      scale,
      null, // rotation
      null, // skew
      null,
      pivotX,
      pivotY
    );
    if (GameSettings.options.toggles.enableCloudLayer) {
      this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
    }
  };

  private handleDoubleTap = (g: TinyGesture) => {
    const zoomInAmount = 1.75;
    let scale = this.ui.application.stage.scale.x * zoomInAmount;

    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));

    this.ui.application.stage.scale.set(scale);
    if (GameSettings.options.toggles.enableCloudLayer) {
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

    let pivotX = this.ui.application.stage.pivot.x;
    let pivotY = this.ui.application.stage.pivot.y;
    let scale = this.ui.application.stage.scale.x;

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
    this.ui.application.stage.scale.set(scale);
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
    if (GameSettings.options.toggles.enableCloudLayer) {
      this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
    }
  };

  private updateViewport() {
    const oldTiles = new Set(this.viewportTiles);
    const viewport = this.getViewport();
    this.viewport = viewport.padded;
    this.viewportUnpadded = viewport.unpadded;
    this.viewportTiles = this.getViewportTiles(true);
    this.viewportTilesUnpadded = this.getViewportTiles(false);

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

  public uiUpdate(deltaTime: number) {
    // console.log("deltaTime", deltaTime);
    if (this.game.gameState.stage === Stages.Play) {
      if (this.showSidebarTimer > 0) {
        this.showSidebarTimer -= deltaTime * 1000;
      } else if (this.showSidebarTimer < 0) {
        this.showSidebarTimer = 0;
        this.setSideMenuVisible(true);
      }

      if (this.momentumTimer > 0) {
        this.momentumTimer -= deltaTime;
        this.handleMomentum();
      }
      this.moveTowardsTarget(deltaTime);
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
      this.lastPivot.x !== this.ui.application.stage.pivot.x ||
      this.lastPivot.y !== this.ui.application.stage.pivot.y
    ) {
      this.lastZoom = this.currentZoom;
      this.lastPivot.x = this.ui.application.stage.pivot.x;
      this.lastPivot.y = this.ui.application.stage.pivot.y;
      this.updateViewport();
    }
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
        Math.abs(this.ui.application.stage.pivot.x - targetPos.x) > 0.1 &&
        Math.abs(this.ui.application.stage.pivot.y - targetPos.y) > 0.1
      ) {
        newPivotX = lerp(
          deltaTime / 1000,
          this.ui.application.stage.pivot.x,
          targetPos.x
        );
        newPivotY = lerp(
          deltaTime / 1000,
          this.ui.application.stage.pivot.y,
          targetPos.y
        );

        newPivotX = this.roundStagevalue(newPivotX);
        newPivotY = this.roundStagevalue(newPivotY);
        this.ui.application.stage.pivot.set(newPivotX, newPivotY);
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
        this.ui.application.stage.pivot.set(targetPos.x, targetPos.y);
        this.viewportTarget = null;
      }
    }
  }

  public getNormalizedZoom(): number {
    return this.ui.application.stage.scale.x / (this.maxZoom - this.minZoom);
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
