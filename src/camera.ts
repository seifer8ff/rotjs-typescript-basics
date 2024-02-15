import { Game } from "./game";
import { Point } from "./point";
import * as PIXI from "pixi.js";
import { Tile } from "./tile";
import { UserInterface } from "./user-interface";
import { KEYS, DIRS } from "rot-js";
import { InputUtility } from "./input-utility";

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
  private mouseX = 0;
  private mouseY = 0;

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
    this.ui.gameCanvasContainer.addEventListener("wheel", this.handleZoom, {
      passive: false,
    });
    this.ui.gameCanvasContainer.addEventListener(
      "pointerdown",
      this.handlePointerDown,
      { passive: false }
    );
    this.ui.gameCanvasContainer.addEventListener(
      "pointerup",
      this.handlePointerUp,
      { passive: false }
    );
    this.ui.gameCanvasContainer.addEventListener(
      "pointercancel",
      this.handlePointerOut,
      { passive: false }
    );
    this.ui.gameCanvasContainer.addEventListener(
      "pointerout",
      this.handlePointerOut,
      { passive: false }
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
    return true;
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

  private handlePointerDown = (e: MouseEvent) => {
    // console.log(`handle pointer down`);
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.isPanning = true;

    this.ui.gameCanvasContainer.addEventListener(
      "pointermove",
      this.handlePointerDrag,
      { passive: false }
    );
  };

  private handlePointerUp = (e: MouseEvent) => {
    // console.log("handle pointer up");
    this.ui.gameCanvasContainer.removeEventListener(
      "pointermove",
      this.handlePointerDrag
    );
    this.isPanning = false;
  };

  private handlePointerOut = (e: MouseEvent) => {
    this.ui.gameCanvasContainer.removeEventListener(
      "pointermove",
      this.handlePointerDrag
    );
    this.isPanning = false;
  };

  private handlePointerDrag = (e: DragEvent) => {
    // update dx and dy BEFORE updating this.mouseX
    const dx = e.clientX - this.mouseX;
    const dy = e.clientY - this.mouseY;

    // update current mouse position for next run of function
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    this.ui.gameDisplay.stage.position.x += dx;
    this.ui.gameDisplay.stage.position.y += dy;
  };

  private handleZoom = (e: WheelEvent) => {
    e.preventDefault();
    const scaleSpeed = 0.1;

    const pivotX = this.ui.gameDisplay.stage.pivot.x;
    const pivotY = this.ui.gameDisplay.stage.pivot.y;
    let scale = this.ui.gameDisplay.stage.scale.x;
    let scaledX = (e.x - this.ui.gameDisplay.stage.x) / scale;
    let scaledY = (e.y - this.ui.gameDisplay.stage.y) / scale;

    // modify the scale based on the scroll delta
    scale += -1 * Math.max(-1, Math.min(1, e.deltaY)) * scaleSpeed * scale;
    // clamp to reasonable values
    scale = Math.max(0.4, Math.min(10, scale));

    // update the scale and position of the stage
    this.ui.gameDisplay.stage.setTransform(
      -scaledX * scale + e.x, // position
      -scaledY * scale + e.y,
      scale, // scale
      scale,
      null, // rotation
      null, // skew
      null,
      pivotX, // keeep existing pivot
      pivotY
    );
  };
}
