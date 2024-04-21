import { RNG } from "rot-js/lib/index";
import { Player } from "./entities/player";
import { Point } from "./point";
import { Shrub } from "./entities/shrub";
import { Actor } from "./entities/actor";
import { Person } from "./entities/person";
import { GameState } from "./game-state";
import { InputUtility } from "./input-utility";
import { Tile, TileType } from "./tile";
import { MapWorldCellular } from "./map-world-cellular";
import { UserInterface } from "./user-interface";
import { Animal } from "./entities/animal";
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

export class Game {
  // starting options
  public options = {
    shouldAutotile: true,
    shouldRender: true,
    showClouds: true,
    animateShadows: true,
    entityCount: 5,
    treeCount: 50,
    gameSize: {
      width: 200,
      height: 200,
    },
    dayStart: true,
    // gameSeed: 1234,
    // gameSeed: 610239,
    gameSeed: null,
    turnAnimDelay: 500, // two turns per second (1 second / 500ms anim phase = 2)
    mainLoopRate: 1000 / 60, // run main loop at 60 fps (all other loops are lower than this)
    refreshRate: 1000 / 60, // 60 fps
    gameLoopRate: 1000 / 10, // how many times to run the game loop (still limited by turnAnimDelay)
    uiLoopRate: 1000 / 10,
    maxTickRate: 1000 / 60, // 60 game updates per second max
    minTickRate: 1000 / 4, // 2 game updates per second min
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
  private lastMainLoopTime: number;
  private lastRenderTime: number;
  private lastuiRefreshTime: number;
  private lastGameLoopTime: number;
  private gameLoopDelay: number = 0; // how long to delay the game loop for (like when animations are playing)

  constructor() {
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
    await this.initializeGame();
    return true;
  }

  public start() {
    requestAnimationFrame(this.mainLoop.bind(this));
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

  private async initializeGame(): Promise<boolean> {
    await this.userInterface.init();
    this.gameState.reset();

    this.map.generateMap(
      this.options.gameSize.width,
      this.options.gameSize.height
    );
    this.generatePlants();
    this.generateBeings();

    return true;
  }

  private async mainLoop(now: number) {
    if (!this.lastMainLoopTime) {
      this.lastMainLoopTime = now;
    }
    if (!this.lastGameLoopTime) {
      this.lastGameLoopTime = now;
    }
    if (!this.lastRenderTime) {
      this.lastRenderTime = now;
    }
    if (!this.lastuiRefreshTime) {
      this.lastuiRefreshTime = now;
    }
    let elapsed = now - this.lastMainLoopTime;

    // only check loops during mainLoop updates to prevent excessive calls
    if (elapsed > this.options.mainLoopRate) {
      if (this.options.shouldRender) {
        elapsed = now - this.lastRenderTime;
        if (elapsed > this.options.refreshRate) {
          if (this.gameLoopDelay > 0 && !this.timeManager.isPaused) {
            this.gameLoopDelay -= elapsed * this.timeManager.timeScale;
          }
          if (this.gameLoopDelay < 0) {
            this.gameLoopDelay = 0;
          }
          await this.renderLoop(now);
          this.lastRenderTime = now;
        }
      }

      elapsed = now - this.lastuiRefreshTime;
      if (elapsed > this.options.uiLoopRate) {
        await this.uiRefresh(now);
        this.lastuiRefreshTime = now;
      }

      if (!this.timeManager.isPaused) {
        elapsed = now - this.lastGameLoopTime;
        // number of game loop ticks increase at higher speeds to prevent waiting on game loop
        // otherwise, animations finish before the next actor action is ready
        const scaledLoopRate = clamp(
          this.options.gameLoopRate / this.timeManager.timeScale,
          this.options.maxTickRate,
          this.options.minTickRate
        );
        if (elapsed > scaledLoopRate) {
          if (this.gameLoopDelay <= 0) {
            this.gameLoopDelay = 0;
            await this.gameLoop();
            this.gameLoopDelay = this.options.turnAnimDelay;
            this.timeManager.startTurnAnimation();
          }
          this.lastGameLoopTime = now;
        }
      }
    }

    this.lastMainLoopTime = now;
    requestAnimationFrame(this.mainLoop.bind(this));
  }

  private async gameLoop() {
    const turn = this.timeManager.currentTurn;
    let actor: Actor;
    // loop through ALL actors each turn
    while (turn === this.timeManager.currentTurn) {
      actor = this.timeManager.nextOnSchedule();
      if (actor) {
        actor.plan();
        if (actor.action) {
          this.timeManager.setDuration(actor.action.durationInTurns);
          await actor.act();
        }
      } else {
        console.log("ERROR: no actor found in game loop");
        break;
      }
    }

    this.map.lightManager.clearLightMap();
    this.map.lightManager.interpolateAmbientLight();

    this.map.shadowMap.turnUpdate();
    this.map.cloudMap.turnUpdate();
    // update dynamic lights after all actors have moved
    // will get picked up in next render
    this.map.lightManager.clearChangedDynamicLights();
    this.map.lightManager.updateDynamicLighting();

    if (this.gameState.isGameOver()) {
      await InputUtility.waitForInput(
        this.userInterface.HandleInputConfirm.bind(this)
      );
      await this.initializeGame();
    }
  }

  private async renderLoop(now: number) {
    const elapsed = now - this.lastRenderTime;
    const deltaTime = elapsed / 1000; // time elapsed in seconds

    this.timeManager.renderUpdate(deltaTime, this.gameLoopDelay);

    // console.log("rendering");
    this.userInterface.camera.renderUpdate(deltaTime);
    this.map.shadowMap.renderUpdate(deltaTime);
    this.map.cloudMap.renderUpdate(deltaTime);
    this.map.lightManager.renderUpdate(deltaTime);

    this.animManager.animUpdate(deltaTime);

    this.userInterface.renderUpdate(deltaTime);
  }

  private async uiRefresh(now: number) {
    requestAnimationFrame(this.uiRefresh.bind(this));

    if (!this.lastuiRefreshTime) {
      this.lastuiRefreshTime = now;
    }
    const elapsed = now - this.lastuiRefreshTime;
    const deltaTime = elapsed / 1000; // time elapsed in seconds

    if (elapsed > this.options.uiLoopRate) {
      // loop through all ui components and run a refresh on them
      this.userInterface.components.refreshComponents();
      this.lastuiRefreshTime = now;
    }
  }

  private generatePlants(): void {
    this.plants = [];
    let positions = this.map.getRandomTilePositions(
      Biomes.Biomes.moistdirt.id,
      this.options.treeCount
    );
    for (let position of positions) {
      this.plants.push(new Shrub(this, position));
    }
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
    let entityQuarter = Math.ceil(this.options.entityCount / 4);
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
          entityQuarter * 2
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.hillshigh.id,
          entityQuarter
        )
      );
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.hillslow.id,
          entityQuarter
        )
      );
    }

    console.log("got positions", positions);
    // this.player = new Player(this, positions.splice(0, 1)[0]);
    for (let position of positions) {
      this.spawnRandomEntity(position);
    }
    this.userInterface.components.updateSideBarContent(
      "Entities",
      this.entities
    );
  }

  private spawnRandomEntity(pos: Point): Actor {
    let entity: Actor;
    if (RNG.getUniform() < 0.5) {
      entity = new Person(this, pos);
      // entity = new Animal(this, pos);
    } else {
      entity = new Animal(this, pos);
    }
    this.entities.push(entity);
    this.timeManager.addToSchedule(entity, true);
    this.renderer.addToScene(
      entity.position,
      Layer.ENTITY,
      entity.tile.spritePath
    );
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
