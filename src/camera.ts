import { Game } from "./game";
import { Point } from "./point";
import * as PIXI from "pixi.js";
import { Tile } from "./tile";
import { UserInterface } from "./user-interface";
import { KEYS, DIRS } from "rot-js";
import { InputUtility } from "./input-utility";
import TinyGesture from "tinygesture";

export class Camera {
  public viewport = {
    width: 360,
    height: 800,
  };
  private currentZoom = 1;
  private defaultZoom = 1;
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
      this.ui.gameCanvasContainer.clientHeight,
      this.viewport.width,
      this.viewport.height
    );
    this.defaultZoom = this.ui.gameDisplay.stage.scale.x;
    this.initEventListeners();
  }

  public centerViewport(
    stage: PIXI.Container,
    screenWidth: number,
    screenHeight: number,
    virtualWidth: number,
    virtualHeight: number
  ): void {
    // not sure if this next line does anything...
    // this.gameDisplay.renderer.resize(screenWidth, screenHeight);
    const gameWidthPixels = this.game.gameSize.width * Tile.size;
    const gameHeightPixels = this.game.gameSize.height * Tile.size;
    const screenCenterX = screenWidth / 2;
    const screenCenterY = screenHeight / 2;

    this.setPivot(stage, gameWidthPixels / 2, gameHeightPixels / 2);
    stage.position.set(screenCenterX, screenCenterY);

    stage.scale.x = (screenWidth / virtualWidth) * this.currentZoom;
    stage.scale.y = (screenHeight / virtualHeight) * this.currentZoom;

    if (stage.scale.x < stage.scale.y) {
      stage.scale.y = stage.scale.x;
    } else {
      stage.scale.x = stage.scale.y;
    }
  }

  private setPivot(stage: PIXI.Container, x: number, y: number): void {
    stage.pivot.set(x, y);
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
        this.ui.gameCanvasContainer.clientHeight,
        this.viewport.width,
        this.viewport.height
      );

    const gesture = new TinyGesture(this.ui.gameCanvasContainer);

    gesture.on("pinch", (event) => {
      event.preventDefault();
      this.handlePinchZoom(gesture);
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
      console.log("double tap");
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

  // public getViewportSizeInTiles(pad: boolean = false): {
  //   width: number;
  //   height: number;
  // } {
  //   let width =
  //     this.ui.gameCanvasContainer.clientWidth /
  //     (Tile.size * this.ui.gameDisplay.stage.scale.x);
  //   let height =
  //     this.ui.gameCanvasContainer.clientHeight /
  //     (Tile.size * this.ui.gameDisplay.stage.scale.x);
  //   if (pad) {
  //     // min of 5 padding
  //     width += Math.max(5, width / 4);
  //     height += Math.max(5, height / 4);
  //   }
  //   width = Math.ceil(width);
  //   height = Math.ceil(height);
  //   return { width, height };
  // }

  public getViewportInTiles(pad: boolean = false): {
    width: number;
    height: number;
    center: Point;
  } {
    let width =
      this.ui.gameCanvasContainer.clientWidth /
      (Tile.size * this.ui.gameDisplay.stage.scale.x);
    let height =
      this.ui.gameCanvasContainer.clientHeight /
      (Tile.size * this.ui.gameDisplay.stage.scale.x);
    if (pad) {
      // min of 5 padding
      width += Math.max(10, width);
      height += Math.max(10, height);
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
      this.setViewportZoom(this.ui.gameDisplay.stage, this.defaultZoom);
      this.centerViewport(
        this.ui.gameDisplay.stage,
        this.ui.gameCanvasContainer.clientWidth,
        this.ui.gameCanvasContainer.clientHeight,
        this.viewport.width,
        this.viewport.height
      );
      validInput = true;
    }
    return validInput;
  }

  private handlePointerDrag = (g: TinyGesture) => {
    let dragModifier = 1;
    this.isPanning = true;
    // increase drag speed to prevent sluggish feeling
    const modifiedVelocityX = g.velocityX * dragModifier;
    const modifiedVelocityY = g.velocityY * dragModifier;

    this.ui.gameDisplay.stage.pivot.x -=
      // scale the velocity by the size of the stage
      modifiedVelocityX / this.ui.gameDisplay.stage.scale.x;
    this.ui.gameDisplay.stage.pivot.y -=
      modifiedVelocityY / this.ui.gameDisplay.stage.scale.x;
  };

  private handlePanEnd = (g: TinyGesture) => {
    this.isPanning = false;
    let momentumModifier = 0.8;
    const momentumDuration = 300; // in milliseconds
    const momentumInterval = 16; // in milliseconds
    const momentumX =
      (g.velocityX * momentumModifier) / this.ui.gameDisplay.stage.scale.x;
    const momentumY =
      (g.velocityY * momentumModifier) / this.ui.gameDisplay.stage.scale.x;

    let elapsed = 0;
    const momentumTimer = setInterval(() => {
      elapsed += momentumInterval;
      const progress = elapsed / momentumDuration;
      if (progress >= 1) {
        clearInterval(momentumTimer);
        return;
      }

      const momentumStepX = momentumX * (1 - progress);
      const momentumStepY = momentumY * (1 - progress);

      this.ui.gameDisplay.stage.pivot.x -= momentumStepX;
      this.ui.gameDisplay.stage.pivot.y -= momentumStepY;
    }, momentumInterval);
  };

  private handlePinchZoom = (g: TinyGesture) => {
    // TODO: fix bugs
    // BUG: pinch zooming is not centered on the pinch point
    // BUG: pinch zooming initially sets scale to distance between fingers
    // BUG: weird behavior when moving while pinching
    const scaleSpeed = 0.2;

    const pivotX = this.ui.gameDisplay.stage.pivot.x;
    const pivotY = this.ui.gameDisplay.stage.pivot.y;

    const posX = this.ui.gameDisplay.stage.position.x;
    const posY = this.ui.gameDisplay.stage.position.y;

    const scaleX = this.ui.gameDisplay.stage.scale.x;
    const scaleY = this.ui.gameDisplay.stage.scale.y;

    let scaleDiff = scaleX - g.scale;
    scaleDiff *= -1 * scaleSpeed;
    scaleDiff = Math.max(-0.2, Math.min(0.2, scaleDiff));

    const newScaleX = scaleX * g.scale * (1 - scaleSpeed);
    const newScaleY = scaleY * g.scale * (1 - scaleSpeed);

    this.currentZoom += scaleDiff;
    this.ui.gameDisplay.stage.scale.x += scaleDiff;
    this.ui.gameDisplay.stage.scale.y += scaleDiff;
  };

  private handleDoubleTap = (g: TinyGesture) => {
    const zoomInAmount = 1.75;

    this.ui.gameDisplay.stage.scale.x *= zoomInAmount;
    this.ui.gameDisplay.stage.scale.y *= zoomInAmount;
  };

  private handleZoom = (e: WheelEvent) => {
    e.preventDefault();
    const scaleSpeed = 0.1;

    const pivotX = this.ui.gameDisplay.stage.pivot.x;
    const pivotY = this.ui.gameDisplay.stage.pivot.y;
    let scale = this.ui.gameDisplay.stage.scale.x;

    // modify the scale based on the scroll delta
    scale += -1 * Math.max(-1, Math.min(1, e.deltaY)) * scaleSpeed * scale;
    // clamp to reasonable values
    scale = Math.max(0.4, Math.min(10, scale));

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
