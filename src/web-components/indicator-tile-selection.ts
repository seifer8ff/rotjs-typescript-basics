import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import { SlIconButton, SlRange } from "@shoelace-style/shoelace";
import PauseIcon from "../shoelace/assets/icons/pause-fill.svg";
import PlayIcon from "../shoelace/assets/icons/play-fill.svg";
import { UtilityActions } from "./utility-actions";
import { Camera } from "../camera";
import { Point } from "../point";
import { Tile } from "../tile";
import { UserInterface } from "../user-interface";
import { Game } from "../game";
import CloseIcon from "../shoelace/assets/icons/x.svg";

export class IndicatorTileSelection extends HTMLElement {
  public container: HTMLDivElement;
  public canvas: HTMLCanvasElement;
  public closeBtn: SlIconButton;

  private isVisible: boolean;
  private updateRef: number;
  private lastRefreshTime: number;
  private msPerRefresh: number = 1000 / 10; // desired interval is 1000 ms / runs per second
  private game: Game;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    this.isVisible = false;

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.bottom = "0";
    this.container.style.right = "0";
    this.container.style.border = "1px solid red";
    this.container.style.fontFamily = "Arial";
    this.container.style.fontSize = "18px";
    this.container.style.borderRadius = "10px";
    this.container.style.pointerEvents = "none";

    this.closeBtn = document.createElement("sl-icon-button");
    this.closeBtn.setAttribute("size", "large");
    this.closeBtn.setAttribute("src", CloseIcon);
    this.closeBtn.style.position = "absolute";
    this.closeBtn.style.top = "15px";
    this.closeBtn.style.right = "15px";
    this.closeBtn.style.zIndex = "100";
    this.closeBtn.style.pointerEvents = "auto";
    this.closeBtn.style.fontSize = "40px";
    this.closeBtn.style.zIndex = "110";

    this.container.appendChild(this.closeBtn);

    shadow.appendChild(this.container);
    this.setVisible(this.isVisible);
  }

  public init(game: Game) {
    this.game = game;
    if (this.isVisible) {
      this.updateRef = requestAnimationFrame(this.update.bind(this));
    }
  }

  private createCanvas() {
    if (this.game.userInterface.gameContainer) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = this.game.userInterface.gameContainer.clientWidth;
      this.canvas.height = this.game.userInterface.gameContainer.clientHeight;
      this.canvas.style.position = "absolute";
      this.canvas.style.top = "0";
      this.canvas.style.left = "0";
      this.canvas.style.pointerEvents = "none";
      this.canvas.style.zIndex = "100";
      this.container.appendChild(this.canvas);
    }
  }

  private drawGrid() {
    if (this.canvas) {
      const ctx = this.canvas.getContext("2d");
      // fill the grid with 16x16 tiles with a 1px border
      const borderSize = 1;
      const scale = this.game.userInterface.gameDisplay.stage.scale.x;
      const tileSize = Tile.size * scale;
      const innerTileSize = tileSize - borderSize * 2; // Subtract border on both sides
      const width = this.canvas.width;
      const height = this.canvas.height;
      const rows = Math.floor(width / tileSize);
      const cols = Math.floor(height / tileSize);
      const xOffset = (width % tileSize) / 2;
      const yOffset = (height % tileSize) / 2;

      const pivot = this.game.userInterface.gameDisplay.stage.pivot;
      const pivotOffsetX = (pivot.x % Tile.size) * scale;
      const pivotOffsetY = (pivot.y % Tile.size) * scale;

      ctx.clearRect(0, 0, width, height); // Clear the canvas
      ctx.fillStyle = "rgba(255, 16, 240, 1)"; // Set the color to hot pink
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (i === 47 && j === 26) {
            // console.log(`draw tile at ${i}, ${j}, ${tileSize}`);
            ctx.fillStyle = "rgba(30, 200, 240, 1)"; // Set the color to something else
          } else {
            ctx.fillStyle = "rgba(255, 16, 240, 1)"; // Set the color to hot pink
          }
          ctx.fillRect(
            i * tileSize + xOffset - pivotOffsetX,
            j * tileSize + yOffset - pivotOffsetY,
            tileSize,
            tileSize
          ); // Draw the outer tile (border)
        }
      }

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          ctx.clearRect(
            i * tileSize + xOffset - pivotOffsetX + borderSize,
            j * tileSize + yOffset - pivotOffsetY + borderSize,
            innerTileSize,
            innerTileSize
          ); // Clear the inner tile
        }
      }
    }
  }

  private async update(now: number) {
    requestAnimationFrame(this.update.bind(this));
    if (!this.lastRefreshTime) {
      this.lastRefreshTime = now;
    }
    const elapsed = now - this.lastRefreshTime;
    const deltaTime = elapsed / 1000; // time elapsed in seconds

    if (elapsed > this.msPerRefresh) {
      // console.log("update tile selection indicator");
      if (!this.canvas) {
        this.createCanvas();
      }
      if (this.canvas) {
        this.drawGrid();
      }
      this.lastRefreshTime = now;
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.style.display = visible ? "block" : "none";
    if (visible && !this.updateRef) {
      this.updateRef = requestAnimationFrame(this.update.bind(this));
    } else {
      cancelAnimationFrame(this.updateRef);
    }
  }

  public handleClick(x: number, y: number) {
    console.log("handle click", x, y);
    const clickedPos = this.screenToTilePos(x, y);
    console.log("clicked pos", clickedPos);
    const clickedTile = this.game.map.getTile(clickedPos.x, clickedPos.y);
    console.log("clicked tile", clickedTile);
    this.game.map.setTile(clickedPos.x, clickedPos.y, Tile.shrub);
  }

  public screenToTilePos(x: number, y: number): Point {
    // offset from center of viewport/container
    const scale = this.game.userInterface.gameDisplay.stage.scale.x;
    const pivot = this.game.userInterface.gameDisplay.stage.pivot;
    const viewport = this.game.userInterface.camera.getViewport(false);
    // calculate initial pivot based on map size and tile size
    const screenCenterX =
      this.game.userInterface.gameCanvasContainer.clientWidth / 2;
    const screenCenterY =
      this.game.userInterface.gameCanvasContainer.clientHeight / 2;
    const pivotX = pivot.x;
    const pivotY = pivot.y;

    const centerTileX = viewport.center.x;
    const centerTileY = viewport.center.y;
    const centerTileScreenX = centerTileX * Tile.size;
    const centerTileScreenY = centerTileY * Tile.size;
    console.log("--- centerScreenX", centerTileScreenX);
    const pivotDiffX = pivotX - centerTileScreenX;
    const pivotDiffY = pivotY - centerTileScreenY;
    console.log("--- pivotDiffX", pivotDiffX);

    // const pixelOffsetFromTileCenter = pivot.x % Tile.size;
    // console.log("pixel offset from tile center", pixelOffsetFromTileCenter);

    // take into account how offset the stage is from the center of the tile
    console.log(
      "--- calculate offset, pivot, tile size, scale",
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
}
