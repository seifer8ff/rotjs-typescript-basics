import { RNG } from "rot-js/lib/index";
import { Player } from "./entities/player";
import { Actor } from "./entities/actor";
import { GameState, Stages } from "./game-state";
import { Tile } from "./tile";
import { UserInterface } from "./user-interface";
import { Layer, Renderer } from "./renderer";
import { MapWorld } from "./map-world";
import { TimeManager } from "./time-manager";
import { GeneratorNames } from "./generator-names";
import { TileStats } from "./web-components/tile-info";
import Simplex from "rot-js/lib/noise/simplex";
import Noise from "rot-js/lib/noise/noise";
import { ManagerAnimation } from "./manager-animation";
import { Ticker } from "pixi.js";
import * as MainLoop from "mainloop.js";
import GameStats from "gamestats.js";
import * as PIXI from "pixi.js";
import { InitAssets } from "./assets";
import { GameSettings } from "./game-settings";
import { ManagerActors } from "./manager-actors";

export class Game {
  public settings: GameSettings;
  public noise: Noise;
  public map: MapWorld;
  public player: Player;
  public plants: Actor[];
  public gameState: GameState;
  public renderer: Renderer;
  public animManager: ManagerAnimation;
  public actorManager: ManagerActors;
  public timeManager: TimeManager;
  public userInterface: UserInterface;
  public nameGenerator: GeneratorNames;
  public stats: GameStats;

  public scheduler: {
    postTask: (
      task: any,
      options: { priority: "user-blocking" | "background" | "user-visible" }
    ) => void;
  };

  public ticker: Ticker;
  private turnAnimDelay: number = 0; // how long to delay the game loop for (like when animations are playing)

  constructor() {
    this.settings = new GameSettings();
    if ((window as any).scheduler) {
      this.scheduler = (window as any).scheduler;
    }
    this.ticker = Ticker.shared;
    this.ticker.autoStart = false;
    this.ticker.stop();
    if (GameSettings.options.gameSeed == undefined) {
      GameSettings.options.gameSeed = Math.floor(RNG.getUniform() * 1000000);
    }
    RNG.setSeed(GameSettings.options.gameSeed);
    console.log("Game seed:", GameSettings.options.gameSeed);
    this.noise = new Simplex();

    this.timeManager = new TimeManager(this);
    this.animManager = new ManagerAnimation(this);
    this.userInterface = new UserInterface(this);
    this.gameState = new GameState();
    this.map = new MapWorld(this);
    this.nameGenerator = new GeneratorNames(this);
    this.renderer = new Renderer(this);
    this.actorManager = new ManagerActors(this);
    this.stats = new GameStats();
    this.initGameStatsMonitor();
  }

  public initGameStatsMonitor(): void {
    this.stats.dom.style.top = "40vh";
    this.stats.dom.style.left = "unset";
    this.stats.dom.style.right = "15px";
    this.stats.dom.style.zIndex = "5000";

    document.body.appendChild(this.stats.dom);

    // OR addtionally with options
    const options = {
      targetFPS: 60,
      // maxMemorySize: 350, // GPU VRAM limit ( the max of the texture memory graph )
      COLOR_MEM_TEXTURE: "#8ddcff", // the display color of the texture memory size in the graph
      COLOR_MEM_BUFFER: "#ffd34d", // the display color of buffer memory size in the graph
    };
    this.stats.enableExtension("pixi", [
      PIXI,
      this.userInterface.application,
      options,
    ]);
  }

  public async Init(): Promise<boolean> {
    await InitAssets();
    await this.initializeGame();
    await this.userInterface.init();

    return true;
  }

  public start() {
    window.addEventListener("blur", () => {
      this.timeManager.setIsPaused(true);
    });
    MainLoop.setBegin(this.startLoop.bind(this))
      .setUpdate(this.mainLoop.bind(this))
      .setDraw(this.renderLoop.bind(this))
      .setEnd(this.endLoop.bind(this))
      .start();
  }

  isMapBlocked(x: number, y: number): boolean {
    return !this.map.isPassable(x, y);
  }

  isOccupiedByActor(x: number, y: number): boolean {
    return this.actorManager.actors.some(
      (actor) => actor.position.x === x && actor.position.y === y
    );
  }

  isOccupiedBySelf(x: number, y: number, actor: Actor): boolean {
    return actor.position.x === x && actor.position.y === y;
  }

  isBlocked(x: number, y: number): boolean {
    return (
      this.isMapBlocked(x, y) ||
      this.isOccupiedByTree(x, y) ||
      this.isOccupiedByActor(x, y)
    );
  }

  isOccupiedByTree(x: number, y: number): boolean {
    return this.actorManager.trees.some(
      (plant) => plant.position.x === x && plant.position.y === y
    );
  }

  isOccupiedByPlant(x: number, y: number): boolean {
    return (
      this.actorManager.trees.some(
        (plant) => plant.position.x === x && plant.position.y === y
      ) ||
      this.actorManager.shrubs.some(
        (plant) => plant.position.x === x && plant.position.y === y
      )
    );
  }

  getTerrainTileAt(x: number, y: number): Tile {
    return this.map.getTile(x, y);
  }

  getTileInfoAt(x: number, y: number): TileStats {
    return {
      height: this.map.heightMap[MapWorld.coordsToKey(x, y)],
      magnetism: this.map.polesMap.magnetismMap[MapWorld.coordsToKey(x, y)],
      temperaturePercent: this.map.tempMap.tempMap[MapWorld.coordsToKey(x, y)],
      moisture: this.map.moistureMap.moistureMap[MapWorld.coordsToKey(x, y)],
      sunlight: this.map.getTotalLight(x, y),
      biome: this.map.biomeMap[MapWorld.coordsToKey(x, y)],
    };
  }

  private async initializeGame(): Promise<boolean> {
    this.gameState.reset();
    return true;
  }

  public async generateWorld(): Promise<boolean> {
    this.gameState.loading = true;
    this.map.generateMap(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height
    );
    await this.actorManager.addInitialActors();
    return true;
  }

  private async startLoop() {
    // console.log("start loop");
    this.stats?.begin("game loop");
  }

  private async endLoop() {
    // console.log("end loop");
    this.stats?.end("game loop");
  }

  private mainLoop(deltaTime: number) {
    // if (!this.timeManager.isPaused) {
    this.ticker.update(performance.now());
    // }

    if (this.gameState.stage === Stages.Play) {
      // handle counting down wait time after a turn (like for animation)
      if (this.turnAnimDelay > 0 && !this.timeManager.isPaused) {
        this.turnAnimDelay -= deltaTime * this.timeManager.timeScale;
      }
      if (this.turnAnimDelay < 0) {
        this.turnAnimDelay = 0;
      }

      if (!this.timeManager.isPaused && this.turnAnimDelay <= 0) {
        this.gameLoop();
        this.turnAnimDelay = GameSettings.options.turnAnimDelay;
        this.timeManager.resetTurnAnimTime();
      }
    }

    this.uiLoop(deltaTime);
  }

  private gameLoop() {
    // console.log(
    //   "----- game loop, turn: " + this.timeManager.currentTurn + " -------"
    // );
    const turn = this.timeManager.currentTurn;
    let actors: Actor[] = [];
    // loop through ALL actors each turn
    while (turn === this.timeManager.currentTurn) {
      actors.push(this.timeManager.nextOnSchedule());
    }

    return Promise.all(
      actors.map((actor) => {
        if (actor && actor?.plan) {
          return actor?.plan();
        }
      })
    ).then(async () => {
      actors.forEach((actor) => {
        if (actor?.action) {
          this.timeManager.setDuration(actor.action.durationInTurns);
        }
      });

      await Promise.all(
        actors.map((actor) => {
          if (actor?.action) {
            return actor?.act();
          }
        })
      );
      // console.log("promises done");
      this.drawEntities();
      this.map.lightManager.clearLightMap();
      this.map.lightManager.interpolateAmbientLight();
      this.map.shadowMap.turnUpdate();
      this.map.cloudMap.turnUpdate();
      // update dynamic lights after all actors have moved
      // will get picked up in next render
      this.map.lightManager.clearChangedDynamicLights();
      this.map.lightManager.updateDynamicLighting();
      this.map.lightManager.recalculateDynamicLighting();
    });
  }

  private drawPlants(): void {
    this.renderer.clearLayer(Layer.PLANT, true);
    for (let tree of this.actorManager.trees) {
      // for (let plant of this.plants) {
      // instead of having the userinterface add the plant to the scene,
      // let each plant add itself, including branches and leaves
      // this simplifies multitile entities
      tree.draw();
    }
    for (let shrub of this.actorManager.shrubs) {
      shrub.draw();
    }
  }

  private drawEntities(): void {
    // this.game.renderer.clearLayer(Layer.ENTITY, true);
    for (let actor of this.actorManager.actors) {
      actor.draw();
    }
  }

  private renderLoop(interpPercent: number) {
    this.stats?.begin();

    this.map.draw();

    this.userInterface.camera.renderUpdate(interpPercent);

    if (this.gameState.stage === Stages.Play) {
      this.timeManager.renderUpdate(this.turnAnimDelay);

      if (GameSettings.options.toggles.enableShadows) {
        this.scheduler.postTask(
          () => this.map.shadowMap.renderUpdate(interpPercent),
          {
            priority: "user-blocking",
          }
        );
      }

      if (GameSettings.options.toggles.enableCloudLayer) {
        this.scheduler.postTask(
          () => this.map.cloudMap.renderUpdate(interpPercent),
          {
            priority: "user-blocking",
          }
        );
      }

      if (GameSettings.options.toggles.enableGlobalLights) {
        this.scheduler.postTask(
          () => this.map.lightManager.renderUpdate(interpPercent),
          {
            priority: "user-blocking",
          }
        );
      }

      // this.map.shadowMap.renderUpdate(deltaTime);
      // this.map.cloudMap.renderUpdate(deltaTime);
      // this.map.lightManager.renderUpdate(deltaTime);

      this.drawPlants();

      if (GameSettings.options.toggles.enableAnimations) {
        this.animManager.animUpdate(); // no deltaTime needed as this uses the gameDelay timing for animation
      }
    }

    this.userInterface.renderUpdate();

    this.scheduler.postTask(
      () => this.userInterface.components.renderUpdate(),
      {
        priority: "user-visible",
      }
    );

    if (this.gameState.stage === Stages.Play) {
      let viewportInTiles = this.userInterface.camera.viewportPadded;
      this.renderer.renderChunkedLayers(
        [Layer.TERRAIN],
        viewportInTiles.width,
        viewportInTiles.height,
        viewportInTiles.center
      );
      viewportInTiles = this.userInterface.camera.viewportUnpadded;
      this.renderer.renderChunkedLayers(
        [Layer.UI, Layer.PLANT, Layer.ENTITY],
        viewportInTiles.width,
        viewportInTiles.height,
        viewportInTiles.center
      );

      // this.renderer.renderLayers(
      //   [Layer.TERRAIN, Layer.ENTITY, Layer.UI],
      //   viewportInTiles.width,
      //   viewportInTiles.height,
      //   viewportInTiles.center.x,
      //   viewportInTiles.center.y,
      //   0
      // );
    }

    this.stats?.end();
  }

  private async uiLoop(deltaTime: number) {
    this.userInterface.camera.uiUpdate(deltaTime);
    // loop through all ui components and run a refresh on them
    this.userInterface.components.refreshComponents();
  }
}
