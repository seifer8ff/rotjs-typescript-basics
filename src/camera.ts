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

export interface Viewport {
  width: number;
  height: number;
  center: Point;
}

export interface PointerTarget {
  position: Point;
  target: Tile | Actor;
}

export class Camera {
  public viewport: Viewport;
  public viewportTarget: Point | Actor;
  public pointerTarget: PointerTarget;
  private currentZoom = 1;
  private defaultZoom = 1.4;
  private minZoom = 0.5;
  private maxZoom = 7;
  private moveSpeed = 0.3;
  private keyMap: { [key: number]: number };
  private momentum: {
    x: number;
    y: number;
    handlerRef: number;
    decay: number;
    durationMs: number;
  };
  private showSidebarHandler;

  private isPanning = false;

  constructor(private game: Game, private ui: UserInterface) {
    this.keyMap = {};
    this.keyMap[KEYS.VK_W] = 0; // up
    this.keyMap[KEYS.VK_D] = 2; // right
    this.keyMap[KEYS.VK_S] = 4; // down
    this.keyMap[KEYS.VK_A] = 6; // left

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
    const gameWidthPixels = this.game.gameSize.width * Tile.size;
    const gameHeightPixels = this.game.gameSize.height * Tile.size;
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
      x > this.viewport.center.x - this.viewport.width / 2 &&
      x < this.viewport.center.x + this.viewport.width / 2 &&
      y > this.viewport.center.y - this.viewport.height / 2 &&
      y < this.viewport.center.y + this.viewport.height / 2
    );
  }

  centerOn(x: number, y: number) {
    this.viewportTarget = this.TileToScreenCoords(x, y);
  }

  public followActor(actor: Actor) {
    this.viewportTarget = actor;
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
      console.log("about to select entity in menu");
      this.ui.components.sideMenu.setEntityTarget(target);
      if (viewportTarget) {
        this.viewportTarget = target;
      }
    } else {
      this.pointerTarget = {
        position: pos,
        target: target,
      };
      this.ui.components.sideMenu.setEntityTarget(null);
      if (viewportTarget) {
        this.viewportTarget = pos;
      }
    }
    this.ui.components.tileInfo.setContent(this.pointerTarget);
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

  public TileToScreenCoords(x: number, y: number): Point {
    return new Point(x * Tile.size, y * Tile.size);
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

  public getViewportInTiles(pad: boolean = false): Viewport {
    const normalizedZoom = this.getNormalizedZoom();
    let width =
      this.ui.gameCanvasContainer.clientWidth /
      (Tile.size * this.ui.gameDisplay.stage.scale.x);
    let height =
      this.ui.gameCanvasContainer.clientHeight /
      (Tile.size * this.ui.gameDisplay.stage.scale.x);
    if (pad) {
      // load more than needed to prevent flickering at edges
      width += Math.max(10, 0.1 * width);
      height += Math.max(10, 0.1 * height);
    }

    if (normalizedZoom < 0.12) {
      // reduce viewport size at low zoom levels
      // hidden by weather overlays
      width = width * 0.95;
      height = height * 0.95;
    }

    if (normalizedZoom < 0.1) {
      // reduce viewport size at low zoom levels
      // hidden by weather overlays
      width = width * 0.9;
      height = height * 0.9;
    }
    const center = this.getViewportCenterTile();
    width = Math.ceil(width);
    height = Math.ceil(height);
    return { width, height, center };
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
    this.ui.gameDisplay.stage.pivot.x -=
      g.velocityX / this.ui.gameDisplay.stage.scale.x;
    this.ui.gameDisplay.stage.pivot.y -=
      g.velocityY / this.ui.gameDisplay.stage.scale.x;
  };

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

    this.selectTileAt(tilePos.x, tilePos.y);
  };

  public screenToTilePos(x: number, y: number): Point {
    // offset from center of viewport/container
    const scale = this.ui.gameDisplay.stage.scale.x;
    const pivot = this.ui.gameDisplay.stage.pivot;
    const viewport = this.getViewportInTiles(false);
    // calculate initial pivot based on map size and tile size
    const screenCenterX = this.ui.gameCanvasContainer.clientWidth / 2;
    const screenCenterY = this.ui.gameCanvasContainer.clientHeight / 2;
    const pivotX = pivot.x;
    const pivotY = pivot.y;

    const centerTileX = viewport.center.x;
    const centerTileY = viewport.center.y;
    const centerTileScreenX = centerTileX * Tile.size;
    const centerTileScreenY = centerTileY * Tile.size;
    console.log("centerScreenX", centerTileScreenX);
    const pivotDiffX = pivotX - centerTileScreenX;
    const pivotDiffY = pivotY - centerTileScreenY;
    console.log("pivotDiffX", pivotDiffX);

    // const pixelOffsetFromTileCenter = pivot.x % Tile.size;
    // console.log("pixel offset from tile center", pixelOffsetFromTileCenter);

    // take into account how offset the stage is from the center of the tile
    console.log(
      "calculate offset, pivot, tile size, scale",
      pivot.x,
      Tile.size,
      scale
    );

    const screenCenterXScaled = (screenCenterX - pivotDiffX) / scale;
    const screenCenterYScaled = (screenCenterY - pivotDiffY) / scale;
    const scaledClickOffsetX = x / scale - screenCenterXScaled;
    const scaledClickOffsetY = y / scale - screenCenterYScaled;

    const tileOffsetX = Math.round(scaledClickOffsetX / Tile.size);
    const tileOffsetY = Math.round(scaledClickOffsetY / Tile.size);
    const tileX = viewport.center.x + tileOffsetX;
    const tileY = viewport.center.y + tileOffsetY;
    return new Point(tileX, tileY);
  }

  // public screenToTilePos(x: number, y: number): Point {
  //   // offset from center of viewport/container
  //   const scale = this.ui.gameDisplay.stage.scale.x;
  //   const pivot = this.ui.gameDisplay.stage.pivot;
  //   const viewport = this.getViewportInTiles(false);
  //   // calculate initial pivot based on map size and tile size
  //   const initialPivotX = (this.game.gameSize.width * Tile.size) / 2;
  //   const initialPivotY = (this.game.gameSize.height * Tile.size) / 2;
  //   const screenCenterX = this.ui.gameCanvasContainer.clientWidth / 2;
  //   const screenCenterY = this.ui.gameCanvasContainer.clientHeight / 2;
  //   const pivotX = pivot.x;
  //   const pivotY = pivot.y;

  //   const centerTileX = viewport.center.x;
  //   const centerTileY = viewport.center.y;
  //   const centerScreenX = centerTileX * Tile.size;
  //   const centerScreenY = centerTileY * Tile.size;
  //   console.log("centerScreenX", centerScreenX);
  //   const pivotDiffX = pivotX - centerScreenX;
  //   const pivotDiffY = pivotY - centerScreenY;
  //   console.log("pivotDiffX", pivotDiffX);

  //   // const pixelOffsetFromTileCenter = pivot.x % Tile.size;
  //   // console.log("pixel offset from tile center", pixelOffsetFromTileCenter);

  //   // take into account how offset the stage is from the center of the tile
  //   console.log(
  //     "calculate offset, pivot, tile size, scale",
  //     pivot.x,
  //     Tile.size,
  //     scale
  //   );

  //   const screenCenterXScaled = (screenCenterX - pivotDiffX) / scale;
  //   const screenCenterYScaled = (screenCenterY - pivotDiffY) / scale;
  //   const scaledClickOffsetX = x / scale - screenCenterXScaled;
  //   const scaledClickOffsetY = y / scale - screenCenterYScaled;

  //   const tileOffsetX = Math.round(scaledClickOffsetX / Tile.size);
  //   const tileOffsetY = Math.round(scaledClickOffsetY / Tile.size);
  //   const tileX = viewport.center.x + tileOffsetX;
  //   const tileY = viewport.center.y + tileOffsetY;
  //   return new Point(tileX, tileY);
  // }

  // public screenToTilePos(x: number, y: number): Point {
  //   // offset from center of viewport/container
  //   const scale = this.ui.gameDisplay.stage.scale.x;
  //   const pivot = this.ui.gameDisplay.stage.pivot;
  //   const viewport = this.getViewportInTiles(false);
  //   let centerX = this.ui.gameCanvasContainer.clientWidth / 2;
  //   const centerY = this.ui.gameCanvasContainer.clientHeight / 2;
  //   // take into account how offset the stage is from the center of the tile

  //   const pixelOffsetFromTileCenter = pivot.x % Tile.size;
  //   console.log("pixel offset from tile center", pixelOffsetFromTileCenter);
  //   // const scaledTileSizeX = Tile.size / scale;
  //   // const centerTileOffsetX =
  //   //   ((pivot.x * 100000) % Math.round(Tile.size * 100000)) / 100000;

  //   const centerTileOffsetY = pivot.y % (Tile.size / scale);
  //   const centerTileOffsetX = pixelOffsetFromTileCenter;
  //   console.log("centerTileOffsetX", centerTileOffsetX);
  //   console.log("pivotX, scaledtilesize, ", pivot.x, Tile.size / scale);
  //   centerX -= centerTileOffsetX;

  //   const centerXScaled = centerX / scale;
  //   const centerYScaled = centerY / scale;
  //   const scaledClickOffsetX = (x + centerTileOffsetX) / scale - centerXScaled;
  //   const scaledClickOffsetY = (y - centerTileOffsetY) / scale - centerYScaled;
  //   // console.log("scaledClickOffsetX", scaledClickOffsetX);

  //   const tileOffsetX = Math.round(scaledClickOffsetX / Tile.size);
  //   const tileOffsetY = Math.round(scaledClickOffsetY / Tile.size);
  //   const tileX = viewport.center.x + tileOffsetX;
  //   const tileY = viewport.center.y + tileOffsetY;
  //   return new Point(tileX, tileY);
  // }

  // public screenToTilePos(x: number, y: number): Point {
  //   // offset from center of viewport/container
  //   const scale = this.ui.gameDisplay.stage.scale.x;
  //   const pivot = this.ui.gameDisplay.stage.pivot;
  //   const viewport = this.getViewportInTiles(false);
  //   const centerX = this.ui.gameCanvasContainer.clientWidth / 2;
  //   const centerY = this.ui.gameCanvasContainer.clientHeight / 2;
  //   // take into account how offset the stage is from the center of the tile
  //   const centerTileOffsetX = pivot.x % Tile.size;
  //   const centerTileOffsetY = pivot.y % Tile.size;

  //   const centerXScaled = centerX / scale;
  //   const centerYScaled = centerY / scale;
  //   const scaledClickOffsetX = (x - centerTileOffsetX) / scale - centerXScaled;
  //   const scaledClickOffsetY = (y - centerTileOffsetY) / scale - centerYScaled;

  //   const tileOffsetX = Math.round(scaledClickOffsetX / Tile.size);
  //   const tileOffsetY = Math.round(scaledClickOffsetY / Tile.size);
  //   const tileX = viewport.center.x + tileOffsetX;
  //   const tileY = viewport.center.y + tileOffsetY;
  //   return new Point(tileX, tileY);
  // }

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
    this.isPanning = true;
    this.viewportTarget = null;
    // console.log("handlerRef", this.momentum.handlerRef);
    // if (!this.momentum.handlerRef) {
    this.toggleSideMenuVisibility(false);
    // }
    if (this.showSidebarHandler) {
      clearTimeout(this.showSidebarHandler);
    }
  };

  private toggleSideMenuVisibility(visible: boolean) {
    // only hide/show if not collapsed
    if (!this.ui.components.sideMenu.isCollapsed) {
      this.ui.components.sideMenu.setVisible(visible);
    }
  }

  private handlePanEnd = (g: TinyGesture) => {
    this.isPanning = false;
    // const velocityLimit = 20;
    const momentumDuration = 1000; // in milliseconds
    const msPerLoop = 1000 / 60; // in milliseconds

    if (this.momentum.handlerRef) {
      cancelAnimationFrame(this.momentum.handlerRef);
      this.momentum.handlerRef = null;
    }

    let elapsed = 0;
    let lastRenderTime = 0;
    let newPivotX = this.ui.gameDisplay.stage.pivot.x;
    let newPivotY = this.ui.gameDisplay.stage.pivot.y;

    console.log(
      "momentum at start",
      g.velocityX,
      g.velocityY,
      g.velocityX,
      g.velocityY
    );

    this.momentum.x = g.velocityX;
    this.momentum.y = g.velocityY;

    const momentumHandler = (now: number) => {
      if (!lastRenderTime) {
        lastRenderTime = now;
      }
      console.log("momentum handler");

      elapsed = now - lastRenderTime;
      if (elapsed > msPerLoop && elapsed < momentumDuration) {
        const deltaTime = elapsed / 1000; // time elapsed in seconds
        // const clampedStageScale = Util.clamp(
        //   this.ui.gameDisplay.stage.scale.x,
        //   0.2,
        //   1
        // );
        let scaledDecay = this.momentum.decay;

        scaledDecay *= Math.pow(scaledDecay, deltaTime);
        // scaledDecay *= Math.pow(clampedStageScale, deltaTime);

        this.momentum.x *= scaledDecay;
        this.momentum.y *= scaledDecay;
        // if (Math.abs(this.momentum.x) < 0.2) {
        //   this.momentum.x = 0;
        // }
        // if (Math.abs(this.momentum.y) < 0.2) {
        //   this.momentum.y = 0;
        // }
        // this.momentum.x = this.momentum.x * scaledDecay - deltaTime;
        // this.momentum.y = this.momentum.y * scaledDecay - deltaTime;
        // this.momentum.x = this.roundStagevalue(this.momentum.x);
        // this.momentum.y = this.roundStagevalue(this.momentum.y);
        // newPivotX = this.roundStagevalue(newPivotX - this.momentum.x, 10000);
        // newPivotY = this.roundStagevalue(newPivotY - this.momentum.y, 10000);
        // this.ui.gameDisplay.stage.pivot.set(newPivotX, newPivotY);
        this.ui.gameDisplay.stage.pivot.x -= this.momentum.x;
        this.ui.gameDisplay.stage.pivot.y -= this.momentum.y;
        // this.ui.gameDisplay.stage.pivot.x =
        //   Math.ceil(this.ui.gameDisplay.stage.pivot.x / Tile.size) * Tile.size;
        // this.ui.gameDisplay.stage.pivot.y =
        //   Math.ceil(this.ui.gameDisplay.stage.pivot.y / Tile.size) * Tile.size;
      }

      // // check if pivot is centered on tile
      // if (this.ui.gameDisplay.stage.pivot.x % Tile.size !== 0) {
      //   this.snapCameraToTile();
      // }

      if (
        elapsed < this.momentum.durationMs &&
        (Math.abs(this.momentum.x) > 0.1 || Math.abs(this.momentum.y) > 0.1)
      ) {
        console.log("momentum", this.momentum.x, this.momentum.y);
        // keep this running for durationMs to allow multiple drags
        // before the side menu is shown again
        this.momentum.handlerRef = requestAnimationFrame(
          momentumHandler.bind(this)
        );
      } else {
        // momentum done
        console.log("momentum done");
        if (this.showSidebarHandler) {
          clearTimeout(this.showSidebarHandler);
        }
        this.showSidebarHandler = setTimeout(() => {
          this.toggleSideMenuVisibility(true);
        }, 750);
        this.momentum.handlerRef = null;
        this.momentum.x = 0;
        this.momentum.y = 0;
        g.velocityX = 0;
        g.velocityY = 0;
        // const roundedPivot = this.roundToNearestTile(
        //   this.ui.gameDisplay.stage.pivot.x,
        //   this.ui.gameDisplay.stage.pivot.y
        // );
        // this.ui.gameDisplay.stage.pivot.set(roundedPivot.x, roundedPivot.y);
        this.ui.gameDisplay.stage.pivot.set(
          Math.floor(this.ui.gameDisplay.stage.pivot.x),
          Math.floor(this.ui.gameDisplay.stage.pivot.y)
        );
        console.log("this.momentum", this.momentum);
        cancelAnimationFrame(this.momentum.handlerRef);
      }
    };

    this.momentum.handlerRef = requestAnimationFrame(
      momentumHandler.bind(this)
    );
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

  // private handlePanEnd = (g: TinyGesture) => {
  //   // this.toggleSideMenuVisibility(true);
  //   // if (!this.ui.sideMenu.isCollapsed && !this.ui.sideMenu.isVisible) {
  //   //   this.ui.sideMenu.setVisible(true);
  //   // }

  //   this.isPanning = false;
  //   const velocityLimit = 20;
  //   const momentumDuration = 1000; // in milliseconds
  //   const msPerLoop = 1000 / 60; // in milliseconds
  //   const scale = this.ui.gameDisplay.stage.scale.x;

  //   let momentumX = Util.clamp(
  //     g.velocityX / 3 / (scale * scale),
  //     -velocityLimit,
  //     velocityLimit
  //   );
  //   let momentumY = Util.clamp(
  //     g.velocityY / 3 / (scale * scale),
  //     -velocityLimit,
  //     velocityLimit
  //   );

  //   let elapsed = 0;
  //   let lastRenderTime = 0;

  //   if (this.momentumHandler) {
  //     this.momentumHandler = null;
  //   }

  //   this.momentumHandler = (now: number) => {
  //     if (!lastRenderTime) {
  //       lastRenderTime = now;
  //     }
  //     // console.log("momentum handler");

  //     elapsed = now - lastRenderTime;
  //     if (elapsed > msPerLoop && elapsed < momentumDuration) {
  //       momentumX *= 0.95;
  //       momentumY *= 0.95;
  //       const deltaTime = elapsed / 1000; // time elapsed in seconds
  //       this.ui.gameDisplay.stage.pivot.x -= momentumX * (1 - deltaTime);
  //       this.ui.gameDisplay.stage.pivot.y -= momentumY * (1 - deltaTime);
  //     }
  //     // console.log("after first if");
  //     console.log("elapsed", elapsed);

  //     if (elapsed < momentumDuration) {
  //       requestAnimationFrame(this.momentumHandler.bind(this));
  //     } else {
  //       // momentum done
  //       console.log("momentum done");
  //       this.toggleSideMenuVisibility(true);
  //       this.momentumHandler = null;
  //     }
  //   };

  //   requestAnimationFrame(this.momentumHandler.bind(this));
  // };

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
    scale = this.roundStagevalue(scale);

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
    this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
  };

  private handleDoubleTap = (g: TinyGesture) => {
    const zoomInAmount = 1.75;
    let scale = this.ui.gameDisplay.stage.scale.x * zoomInAmount;

    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));
    scale = this.roundStagevalue(scale);

    this.ui.gameDisplay.stage.scale.set(scale);
    this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
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

    scale = this.roundStagevalue(scale);

    this.currentZoom = scale;

    const roundedPivot = this.roundToNearestTile(pivotX, pivotY);

    // pivotX = Math.ceil(pivotX / Tile.size) * Tile.size;
    // pivotY = Math.ceil(pivotY / Tile.size) * Tile.size;
    // console.log("pivotX, pivotY", pivotX, pivotY);

    // update the scale and position of the stage
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
    this.ui.components.skyMask.setSkyMaskVisibility(this.getNormalizedZoom());
  };

  public updateViewport() {
    this.viewport = this.getViewportInTiles(true);
  }

  // private isActor(target: any): target is Actor {
  //   return "plan" in target && "act" in target && "position" in target;
  // }

  public update(deltaTime: number) {
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
        this.ui.gameDisplay.stage.pivot.set(newPivotX, newPivotY);
        // newPivotX = this.roundStagevalue(newPivotX);
        // newPivotY = this.roundStagevalue(newPivotY);
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
      }
    }
    this.updateViewport();

    if (this.pointerTarget) {
      this.game.renderer.clearLayer(Layer.UI, true);
      if (isActor(this.pointerTarget.target)) {
        this.game.renderer.addToScene(
          this.pointerTarget.target.position,
          Layer.UI,
          "ui_tile_select"
        );
      } else {
        this.game.renderer.addToScene(
          this.pointerTarget.position,
          Layer.UI,
          "ui_tile_select"
        );
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
