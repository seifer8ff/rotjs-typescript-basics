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
import { Renderer } from "./renderer";
import Action from "rot-js/lib/scheduler/action";
import { MapWorld } from "./map-world";
import { TimeManager } from "./time-manager";
import { GeneratorNames } from "./generator-names";
import { BiomeId, Biomes } from "./biomes";
import { TileStats } from "./web-components/tile-info";
import Simplex from "rot-js/lib/noise/simplex";

export class Game {
  // starting options
  public entityCount = 20;
  public treeCount = 50;
  public shouldAutotile = true;
  public shouldRender = true;
  public showCloudmap = true;
  public dayStart = true;
  public gameSize = {
    width: 200,
    height: 200,
  };
  public useSeed = true;
  public gameSeed = 1234;
  public noise;

  public map: MapWorld;
  public player: Player;
  public entities: Actor[];
  public plants: Actor[];
  public gameState: GameState;
  public renderer: Renderer;
  public timeManager: TimeManager;
  public userInterface: UserInterface;
  public nameGenerator: GeneratorNames;

  private treePoint: Point;

  private lastRenderTime: number;
  private msPerFrame: number = 1000 / 60; // desired interval is 60fps

  private lastGameLoopTime: number;
  private msPerLoop: number = 1000 / 2; // desired interval is 1000 ms / runs per second

  constructor() {
    if (this.useSeed) {
      RNG.setSeed(this.gameSeed);
    }
    this.noise = new Simplex(this.gameSeed);
    this.entities = [];
    this.plants = [];

    this.timeManager = new TimeManager(this);
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
    if (this.shouldRender) {
      requestAnimationFrame(this.renderLoop.bind(this));
    }

    // this.userInterface.components.overlay.generateBiomeOverlay(
    //   this.map.terrainMap,
    //   this.gameSize.width,
    //   this.gameSize.height,
    //   "Terrain"
    // );

    // this.userInterface.components.overlay.generateOverlay(
    //   this.map.polesMap.magnetismMap,
    //   this.gameSize.width,
    //   this.gameSize.height,
    //   "Magnetism"
    // );

    // this.userInterface.components.overlay.generateOverlay(
    //   this.map.tempMap.tempMap,
    //   this.gameSize.width,
    //   this.gameSize.height,
    //   "Temperature"
    // );

    // this.userInterface.components.overlay.generateGradientOverlay(
    //   this.map.tempMap.tempMap,
    //   this.gameSize.width,
    //   this.gameSize.height,
    //   "Temperature",
    //   { min: "blue", max: "red" }
    // );

    // this.userInterface.components.overlay.generateOverlay(
    //   this.map.moistureMap.moistureMap,
    //   this.gameSize.width,
    //   this.gameSize.height,
    //   "Moisture"
    // );

    this.userInterface.components.overlay.generateOverlay(
      this.map.heightMap,
      this.gameSize.width,
      this.gameSize.height,
      "Height"
    );

    this.userInterface.components.overlay.generateOverlay(
      this.map.sunMap.sunMap,
      this.gameSize.width,
      this.gameSize.height,
      "Sunlight"
    );

    this.userInterface.components.overlay.generateBiomeOverlay(
      this.map.biomeMap,
      this.gameSize.width,
      this.gameSize.height,
      "Biomes"
    );
  }

  isMapBlocked(x: number, y: number): boolean {
    return !this.map.isPassable(x, y);
  }

  isOccupiedByEntity(x: number, y: number): boolean {
    return this.entities.some(
      (entity) => entity.position.x === x && entity.position.y === y
    );
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

  getInfoAt(x: number, y: number): TileStats {
    return {
      height: this.map.heightMap[MapWorld.coordsToKey(x, y)],
      magnetism: this.map.polesMap.magnetismMap[MapWorld.coordsToKey(x, y)],
      temperature: this.map.tempMap.tempMap[MapWorld.coordsToKey(x, y)],
      moisture: this.map.moistureMap.moistureMap[MapWorld.coordsToKey(x, y)],
      sunlight: this.map.sunMap.sunMap[MapWorld.coordsToKey(x, y)],
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

    this.map.generateMap(this.gameSize.width, this.gameSize.height);
    this.generatePlants();

    this.generateBeings();

    this.userInterface.refreshPanel();

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
        // update dynamic lights after all actors have moved
        // will get picked up in next render
        this.map.lightManager.clearChangedDynamicLights();
        this.map.lightManager.updateDynamicLighting();
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

  private renderLoop(now: number) {
    requestAnimationFrame(this.renderLoop.bind(this));

    if (!this.lastRenderTime) {
      this.lastRenderTime = now;
    }
    const elapsed = now - this.lastRenderTime;
    const deltaTime = elapsed / 1000; // time elapsed in seconds

    if (elapsed > this.msPerFrame) {
      // console.log("rendering");
      this.userInterface.camera.update(deltaTime);
      this.map.lightManager.clearLightMap();
      this.map.lightManager.calculateLightLevel();
      this.map.lightManager.calculateLighting(deltaTime);
      this.map.sunMap.update(deltaTime);
      this.userInterface.refreshPanel();
      this.lastRenderTime = now;
    }
  }

  private generatePlants(): void {
    this.plants = [];
    let positions = this.map.getRandomTilePositions(
      Biomes.Biomes.moistdirt.id,
      this.treeCount
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
    let positions = this.map.getRandomTilePositions(
      Biomes.Biomes.moistdirt.id,
      this.entityCount
    );
    console.log("got positions", positions);
    // this.player = new Player(this, positions.splice(0, 1)[0]);
    for (let position of positions) {
      // this.entities.push(new Animal(this, position));
      if (RNG.getUniform() < 0.5) {
        this.entities.push(new Person(this, position));
      } else {
        this.entities.push(new Animal(this, position));
      }
    }
    for (let entity of this.entities) {
      this.timeManager.addToSchedule(entity, true);
    }
    this.userInterface.components.updateSideBarContent(
      "Entities",
      this.entities
    );
    // const entityMenuItems = this.entities.map((entity) => {
    //   return this.userInterface.components.mapEntityToMenuItem(entity);
    // });
    // this.userInterface.components.sideMenu.setTabContent(
    //   "Entities",
    //   entityMenuItems
    // );
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
