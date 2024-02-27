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
import { TimeControl } from "./web-components/time-control";
import { MenuTabs } from "./web-components/menu-tabs";
import { MenuTabContent } from "./web-components/menu-tab-content";

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
  private timeControl: TimeControl;
  private menuTabs: MenuTabs;

  constructor(private game: Game) {
    this.statusLinePosition = new Point(0, 0);
    this.actionLogPosition = new Point(0, 3);
    this.initWebComponents();

    this.gameDisplayOptions = {
      resizeTo: window,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
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
    this.initControls();
    this.initEventListeners();
  }

  private initWebComponents() {
    customElements.define("time-control", TimeControl);
    customElements.define("menu-tab-content", MenuTabContent);
    customElements.define("menu-tabs", MenuTabs);
  }

  private initEventListeners() {
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
    window.addEventListener("keydown", this.handleInput.bind(this), {
      passive: false,
    });
  }

  private initControls() {
    this.timeControl = document.querySelector("time-control");
    if (this.timeControl) {
      this.timeControl.toggleTooltip();
      this.timeControl.updateTime(
        this.game.timeManager.getCurrentTimeForDisplay()
      );
      this.timeControl.pauseBtn.addEventListener("click", () => {
        this.game.timeManager.togglePause();
      });
      this.timeControl.timeSlider.addEventListener("sl-input", (e: any) => {
        this.game.timeManager.setTimescale(e.target.value);
        console.log("time scale: ", this.game.timeManager.timeScale);
      });
    }
    this.menuTabs = document.querySelector("menu-tabs");
    if (this.menuTabs) {
      this.menuTabs.dropdownMenu.addEventListener(
        "sl-select",
        (e: CustomEvent) => {
          console.log(e.detail);
          this.menuTabs.setSelectedTab(this.menuTabs.getTab(e.detail.item.id));
        }
      );
    }
  }

  private handleInput(event: KeyboardEvent): void {
    if (event.keyCode === KEYS.VK_SPACE) {
      this.game.timeManager.togglePause();
    }
  }

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

  drawText(position: Point, text: string, maxWidth?: number): void {
    this.textDisplay.drawText(position.x, position.y, text, maxWidth);
  }

  HandleInputConfirm(event: KeyboardEvent): boolean {
    let code = event.keyCode;
    return code === KEYS.VK_SPACE || code === KEYS.VK_RETURN;
  }

  refreshPanel(): void {
    this.textDisplay.clear();
    this.game.map.draw();
    this.statusLine.draw();
    this.messageLog.draw();
    this.updateTimeControl();
    const viewportInTiles = this.camera.getViewportInTiles(true);
    this.drawPlants();
    this.drawEntities();
    this.game.renderer.renderLayers(
      [Layer.TERRAIN, Layer.PLANT, Layer.ENTITY],
      viewportInTiles.width,
      viewportInTiles.height,
      viewportInTiles.center
    );
  }

  private drawPlants(): void {
    this.game.renderer.clearLayer(Layer.PLANT, true);
    for (let plant of this.game.plants) {
      this.game.renderer.addToScene(
        plant.position,
        Layer.PLANT,
        plant.tile.sprite
      );
    }
  }

  private drawEntities(): void {
    this.game.renderer.clearLayer(Layer.ENTITY, true);
    for (let entity of this.game.entities) {
      this.game.renderer.addToScene(
        entity.position,
        Layer.ENTITY,
        entity.tile.sprite
      );
    }
  }

  private updateTimeControl(): void {
    if (this.timeControl) {
      this.timeControl.updateTime(
        this.game.timeManager.getCurrentTimeForDisplay()
      );
      this.timeControl.updatePauseBtn(this.game.timeManager.isPaused);
    }
  }

  resetStatusLine(): void {
    this.statusLine.reset();
    this.statusLine.maxBoxes = this.game.treeCount;
  }
}
