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

  public scheduler: {
    postTask: (
      task: any,
      options: { priority: "user-blocking" | "background" | "user-visible" }
    ) => void;
  };

  public ticker: Ticker;
  private turnAnimDelay: number = 0; // how long to delay the game loop for (like when animations are playing)

  constructor() {
    this.settings = new GameSettings(this);
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
  }

  public async Init(): Promise<boolean> {
    await InitAssets();
    this.gameState.reset();
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

  public resetGame(): void {
    this.map.cloudMap.init();
    this.map.polesMap.init();
    this.map.tempMap.init();
    this.map.moistureMap.init();
    this.map.shadowMap.init();
    this.map.lightManager.init();
    this.renderer.init();
    this.gameState.reset();
  }

  public async generateWorld(): Promise<boolean> {
    this.gameState.loading = true;
    this.map.generateMap(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height
    );
    return true;
  }

  private async startLoop() {
    // console.log("start loop");
    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.begin("main loop");
    }
  }

  private async endLoop() {
    // console.log("end loop");
    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.end("main loop");
    }
  }

  private worldSetup(): void {
    // any initialization that requires the real game loop:
    //    things like actors moving, tinting of tiles, etc
    this.actorManager.addInitialActors();
    for (let i = 0; i < 2; i++) {
      this.gameLoop();
    }
    this.gameState.worldSetupComplete = true;
  }

  private mainLoop(deltaTime: number) {
    this.ticker.update(performance.now());

    if (this.gameState.stage === Stages.Play) {
      if (!this.gameState.worldSetupComplete) {
        // let a few turns pass, do any world setup needed
        this.worldSetup();
        return;
      }

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
      // clear cache for dynamic layers:
      // - terrain layer's cache is handled at lower level by marking tiles as dirty
      // - entity layer's cache is handled at lower level to allow lerp animations
      this.renderer.clearCache(Layer.PLANT);
      this.renderer.clearCache(Layer.TREE);
      // this.renderer.clearCache(Layer.UI);

      this.map.lightManager.turnUpdate();
      this.map.shadowMap.turnUpdate();
      this.map.cloudMap.turnUpdate();

      // update dynamic lights after all actors have moved
      // will get picked up in next render
      this.map.lightManager.clearChangedDynamicLights();
      this.map.lightManager.updateDynamicLighting();
      this.map.lightManager.recalculateDynamicLighting();

      // update cache for entities and plants
      this.drawEntities();
      this.drawPlants();
      //
      // important that this comes last
      // run a tint pass on all actors (entities, trees, etc)
      this.map.lightManager.tintActors(this.actorManager.allActors, true);
      this.map.lightManager.tintActors(
        this.actorManager.trees,
        false,
        Layer.TREE
      );
    });
  }

  private drawPlants(): void {
    for (let tree of this.actorManager.trees) {
      tree.draw();
    }
    for (let shrub of this.actorManager.shrubs) {
      shrub.draw();
    }
  }

  private drawEntities(): void {
    // this.renderer.clearSceneLayer(Layer.ENTITY);
    for (let actor of this.actorManager.actors) {
      actor.draw();
    }
  }

  private renderLoop(interpPercent: number) {
    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.begin();
    }
    this.renderer.clearCache(Layer.UI); // clear UI cache during render since it updates outside of game loop

    this.map.draw();

    this.userInterface.camera.renderUpdate(interpPercent);

    if (this.gameState.stage === Stages.Play) {
      this.timeManager.renderUpdate(this.turnAnimDelay);

      if (GameSettings.options.toggles.enableShadows) {
        this.map.shadowMap.renderUpdate(interpPercent);
      }

      if (GameSettings.options.toggles.enableClouds) {
        this.map.cloudMap.renderUpdate(interpPercent);
      }

      if (GameSettings.options.toggles.enableGlobalLights) {
        this.map.lightManager.renderUpdate(interpPercent);
      }

      if (GameSettings.options.toggles.enableAnimations) {
        this.animManager.animUpdate(); // no deltaTime needed as this uses the gameDelay timing for animation
      }
    }

    this.userInterface.renderUpdate();
    this.userInterface.components.renderUpdate();

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
        [Layer.UI, Layer.PLANT, Layer.ENTITY, Layer.TREE, Layer.UI],
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

    if (GameSettings.options.toggles.enableStats) {
      this.settings.stats?.end();
    }
  }

  private async uiLoop(deltaTime: number) {
    this.userInterface.camera.uiUpdate(deltaTime);
    // loop through all ui components and run a refresh on them
    this.userInterface.components.refreshComponents();
  }
}
