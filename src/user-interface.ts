import { Display, KEYS } from "rot-js/lib/index";
import { Point } from "./point";
import { Game } from "./game";
import { StatusLine } from "./status-line";
import { MessageLog } from "./message-log";
import { InputUtility } from "./input-utility";
import { InitAssets } from "./assets";
import * as PIXI from "pixi.js";
import { Tile } from "./tile";
import { Person } from "./entities/person";
import { Layer } from "./renderer";
import { Camera } from "./camera";

export class UserInterface {
  public gameDisplay: PIXI.Application<PIXI.ICanvas>;
  public camera: Camera;
  public textDisplay: Display;
  public statusLine: StatusLine;
  public messageLog: MessageLog;
  public gameCanvasContainer: HTMLElement;

  private gameCanvas: PIXI.ICanvas;
  private gameDisplayOptions: Partial<PIXI.IApplicationOptions>;
  private keyMap: { [key: number]: number };

  // TODO: move text log to web tech
  private textCanvasContainer: HTMLElement;
  private textCanvas: HTMLCanvasElement;
  private statusLinePosition: Point;
  private actionLogPosition: Point;
  private maximumBoxes = 10;
  private fontSize = 20;

  constructor(private game: Game) {
    this.statusLinePosition = new Point(0, 0);
    this.actionLogPosition = new Point(0, 3);

    this.gameDisplayOptions = {
      resizeTo: window,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
      backgroundColor: "red",
    };

    this.gameDisplay = new PIXI.Application(this.gameDisplayOptions);
    this.gameDisplay.stage.sortableChildren = true;
    this.textDisplay = new Display({
      width: this.game.gameSize.width * 2,
      height: 10,
      fontSize: this.fontSize,
    });

    this.gameCanvasContainer = document.getElementById("canvasContainer");
    this.textCanvasContainer = document.getElementById("textContainer");

    // this.gameCanvasContainer.appendChild(this.gameDisplay.getContainer());
    // this.gameCanvas = this.gameDisplay.getContainer().querySelector("canvas");

    this.gameCanvasContainer.appendChild(
      this.gameDisplay.view as HTMLCanvasElement
    );
    this.gameCanvas = this.gameDisplay.view;

    // this.textCanvasContainer.appendChild(this.textDisplay.getContainer());
    this.textCanvas = this.textDisplay.getContainer().querySelector("canvas");

    this.statusLine = new StatusLine(
      this,
      this.statusLinePosition,
      this.game.gameSize.width * 3,
      { maxBoxes: this.maximumBoxes }
    );
    this.messageLog = new MessageLog(
      this,
      this.actionLogPosition,
      this.game.gameSize.width * 3,
      6
    );

    this.camera = new Camera(this.game, this);
    this.initEventListeners();
  }

  private initEventListeners() {
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
    window.addEventListener("keydown", this.handleInput.bind(this), {
      passive: false,
    });
  }

  private handleInput(event: KeyboardEvent): void {
    if (event.keyCode === KEYS.VK_SPACE) {
      this.game.isPaused = !this.game.isPaused;
      console.log("isPaused: " + this.game.isPaused);
    }
  }

  // public initialize() {
  //     this.gameDisplay.clear();
  //     this.textDisplay.clear();
  //     this.messageLog.clear();

  //     if (!this.game.gameState.isGameOver() || this.game.gameState.doRestartGame()) {
  //         this.resetStatusLine();
  //         this.writeHelpMessage();
  //     } else {
  //         this.statusLine.boxes = 0;
  //     }

  // }

  public async init() {
    await InitAssets();
    this.gameDisplay.stage.addChild(this.game.renderer.terrainLayer);
    this.gameDisplay.stage.addChild(this.game.renderer.plantLayer);
    this.gameDisplay.stage.addChild(this.game.renderer.entityLayer);
  }

  private writeHelpMessage(): void {
    let helpMessage = [
      `Find the pineapple in one of the boxes.`,
      `Move with numpad, search box with 'spacebar' or 'return'.`,
      // `Watch out for %c{${Person.glyphColor.foregroundColor}}Pedro%c{}!`,
    ];

    for (let index = helpMessage.length - 1; index >= 0; --index) {
      this.messageLog.appendText(helpMessage[index]);
    }
  }

  draw(position: Point, layer: Layer, sprites: string[], tint?: string): void {
    sprites.forEach((spriteName) => {
      let pixiSprite = PIXI.Sprite.from(spriteName);
      pixiSprite.anchor.set(0.5);
      pixiSprite.position.x = position.x * Tile.size;
      pixiSprite.position.y = position.y * Tile.size;
      if (tint) {
        pixiSprite.tint = tint || "0xFFFFFF";
      }

      this.game.renderer.addToScene(pixiSprite, layer);
    });
  }

  drawText(position: Point, text: string, maxWidth?: number): void {
    this.textDisplay.drawText(position.x, position.y, text, maxWidth);
  }

  HandleInputConfirm(event: KeyboardEvent): boolean {
    let code = event.keyCode;
    return code === KEYS.VK_SPACE || code === KEYS.VK_RETURN;
  }

  refreshPanel(): void {
    // this.gameDisplay.clear();
    this.textDisplay.clear();
    this.game.map.draw();
    this.statusLine.draw();
    this.messageLog.draw();

    for (let plant of this.game.plants) {
      this.draw(plant.position, Layer.PLANT, [plant.tile.sprite]);
    }

    for (let entity of this.game.entities) {
      this.draw(entity.position, Layer.ENTITY, [entity.tile.sprite]);
    }

    // let pos = this.game.getPlayerPosition();
    // let bgTile = this.game.map.getTile(pos.x, pos.y);
    // this.draw(pos, [bgTile.glyph, this.game.player.glyph]);
    // this.rescale(pos.x, pos.y);
    // for (let enemy of this.game.enemies) {
    //     pos = enemy.position;
    //     bgTile = this.game.map.getTile(pos.x, pos.y);
    //     this.draw(enemy.position, [bgTile.glyph, enemy.glyph]);
    // }

    ////////////////////////////////////////////////////////////
    //
    // change this function to draw layer by layer
    // draw terrain
    // draw structures
    // draw objs
    // draw actors
    //
    ///////////////////////////////////////////////////////////
  }

  resetStatusLine(): void {
    this.statusLine.reset();
    this.statusLine.maxBoxes = this.game.treeCount;
  }
}
