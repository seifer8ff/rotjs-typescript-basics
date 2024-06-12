import { RNG } from "rot-js/lib/index";
import { Player } from "./entities/player";
import { Point } from "./point";
import { Shrub } from "./entities/shrub";
import { Tree } from "./entities/tree/tree";
import { TreeSpecies } from "./entities/tree/tree-species";
import { Actor } from "./entities/actor";
import { Person } from "./entities/person";
import { GameState } from "./game-state";
import { InputUtility } from "./input-utility";
import { Tile, TileType } from "./tile";
import { MapWorldCellular } from "./map-world-cellular";
import { UserInterface } from "./user-interface";
import { Mushroom } from "./entities/mushroom";
import { Cow } from "./entities/cow";
import { SharkBlue } from "./entities/shark-blue";
import { Seagull } from "./entities/seagull";
import { Layer, Renderer } from "./renderer";
import { MapWorld } from "./map-world";
import { TimeManager } from "./time-manager";
import { GeneratorNames } from "./generator-names";
import { BiomeId, Biomes } from "./biomes";
import { TileStats } from "./web-components/tile-info";
import Simplex from "rot-js/lib/noise/simplex";
import Noise from "rot-js/lib/noise/noise";
import { ManagerAnimation } from "./manager-animation";
import { clamp } from "rot-js/lib/util";
import { Ticker } from "pixi.js";
import * as MainLoop from "mainloop.js";

export class Game {
  // starting options
  public options = {
    shouldAutotile: true,
    shouldRender: true,
    showClouds: true,
    animateShadows: true,
    entityCount: 45,
    treeCount: 100,
    shrubCount: 10,
    gameSize: {
      width: 200,
      height: 200,
    },
    dayStart: true,
    // gameSeed: 1234,
    // gameSeed: 610239,
    gameSeed: 594628,
    // gameSeed: null,
    turnAnimDelay: 500, // two turns per second (1 second / 500ms anim phase = 2)
    mainLoopRate: 1000 / 60, // run main loop at 60 fps (all other loops are lower than this)
    refreshRate: 1000 / 60, // 60 fps
    gameLoopRate: 1000 / 10, // how many times to run the game loop (still limited by turnAnimDelay)
    uiLoopRate: 1000 / 10,
    maxTickRate: 1000 / 60, // 60 game updates per second max
    minTickRate: 1000 / 4, // 2 game updates per second min
    animationSpeed: 0.55, // speed at which pixijs animates AnimatedSprites
  };
  public noise: Noise;
  public map: MapWorld;
  public player: Player;
  public entities: Actor[];
  public plants: Actor[];
  public gameState: GameState;
  public renderer: Renderer;
  public animManager: ManagerAnimation;
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

  private lastMainLoopTime: number;
  private lastRenderTime: number;
  private lastuiRefreshTime: number;
  private lastGameLoopTime: number;
  private postTurnWaitTime: number = 0; // how long to delay the game loop for (like when animations are playing)

  constructor() {
    if ((window as any).scheduler) {
      this.scheduler = (window as any).scheduler;
    }
    console.log("this.scheduler", this.scheduler, window);
    this.ticker = Ticker.shared;
    this.ticker.autoStart = false;
    this.ticker.stop();
    if (this.options.gameSeed == undefined) {
      this.options.gameSeed = Math.floor(RNG.getUniform() * 1000000);
    }
    RNG.setSeed(this.options.gameSeed);
    console.log("Game seed:", this.options.gameSeed);
    this.noise = new Simplex();
    this.entities = [];
    this.plants = [];

    this.timeManager = new TimeManager(this);
    this.animManager = new ManagerAnimation(this);
    this.userInterface = new UserInterface(this);
    this.gameState = new GameState();
    this.map = new MapWorld(this);
    this.nameGenerator = new GeneratorNames(this);
    this.renderer = new Renderer(this);
  }

  public async Init(): Promise<boolean> {
    await this.userInterface.init();
    await this.initializePlants();
    await this.initializeGame();
    await this.addActors();

    return true;
  }

  public start() {
    // this.mainLoop(performance.now());
    window.addEventListener("blur", () => {
      // MainLoop.stop();
      this.timeManager.setIsPaused(true);
    });
    MainLoop.setBegin(this.startLoop)
      .setUpdate(this.mainLoop.bind(this))
      .setDraw(this.renderLoop.bind(this))
      .setEnd(this.endLoop.bind(this))
      .start();
  }

  isMapBlocked(x: number, y: number): boolean {
    return !this.map.isPassable(x, y);
  }

  isOccupiedByEntity(x: number, y: number): boolean {
    return this.entities.some(
      (entity) => entity.position.x === x && entity.position.y === y
    );
  }

  isOccupiedBySelf(x: number, y: number, actor: Actor): boolean {
    return actor.position.x === x && actor.position.y === y;
  }

  isBlocked(x: number, y: number): boolean {
    return (
      this.isMapBlocked(x, y) ||
      this.isOccupiedByPlant(x, y) ||
      this.isOccupiedByEntity(x, y)
    );
  }

  isOccupiedByPlant(x: number, y: number): boolean {
    return this.plants.some(
      (plant) => plant.position.x === x && plant.position.y === y
    );
  }

  getPlayerPosition(): Point | undefined {
    return this.player?.position;
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

  getEntityAt(x: number, y: number): Actor | null {
    for (let entity of this.entities) {
      if (entity.position.x === x && entity.position.y === y) {
        return entity;
      }
    }
    return null;
  }

  getPlantAt(x: number, y: number): Actor | null {
    for (let plant of this.plants) {
      if (plant.position.x === x && plant.position.y === y) {
        return plant;
      }
    }
    return null;
  }

  getRandomTilePositions(type: BiomeId, quantity: number = 1): Point[] {
    return this.map.getRandomTilePositions(type, quantity);
  }

  getRandomPlantPositions(type: TileType, quantity: number = 1): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (let key in this.plants) {
      if (this.plants[key].type === type) {
        buffer.push(this.plants[key].position);
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  getRandomEntityPositions(type: TileType, quantity: number = 1): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (let key in this.entities) {
      if (this.entities[key].type === type) {
        buffer.push(this.entities[key].position);
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  private async initializePlants(): Promise<boolean> {
    TreeSpecies.processTreeSpecies();
    return true;
  }

  private async addActors(): Promise<boolean> {
    this.generatePlants();
    this.generateBeings();
    return true;
  }

  private async initializeGame(): Promise<boolean> {
    // await this.userInterface.init();
    this.gameState.reset();

    this.map.generateMap(
      this.options.gameSize.width,
      this.options.gameSize.height
    );

    return true;
  }

  private async startLoop() {
    // console.log("start loop");
  }

  private async endLoop() {
    // console.log("end loop");
  }

  // private async drawLoop() {
  //   console.log("draw loop");
  // }

  private mainLoop(deltaTime: number) {
    // if (!this.timeManager.isPaused) {
    this.ticker.update(performance.now());
    // }

    // handle counting down wait time after a turn (like for animation)
    if (this.postTurnWaitTime > 0 && !this.timeManager.isPaused) {
      this.postTurnWaitTime -= deltaTime * this.timeManager.timeScale;
    }
    if (this.postTurnWaitTime < 0) {
      this.postTurnWaitTime = 0;
    }

    if (!this.timeManager.isPaused && this.postTurnWaitTime <= 0) {
      this.gameLoop();
      this.postTurnWaitTime = this.options.turnAnimDelay;
      this.timeManager.resetTurnAnimTime();
    }

    this.uiLoop(deltaTime);
  }

  // private async mainLoop(now: number) {
  //   // if (!this.timeManager.isPaused) {
  //   this.ticker.update(now);
  //   // }

  //   if (!this.lastMainLoopTime) {
  //     this.lastMainLoopTime = now;
  //   }
  //   if (!this.lastGameLoopTime) {
  //     this.lastGameLoopTime = now;
  //   }
  //   if (!this.lastRenderTime) {
  //     this.lastRenderTime = now;
  //   }
  //   if (!this.lastuiRefreshTime) {
  //     this.lastuiRefreshTime = now;
  //   }
  //   let elapsed = now - this.lastMainLoopTime;

  //   // only check loops during mainLoop updates to prevent excessive calls
  //   if (elapsed > this.options.mainLoopRate) {
  //     if (this.options.shouldRender) {
  //       elapsed = now - this.lastRenderTime;
  //       if (elapsed > this.options.refreshRate) {
  //         if (this.gameLoopDelay > 0 && !this.timeManager.isPaused) {
  //           this.gameLoopDelay -= elapsed * this.timeManager.timeScale;
  //         }
  //         if (this.gameLoopDelay < 0) {
  //           this.gameLoopDelay = 0;
  //         }

  //         await this.renderLoop(now);
  //         this.lastRenderTime = now;
  //       }
  //     }

  //     elapsed = now - this.lastuiRefreshTime;
  //     if (elapsed > this.options.uiLoopRate) {
  //       this.scheduler.postTask(this.uiLoop.bind(this), {
  //         priority: "user-visible",
  //       });
  //       this.lastuiRefreshTime = now;
  //     }

  //     if (!this.timeManager.isPaused) {
  //       elapsed = now - this.lastGameLoopTime;
  //       // number of game loop ticks increase at higher speeds to prevent waiting on game loop
  //       // otherwise, animations finish before the next actor action is ready
  //       const scaledLoopRate = clamp(
  //         this.options.gameLoopRate / this.timeManager.timeScale,
  //         this.options.maxTickRate,
  //         this.options.minTickRate
  //       );
  //       if (elapsed > scaledLoopRate) {
  //         if (this.gameLoopDelay <= 0) {
  //           this.gameLoopDelay = 0;
  //           // this.scheduler.postTask(this.gameLoop.bind(this), {
  //           //   priority: "user-blocking",
  //           // });
  //           await this.gameLoop();
  //           this.gameLoopDelay = this.options.turnAnimDelay;
  //           this.timeManager.startTurnAnimation();
  //         }
  //         this.lastGameLoopTime = now;
  //       }
  //     }
  //   }

  //   this.lastMainLoopTime = now;
  //   requestAnimationFrame(this.mainLoop.bind(this));
  // }

  // private async mainLoop(now: number) {
  //   // if (!this.timeManager.isPaused) {
  //   this.ticker.update(now);
  //   // }

  //   if (!this.lastMainLoopTime) {
  //     this.lastMainLoopTime = now;
  //   }
  //   if (!this.lastGameLoopTime) {
  //     this.lastGameLoopTime = now;
  //   }
  //   if (!this.lastRenderTime) {
  //     this.lastRenderTime = now;
  //   }
  //   if (!this.lastuiRefreshTime) {
  //     this.lastuiRefreshTime = now;
  //   }
  //   let elapsed = now - this.lastMainLoopTime;

  //   // only check loops during mainLoop updates to prevent excessive calls
  //   if (elapsed > this.options.mainLoopRate) {
  //     if (this.options.shouldRender) {
  //       elapsed = now - this.lastRenderTime;
  //       if (elapsed > this.options.refreshRate) {
  //         if (this.gameLoopDelay > 0 && !this.timeManager.isPaused) {
  //           this.gameLoopDelay -= elapsed * this.timeManager.timeScale;
  //         }
  //         if (this.gameLoopDelay < 0) {
  //           this.gameLoopDelay = 0;
  //         }
  //         await this.renderLoop(now);
  //         this.lastRenderTime = now;
  //       }
  //     }

  //     elapsed = now - this.lastuiRefreshTime;
  //     if (elapsed > this.options.uiLoopRate) {
  //       await this.uiLoop(now);
  //       this.lastuiRefreshTime = now;
  //     }

  //     if (!this.timeManager.isPaused) {
  //       elapsed = now - this.lastGameLoopTime;
  //       // number of game loop ticks increase at higher speeds to prevent waiting on game loop
  //       // otherwise, animations finish before the next actor action is ready
  //       const scaledLoopRate = clamp(
  //         this.options.gameLoopRate / this.timeManager.timeScale,
  //         this.options.maxTickRate,
  //         this.options.minTickRate
  //       );
  //       if (elapsed > scaledLoopRate) {
  //         if (this.gameLoopDelay <= 0) {
  //           this.gameLoopDelay = 0;
  //           await this.gameLoop();
  //           this.gameLoopDelay = this.options.turnAnimDelay;
  //           this.timeManager.startTurnAnimation();
  //         }
  //         this.lastGameLoopTime = now;
  //       }
  //     }
  //   }

  //   this.lastMainLoopTime = now;
  //   requestAnimationFrame(this.mainLoop.bind(this));
  // }

  // private async renderLoop(deltaTime: number) {
  //   // console.log("now", now);
  //   // this.scheduler.postTask(
  //   //   () => this.timeManager.renderUpdate(deltaTime, this.gameLoopDelay),
  //   //   {
  //   //     priority: "user-blocking",
  //   //   }
  //   // );

  //   this.timeManager.renderUpdate(deltaTime, this.gameLoopDelay);

  //   // console.log("rendering");
  //   // this.scheduler.postTask(
  //   //   () => this.userInterface.camera.renderUpdate(deltaTime),
  //   //   {
  //   //     priority: "user-blocking",
  //   //   }
  //   // );
  //   this.userInterface.camera.renderUpdate(deltaTime);

  //   this.scheduler.postTask(() => this.map.shadowMap.renderUpdate(deltaTime), {
  //     priority: "user-blocking",
  //   });
  //   this.scheduler.postTask(() => this.map.cloudMap.renderUpdate(deltaTime), {
  //     priority: "user-blocking",
  //   });
  //   this.scheduler.postTask(
  //     () => this.map.lightManager.renderUpdate(deltaTime),
  //     {
  //       priority: "user-blocking",
  //     }
  //   );
  //   // this.map.shadowMap.renderUpdate(deltaTime);
  //   // this.map.cloudMap.renderUpdate(deltaTime);
  //   // this.map.lightManager.renderUpdate(deltaTime);

  //   this.animManager.animUpdate(deltaTime);

  //   // this.scheduler.postTask(() => this.userInterface.renderUpdate(deltaTime), {
  //   //   priority: "user-blocking",
  //   // });

  //   this.userInterface.renderUpdate(deltaTime);

  //   this.scheduler.postTask(
  //     () => this.userInterface.components.renderUpdate(deltaTime),
  //     {
  //       priority: "user-visible",
  //     }
  //   );

  //   // this.userInterface.components.renderUpdate(deltaTime);
  // }

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

    // let actions = actors.map((actor) => {
    //   if (actor) {
    //     return actor?.plan();
    //   }
    // });

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
      this.userInterface.drawEntities();
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

    // actors.forEach((actor) => {
    //   if (actor?.plan) {
    //     if (actor.type === TileType.Entity) {
    //       console.log("about to act on " + actor.name);
    //       console.log(
    //         "turn vs current turn",
    //         turn,
    //         this.timeManager.currentTurn
    //       );
    //     }

    //     // check if dummy actor
    //     actor.plan();
    //     if (actor.action) {
    //       if (actor.type === TileType.Entity) {
    //         console.log("set duration " + actor.action.durationInTurns);
    //       }
    //       this.timeManager.setDuration(actor.action.durationInTurns);

    //       actor.act();
    //     }
    //   } else {
    //     // if dummy actor, just force next turn
    //     this.timeManager.setDuration(1);
    //   }
    // });

    // // console.log("----- draw entities ------- ");
    // this.userInterface.drawEntities();

    // this.map.lightManager.clearLightMap();
    // this.map.lightManager.interpolateAmbientLight();

    // this.map.shadowMap.turnUpdate();
    // this.map.cloudMap.turnUpdate();
    // // update dynamic lights after all actors have moved
    // // will get picked up in next render
    // this.map.lightManager.clearChangedDynamicLights();
    // this.map.lightManager.updateDynamicLighting();
    // this.map.lightManager.recalculateDynamicLighting();
  }

  // private gameLoop() {
  //   console.log(
  //     "----- game loop, turn: " + this.timeManager.currentTurn + " -------"
  //   );
  //   const turn = this.timeManager.currentTurn;
  //   let actor: Actor;
  //   // loop through ALL actors each turn
  //   while (turn === this.timeManager.currentTurn) {
  //     actor = this.timeManager.nextOnSchedule();
  //     if (actor.type === TileType.Entity) {
  //       console.log("about to act on " + actor.name);
  //       console.log("turn vs current turn", turn, this.timeManager.currentTurn);
  //     }
  //     if (actor?.plan) {
  //       // check if dummy actor
  //       actor.plan();
  //       if (actor.action) {
  //         if (actor.type === TileType.Entity) {
  //           console.log("set duration " + actor.action.durationInTurns);
  //         }
  //         this.timeManager.setDuration(actor.action.durationInTurns);

  //         actor.act();
  //       }
  //     } else {
  //       // if dummy actor, just force next turn
  //       this.timeManager.setDuration(1);
  //     }
  //   }

  //   // console.log("----- draw entities ------- ");
  //   this.userInterface.drawEntities();

  //   this.map.lightManager.clearLightMap();
  //   this.map.lightManager.interpolateAmbientLight();

  //   this.map.shadowMap.turnUpdate();
  //   this.map.cloudMap.turnUpdate();
  //   // update dynamic lights after all actors have moved
  //   // will get picked up in next render
  //   this.map.lightManager.clearChangedDynamicLights();
  //   this.map.lightManager.updateDynamicLighting();
  //   this.map.lightManager.recalculateDynamicLighting();
  // }

  private renderLoop(interpPercent: number) {
    // console.log("now", now);
    // this.scheduler.postTask(
    //   () => this.timeManager.renderUpdate(deltaTime, this.gameLoopDelay),
    //   {
    //     priority: "user-blocking",
    //   }
    // );

    this.timeManager.renderUpdate(this.postTurnWaitTime);

    // console.log("rendering");
    // this.scheduler.postTask(
    //   () => this.userInterface.camera.renderUpdate(deltaTime),
    //   {
    //     priority: "user-blocking",
    //   }
    // );
    this.userInterface.camera.renderUpdate(interpPercent);

    this.scheduler.postTask(
      () => this.map.shadowMap.renderUpdate(interpPercent),
      {
        priority: "user-blocking",
      }
    );
    this.scheduler.postTask(
      () => this.map.cloudMap.renderUpdate(interpPercent),
      {
        priority: "user-blocking",
      }
    );
    this.scheduler.postTask(
      () => this.map.lightManager.renderUpdate(interpPercent),
      {
        priority: "user-blocking",
      }
    );
    // this.map.shadowMap.renderUpdate(deltaTime);
    // this.map.cloudMap.renderUpdate(deltaTime);
    // this.map.lightManager.renderUpdate(deltaTime);

    this.animManager.animUpdate(); // no deltaTime needed as this uses the gameDelay timing for animation

    // this.scheduler.postTask(() => this.userInterface.renderUpdate(deltaTime), {
    //   priority: "user-blocking",
    // });

    this.userInterface.renderUpdate();

    this.scheduler.postTask(
      () => this.userInterface.components.renderUpdate(),
      {
        priority: "user-visible",
      }
    );

    // this.userInterface.components.renderUpdate(deltaTime);
  }

  // private async gameLoop() {
  //   const turn = this.timeManager.currentTurn;
  //   let actor: Actor;
  //   // loop through ALL actors each turn
  //   while (turn === this.timeManager.currentTurn) {
  //     actor = this.timeManager.nextOnSchedule();
  //     if (actor) {
  //       actor.plan();
  //       if (actor.action) {
  //         this.timeManager.setDuration(actor.action.durationInTurns);
  //         await actor.act();
  //         // await InputUtility.waitForInput(
  //         //   this.userInterface.handleRightArrow.bind(this)
  //         // );
  //       }
  //     } else {
  //       // await InputUtility.waitForInput(
  //       //   this.userInterface.HandleInputConfirm.bind(this)
  //       // );
  //       await InputUtility.waitForInput(
  //         this.userInterface.handleRightArrow.bind(this)
  //       );
  //       this.timeManager.forceNextTurn();
  //     }
  //   }

  //   this.map.lightManager.clearLightMap();
  //   this.map.lightManager.interpolateAmbientLight();

  //   this.map.shadowMap.turnUpdate();
  //   this.map.cloudMap.turnUpdate();
  //   // update dynamic lights after all actors have moved
  //   // will get picked up in next render
  //   this.map.lightManager.clearChangedDynamicLights();
  //   this.map.lightManager.updateDynamicLighting();

  //   if (this.gameState.isGameOver()) {
  //     await InputUtility.waitForInput(
  //       this.userInterface.HandleInputConfirm.bind(this)
  //     );
  //     await this.initializeGame();
  //   }

  //   await InputUtility.waitForInput(
  //     this.userInterface.handleRightArrow.bind(this)
  //   );
  // }

  // private async renderLoop(now: number) {
  //   // console.log("now", now);
  //   const elapsed = now - this.lastRenderTime;
  //   const deltaTime = elapsed / 1000; // time elapsed in seconds
  //   // this.scheduler.postTask(
  //   //   () => this.timeManager.renderUpdate(deltaTime, this.gameLoopDelay),
  //   //   {
  //   //     priority: "user-blocking",
  //   //   }
  //   // );

  //   this.timeManager.renderUpdate(deltaTime, this.gameLoopDelay);

  //   // console.log("rendering");
  //   // this.scheduler.postTask(
  //   //   () => this.userInterface.camera.renderUpdate(deltaTime),
  //   //   {
  //   //     priority: "user-blocking",
  //   //   }
  //   // );
  //   this.userInterface.camera.renderUpdate(deltaTime);

  //   this.scheduler.postTask(() => this.map.shadowMap.renderUpdate(deltaTime), {
  //     priority: "user-blocking",
  //   });
  //   this.scheduler.postTask(() => this.map.cloudMap.renderUpdate(deltaTime), {
  //     priority: "user-blocking",
  //   });
  //   this.scheduler.postTask(
  //     () => this.map.lightManager.renderUpdate(deltaTime),
  //     {
  //       priority: "user-blocking",
  //     }
  //   );
  //   // this.map.shadowMap.renderUpdate(deltaTime);
  //   // this.map.cloudMap.renderUpdate(deltaTime);
  //   // this.map.lightManager.renderUpdate(deltaTime);

  //   this.animManager.animUpdate(deltaTime);

  //   // this.scheduler.postTask(() => this.userInterface.renderUpdate(deltaTime), {
  //   //   priority: "user-blocking",
  //   // });

  //   this.userInterface.renderUpdate(deltaTime);

  //   this.scheduler.postTask(
  //     () => this.userInterface.components.renderUpdate(deltaTime),
  //     {
  //       priority: "user-visible",
  //     }
  //   );

  //   // this.userInterface.components.renderUpdate(deltaTime);
  // }

  private async uiLoop(deltaTime: number) {
    this.userInterface.camera.update(deltaTime);
    // loop through all ui components and run a refresh on them
    this.userInterface.components.refreshComponents();
  }

  private generatePlants(): void {
    this.plants = [];
    let positions: Point[] = [];

    positions = this.map.getRandomTilePositions(
      Biomes.Biomes.moistdirt.id,
      this.options.shrubCount,
      true,
      true
    );
    console.log("shrub positions", positions);
    for (let position of positions) {
      this.plants.push(new Shrub(this, position));
    }

    let split = Math.ceil(this.options.treeCount / 8);
    positions = [];
    if (this.options.treeCount < 4) {
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.moistdirt.id,
          this.options.treeCount,
          true,
          true
        )
      );
    } else {
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.moistdirt.id,
          split * 3,
          true,
          true
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.hillsmid.id,
          split * 1,
          true,
          true
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.hillshigh.id,
          split,
          true,
          true
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.valley.id,
          split * 1,
          true,
          true
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.snowhillshillsmid.id,
          split * 1,
          true,
          true
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.snowmoistdirt.id,
          split * 1,
          true,
          true
        )
      );
    }

    for (let position of positions) {
      const worldPoint = Tile.translatePoint(
        position,
        Layer.PLANT,
        Layer.TERRAIN
      );
      const biome = this.map.getBiome(worldPoint.x, worldPoint.y);
      this.spawnPlantInBiome(position, biome.id);
    }
  }

  private spawnPlantInBiome(pos: Point, biome: BiomeId): Actor {
    let tree: Actor;
    switch (biome) {
      case Biomes.Biomes.moistdirt.id:
        tree = new Tree(this, pos, TreeSpecies.treeSpecies["pine"]);
        break;
      case Biomes.Biomes.hillsmid.id:
      case Biomes.Biomes.hillshigh.id:
        tree = new Tree(this, pos, TreeSpecies.treeSpecies["birch"]);
        break;
      case Biomes.Biomes.valley.id:
        tree = new Tree(this, pos, TreeSpecies.treeSpecies["cottoncandy"]);
        break;
      case Biomes.Biomes.snowhillshillsmid.id:
        tree = new Tree(this, pos, TreeSpecies.treeSpecies["maple"]);
        break;
      default:
        // const rand = RNG.getUniform();
        // tree =
        //   rand < 0.33
        //     ? new Tree(this, pos, TreeSpecies.treeSpecies["pine"])
        //     : rand < 0.66
        //     ? new Tree(this, pos, TreeSpecies.treeSpecies["birch"])
        //     : new Tree(this, pos, TreeSpecies.treeSpecies["maple"]);
        tree = new Tree(this, pos, TreeSpecies.treeSpecies["maple"]);
        break;
    }
    this.plants.push(tree);
    this.timeManager.addToSchedule(tree, true);
    return tree;
  }

  private generatePlayer(): void {
    const pos = this.map.getRandomTilePositions(
      Biomes.Biomes.moistdirt.id,
      1
    )[0];
    this.player = new Player(this, pos);
  }

  private generateBeings(): void {
    this.entities = [];
    let entitySplit = Math.ceil(this.options.entityCount / 8);
    let positions = [];
    if (this.options.entityCount < 4) {
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.moistdirt.id,
          this.options.entityCount
        )
      );
    } else {
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.moistdirt.id,
          entitySplit * 2
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(Biomes.Biomes.ocean.id, entitySplit)
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.oceandeep.id,
          entitySplit
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.hillshigh.id,
          entitySplit
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(Biomes.Biomes.beach.id, entitySplit)
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.sandydirt.id,
          entitySplit
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.hillslow.id,
          entitySplit
        )
      );
    }

    console.log("got positions", positions);
    // this.player = new Player(this, positions.splice(0, 1)[0]);
    for (let position of positions) {
      const biome = this.map.getBiome(position.x, position.y);
      this.spawnEntityInBiome(position, biome.id);
      // this.spawnRandomEntity(position);
    }

    // render the entity layer upon spawning entities
    // TODO: RENDER SPECIFIC POINTS UPON SPAWNING ADDITIONAL ENTITIES
    this.renderer.renderLayers(
      [Layer.ENTITY],
      this.options.gameSize.width,
      this.options.gameSize.height,
      new Point(
        Math.floor(this.options.gameSize.width / 2),
        Math.floor(this.options.gameSize.height / 2)
      )
    );
    this.userInterface.components.updateSideBarContent(
      "Entities",
      this.entities
    );
  }

  private spawnEntityInBiome(pos: Point, biome: BiomeId): Actor {
    let entity: Actor;
    switch (biome) {
      case Biomes.Biomes.sandydirt.id:
        entity = new Seagull(this, pos);
        break;
      case Biomes.Biomes.moistdirt.id:
        entity = new Cow(this, pos);
        break;
      case Biomes.Biomes.ocean.id:
      case Biomes.Biomes.oceandeep.id:
        entity = new SharkBlue(this, pos);
        break;
      case Biomes.Biomes.hillslow.id:
        entity = new Mushroom(this, pos);
        break;
      default:
        entity = new Mushroom(this, pos);
        break;
    }
    this.entities.push(entity);
    this.timeManager.addToSchedule(entity, true);
    entity.draw();
    return entity;
  }

  private spawnRandomEntity(pos: Point): Actor {
    let entity: Actor;
    const rand = RNG.getUniform();
    if (rand < 0.25) {
      // entity = new Person(this, pos);
      entity = new Cow(this, pos);
    } else if (rand < 0.5) {
      entity = new SharkBlue(this, pos);
    } else {
      entity = new Mushroom(this, pos);
    }
    this.entities.push(entity);
    this.timeManager.addToSchedule(entity, true);
    entity.draw();
    // this.renderer.addToScene(
    //   entity.position,
    //   Layer.ENTITY,
    //   entity.tile.spritePath,
    //   null,
    //   entity.tile.animated
    // );
    return entity;
  }

  // checkBox(x: number, y: number): void {
  //   switch (this.map.getTileType(x, y)) {
  //     case Tile.shrub.type:
  //       this.map.setTile(x, y, Tile.cutTree);
  //       this.userInterface.statusLine.boxes += 1;
  //       if (this.treePoint.x == x && this.treePoint.y == y) {
  //         this.userInterface.messageLog.appendText(
  //           "Continue with 'spacebar' or 'return'."
  //         );
  //         this.userInterface.messageLog.appendText(
  //           "Hooray! You found a pineapple."
  //         );
  //         this.gameState.foundPineapple = true;
  //       } else {
  //         this.userInterface.messageLog.appendText("This box is empty.");
  //       }
  //       break;
  //     case Tile.cutTree.type:
  //       this.map.setTile(x, y, Tile.treeStump);
  //       this.userInterface.messageLog.appendText("You destroy this box!");
  //       break;
  //     case Tile.treeStump.type:
  //       this.userInterface.messageLog.appendText(
  //         "This box is already destroyed."
  //       );
  //       break;
  //     default:
  //       this.userInterface.messageLog.appendText("There is no box here!");
  //       break;
  //   }
  // }

  // destroyBox(actor: Actor, x: number, y: number): void {
  //   switch (this.map.getTileType(x, y)) {
  //     case TileType.Plant:
  //     case TileType.CutTree:
  //       this.map.setTile(x, y, Tile.treeStump);
  //       if (this.treePoint.x == x && this.treePoint.y == y) {
  //         this.userInterface.messageLog.appendText(
  //           "Continue with 'spacebar' or 'return'."
  //         );
  //         this.userInterface.messageLog.appendText(
  //           `Game over - ${this.getActorName(
  //             actor
  //           )} detroyed the box with the pineapple.`
  //         );
  //         this.gameState.pineappleWasDestroyed = true;
  //       } else {
  //         this.userInterface.messageLog.appendText(
  //           `${this.getActorName(actor)} detroyed a box.`
  //         );
  //       }
  //       break;
  //     case TileType.TreeStump:
  //       this.userInterface.messageLog.appendText(
  //         "This box is already destroyed."
  //       );
  //       break;
  //     default:
  //       this.userInterface.messageLog.appendText("There is no box here!");
  //       break;
  //   }
  // }

  // catchPlayer(actor: Actor): void {
  //   this.userInterface.messageLog.appendText(
  //     "Continue with 'spacebar' or 'return'."
  //   );
  //   this.userInterface.messageLog.appendText(
  //     `Game over - you were captured by ${this.getActorName(actor)}!`
  //   );
  //   this.gameState.playerWasCaught = true;
  // }

  static delay(delayInMs: number): Promise<any> {
    return new Promise((resolve) =>
      setTimeout(() => {
        return resolve(true);
      }, delayInMs)
    );
  }
}
