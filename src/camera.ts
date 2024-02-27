import { Game } from "./game";
import { Point } from "./point";
import * as PIXI from "pixi.js";
import { Tile } from "./tile";
import { UserInterface } from "./user-interface";
import { KEYS, DIRS, Util } from "rot-js";
import { InputUtility } from "./input-utility";
import TinyGesture from "tinygesture";

export interface Viewport {
  width: number;
  height: number;
  center: Point;
}

export class Camera {
  public viewport: Viewport;
  private currentZoom = 1;
  private defaultZoom = 1.4;
  private minZoom = 0.5;
  private maxZoom = 10;
  private moveSpeed = 0.3;
  private keyMap: { [key: number]: number };

  private isPanning = false;

  constructor(private game: Game, private ui: UserInterface) {
    this.keyMap = {};
    this.keyMap[KEYS.VK_W] = 0; // up
    this.keyMap[KEYS.VK_D] = 2; // right
    this.keyMap[KEYS.VK_S] = 4; // down
    this.keyMap[KEYS.VK_A] = 6; // left

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

    this.setPivot(stage, gameWidthPixels / 2, gameHeightPixels / 2);
    stage.position.set(screenCenterX, screenCenterY);

    stage.scale.x = this.defaultZoom;
    stage.scale.y = this.defaultZoom;
  }

  private setPivot(stage: PIXI.Container, x: number, y: number): void {
    stage.pivot.set(x, y);
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
    // TODO
    console.log(`TODO: centerOn: ${x}, ${y}`);

    // const offset = (game.touchScreen ? touchOffsetY : 0);
    // const offset = 0;
    // const tw = ((x * -this.gameDisplay.getOptions().tileWidth) +
    //             (this.gameDisplayOptions.width * this.gameDisplayOptions.tileWidth / 2) + -4);
    // const th = ((y * -this.gameDisplayOptions.tileHeight) +
    //             (this.gameDisplayOptions.height * this.gameDisplayOptions.tileHeight / 2) + offset);
    // if (this.gameCanvasContainer) {
    //   // this applies the animation effect
    //   this.gameCanvasContainer.style.transition = "transform 0.5s ease-out 0s";
    //   if (this.gameCanvas) {
    //     this.gameCanvas.getContext('2d').imageSmoothingEnabled = false;
    //   }
    //   // this sets the scale and position to focus on the player
    //   this.gameCanvasContainer.style.transform =
    //     "scale(" + this.scale + ") " + "translate3d(" + Math.floor(tw) +
    //     "px," + Math.floor(th) + "px,0px)";
    // }
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
    gesture.on("doubletap", (event) => {
      // The gesture was a double tap. The 'tap' event will also have been fired on
      // the first tap.

      this.handleDoubleTap(gesture);
    });

    this.ui.gameCanvasContainer.addEventListener("wheel", this.handleZoom, {
      passive: false,
    });
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
    return true;
  }

  public getViewportInTiles(pad: boolean = false): Viewport {
    let width =
      this.ui.gameCanvasContainer.clientWidth /
      (Tile.size * this.ui.gameDisplay.stage.scale.x);
    let height =
      this.ui.gameCanvasContainer.clientHeight /
      (Tile.size * this.ui.gameDisplay.stage.scale.x);
    if (pad) {
      // load more than needed to prevent flickering at edges
      width += Math.max(10, 0.2 * width);
      height += Math.max(10, 0.2 * height);
    }
    const center = this.getViewportCenterTile();
    width = Math.ceil(width);
    height = Math.ceil(height);
    return { width, height, center };
  }

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
        validInput = true;
      }
      this.moveCamera(this.ui.gameDisplay.stage, diff);
    } else if (code === KEYS.VK_HOME) {
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
    let dragModifier = 1;
    // increase drag speed to prevent sluggish feeling
    const modifiedVelocityX = g.velocityX * dragModifier;
    const modifiedVelocityY = g.velocityY * dragModifier;

    this.ui.gameDisplay.stage.pivot.x -=
      // scale the velocity by the size of the stage
      modifiedVelocityX / this.ui.gameDisplay.stage.scale.x / 1.3;
    this.ui.gameDisplay.stage.pivot.y -=
      modifiedVelocityY / this.ui.gameDisplay.stage.scale.x / 1.3;
  };

  lerp(x: number, y: number, a: number): number {
    return x * (1 - a) + y * a;
  }

  private handlePanStart = (g: TinyGesture) => {
    this.isPanning = true;
    if (!this.ui.sideMenu.isCollapsed && this.ui.sideMenu.isVisible) {
      this.ui.sideMenu.setVisible(false);
    }
  };

  private handlePanEnd = (g: TinyGesture) => {
    if (!this.ui.sideMenu.isCollapsed && !this.ui.sideMenu.isVisible) {
      this.ui.sideMenu.setVisible(true);
    }

    this.isPanning = false;
    const velocityLimit = 20;
    const momentumDuration = 1000; // in milliseconds
    const msPerLoop = 1000 / 60; // in milliseconds
    const scale = this.ui.gameDisplay.stage.scale.x;

    const momentumX = Util.clamp(
      g.velocityX / 3 / (scale * scale),
      -velocityLimit,
      velocityLimit
    );
    const momentumY = Util.clamp(
      g.velocityY / 3 / (scale * scale),
      -velocityLimit,
      velocityLimit
    );

    let elapsed = 0;
    let lastRenderTime = 0;

    const momentumHandler = (now: number) => {
      if (!lastRenderTime) {
        lastRenderTime = now;
      }

      elapsed = now - lastRenderTime;
      if (elapsed > msPerLoop && elapsed < momentumDuration) {
        const deltaTime = elapsed / 1000; // time elapsed in seconds
        this.ui.gameDisplay.stage.pivot.x -= momentumX * (1 - deltaTime);
        this.ui.gameDisplay.stage.pivot.y -= momentumY * (1 - deltaTime);
      }

      if (elapsed < momentumDuration) {
        requestAnimationFrame(momentumHandler);
      }
    };
    requestAnimationFrame(momentumHandler.bind(this));
  };

  private handlePinchZoom = (g: TinyGesture) => {
    const maxScaleSpeed = 0.2; // < 1 to take effect
    const scaleSpeed = 0.2;

    const pivotX = this.ui.gameDisplay.stage.pivot.x;
    const pivotY = this.ui.gameDisplay.stage.pivot.y;
    let scale = this.ui.gameDisplay.stage.scale.x;
    let scaleDelta = scale - g.scale;
    scaleDelta = Math.max(-maxScaleSpeed, Math.min(maxScaleSpeed, scaleDelta));

    // modify the maps scale based on how much the user pinched
    scale += -1 * scaleDelta * scaleSpeed * scale;
    // clamp to reasonable values
    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));

    this.currentZoom = scale;
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
  };

  private handleDoubleTap = (g: TinyGesture) => {
    const zoomInAmount = 1.75;
    let scale = this.ui.gameDisplay.stage.scale.x * zoomInAmount;

    scale = Math.max(this.minZoom, Math.min(this.maxZoom, scale));

    this.ui.gameDisplay.stage.scale.set(scale);
  };

  private handleZoom = (e: WheelEvent) => {
    e.preventDefault();
    const scaleSpeed = 0.1;
    const maxScaleSpeed = 0.35;

    const pivotX = this.ui.gameDisplay.stage.pivot.x;
    const pivotY = this.ui.gameDisplay.stage.pivot.y;
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

    this.currentZoom = scale;

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
  };

  public updateViewport() {
    this.viewport = this.getViewportInTiles(true);
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
