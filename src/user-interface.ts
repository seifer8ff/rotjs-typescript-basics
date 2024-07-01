import { Display, KEYS } from "rot-js/lib/index";
import { Point } from "./point";
import { Game } from "./game";
import { MessageLog } from "./message-log";
import { InputUtility } from "./input-utility";
import { InitAssets } from "./assets";
import * as PIXI from "pixi.js";
import { Layer } from "./renderer";
import { Camera } from "./camera";

import { ManagerWebComponents } from "./manager-web-components";
import { isActor } from "./entities/actor";
import { BiomeId } from "./biomes";
import { Stages } from "./game-state";
import { GameSettings } from "./game-settings";

export class UserInterface {
  public application: PIXI.Application<PIXI.ICanvas>;
  public camera: Camera;
  public messageLog: MessageLog;
  public gameCanvasContainer: HTMLElement;

  public gameContainer: HTMLElement;
  private gameDisplayOptions: Partial<PIXI.IApplicationOptions>;
  private keyMap: { [key: number]: number };

  public components: ManagerWebComponents;
  private sprites: { [key: string]: string };

  constructor(private game: Game) {
    this.sprites = {
      selectionBox: "ui_tile_select",
    };
    this.components = new ManagerWebComponents(game, this);

    this.gameContainer = document.getElementById("gameContainer");
    this.gameCanvasContainer = document.getElementById("canvasContainer");

    this.gameDisplayOptions = {
      resizeTo: window,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    };

    this.application = new PIXI.Application(this.gameDisplayOptions);
    this.application.stage.sortableChildren = true;

    // let colorMatrix = new PIXI.ColorMatrixFilter();
    // colorMatrix.night(0.2, false);
    // this.application.stage.filters = [colorMatrix];

    this.gameCanvasContainer.appendChild(
      this.application.view as HTMLCanvasElement
    );
    this.messageLog = new MessageLog(this.game);
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
      this.game.timeManager.togglePause();
    }
  }

  public async init() {
    this.game.renderer.addLayersToStage(this.application.stage);
    await this.initializeBuildTools();
  }

  public async initializeBuildTools(): Promise<boolean> {
    const options: { name: string; iconPath: string; id: BiomeId }[] = [
      {
        name: "Moist Dirt",
        iconPath: "moistdirt_spring_sandydirt_00",
        id: "moistdirt",
      },
      {
        name: "Ocean",
        iconPath: "ocean_spring_moistdirt_00",
        id: "ocean",
      },
      { name: "Snow", iconPath: "snow_base", id: "snowmoistdirt" },
    ];
    this.components.updateSideBarContent("Build", options);
    return true;
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

  HandleInputConfirm(event: KeyboardEvent): boolean {
    let code = event.keyCode;
    return code === KEYS.VK_SPACE || code === KEYS.VK_RETURN;
  }

  handleRightArrow(event: KeyboardEvent): boolean {
    let code = event.keyCode;
    return code === KEYS.VK_RIGHT;
  }

  renderUpdate(): void {
    // this.textDisplay.clear();

    // this.statusLine.draw();
    // this.messageLog.draw();
    this.components.updateTimeControl();
    // const viewportInTiles = this.camera.viewportUnpadded;
    // update

    // TODO: refactor to selection box to lerp follow the target
    // TODO: stop clearing entire UI layer and just move the selection box
    // TODO: allow smaller indicator for smaller grid sizes (i.e. plant layer 8x8)
    // TODO: total rework.
    if (this.camera.pointerTarget) {
      this.game.renderer.clearLayer(Layer.UI, true); // clears cache
      if (isActor(this.camera.pointerTarget.target)) {
        this.game.renderer.addToScene(
          this.camera.pointerTarget.target.position,
          Layer.UI,
          PIXI.Sprite.from(this.sprites.selectionBox)
        );
      } else {
        this.game.renderer.addToScene(
          this.camera.pointerTarget.position,
          Layer.UI,
          PIXI.Sprite.from(this.sprites.selectionBox)
        );
      }
    }
  }
}
