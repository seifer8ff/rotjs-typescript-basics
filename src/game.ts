import { Scheduler, KEYS, RNG } from "rot-js/lib/index";
import Simple from "rot-js/lib/scheduler/simple";

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
import Action from "rot-js/lib/scheduler/action";
import { MapWorld } from "./map-world";
import { TimeManager } from "./time-manager";
import { GeneratorNames } from "./generator-names";
import { BiomeId, Biomes } from "./biomes";
import { TileStats } from "./web-components/tile-info";
import Simplex from "rot-js/lib/noise/simplex";
import Noise from "rot-js/lib/noise/noise";
import { ManagerAnimation } from "./manager-animation";

export class Game {
  // starting options
  public options = {
    shouldAutotile: true,
    shouldRender: true,
    showClouds: true,
    animateShadows: true,
    entityCount: 50,
    treeCount: 50,
    gameSize: {
      width: 200,
      height: 200,
    },
    dayStart: true,
    // gameSeed: 1234,
    // gameSeed: 610239,
    gameSeed: null,
    maxTurnDelay: 96,
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

  private treePoint: Point;

  private lastRenderTime: number;
  private msPerFrame: number = 1000 / 60; // desired interval is 60fps

  private lastuiRefreshTime: number;
  private msPerUiRefresh: number = 1000 / 2; // desired interval is 1000 ms / runs per second

  private lastGameLoopTime: number;
  private msPerLoop: number = 1000 / 2; // desired interval is 1000 ms / runs per second

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
    requestAnimationFrame(this.gameLoop.bind(this));
    if (this.options.shouldRender) {
      requestAnimationFrame(this.renderLoop.bind(this));
      requestAnimationFrame(this.uiRefresh.bind(this));
    }
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
    return this.isMapBlocked(x, y);
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

  private async gameLoop(now: number) {
    if (!this.lastGameLoopTime) {
      this.lastGameLoopTime = now;
    }
    const elapsed = now - this.lastGameLoopTime;

    if (elapsed > this.msPerLoop / this.timeManager.timeScale) {
      const turn = this.timeManager.currentTurn;
      let actor: Actor;
      if (!this.timeManager.isPaused) {
        // loop through ALL actors each turn
        while (turn === this.timeManager.currentTurn) {
          actor = this.timeManager.nextOnSchedule();
          if (actor) {
            // console.log("about to actor.plan", actor);
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
        // console.log(
        //   "gameDelay",
        //   this.options.maxTurnDelay / this.timeManager.timeScale
        // );
        await Game.delay(
          this.options.maxTurnDelay / this.timeManager.timeScale
        );
      }

      if (this.gameState.isGameOver()) {
        await InputUtility.waitForInput(
          this.userInterface.HandleInputConfirm.bind(this)
        );
        await this.initializeGame();
      }
      this.lastGameLoopTime = now;
    }
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private async renderLoop(now: number) {
    requestAnimationFrame(this.renderLoop.bind(this));

    if (!this.lastRenderTime) {
      this.lastRenderTime = now;
    }
    const elapsed = now - this.lastRenderTime;
    const deltaTime = elapsed / 1000; // time elapsed in seconds

    if (elapsed > this.msPerFrame) {
      // console.log("rendering");
      this.userInterface.camera.renderUpdate(deltaTime);
      this.map.shadowMap.renderUpdate(deltaTime);
      this.map.cloudMap.renderUpdate(deltaTime);
      this.map.lightManager.renderUpdate(deltaTime);

      this.animManager.animUpdate(deltaTime);

      this.userInterface.renderUpdate(deltaTime);
      this.lastRenderTime = now;
    }
  }

  private async uiRefresh(now: number) {
    requestAnimationFrame(this.uiRefresh.bind(this));

    if (!this.lastuiRefreshTime) {
      this.lastuiRefreshTime = now;
    }
    const elapsed = now - this.lastuiRefreshTime;
    const deltaTime = elapsed / 1000; // time elapsed in seconds

    if (elapsed > this.msPerUiRefresh) {
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
    this.treePoint = positions[0];
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
    this.renderer.addToScene(entity.position, Layer.ENTITY, entity.tile.sprite);
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
