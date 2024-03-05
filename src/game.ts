import { Scheduler, KEYS, RNG } from "rot-js/lib/index";
import Simple from "rot-js/lib/scheduler/simple";

import { Player } from "./entities/player";
import { Point } from "./point";
import { Shrub } from "./entities/shrub";
import { Actor } from "./entities/actor";
import { Person } from "./entities/person";
import { GameState } from "./game-state";
import { InputUtility } from "./input-utility";
import { BiomeType, Tile, TileType } from "./tile";
import { MapWorldCellular } from "./map-world-cellular";
import { UserInterface } from "./user-interface";
import { Animal } from "./entities/animal";
import { Renderer } from "./renderer";
import Action from "rot-js/lib/scheduler/action";
import { MapWorld } from "./map-world";
import { TimeManager } from "./time-manager";
import { GeneratorNames } from "./generator-names";

export class Game {
  public entityCount = 20;
  public treeCount = 50;
  public gameSize: { width: number; height: number };
  public mapSize: { width: number; height: number };
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
    // RNG.setSeed(1234);

    // sensible default
    // let width = 350;
    // let height = 350;
    let width = 200;
    let height = 200;
    let fontSize = 20;

    // how/why should this change?
    fontSize = 20;

    this.gameSize = { width: width, height: height };
    this.mapSize = { width: this.gameSize.width, height: this.gameSize.height };
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
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  mapIsPassable(x: number, y: number): boolean {
    return this.map.isPassable(x, y);
  }

  occupiedByEntity(x: number, y: number): boolean {
    for (let enemy of this.entities) {
      if (enemy.position.x == x && enemy.position.y == y) {
        return true;
      }
    }
    return false;
  }

  getPlayerPosition(): Point | undefined {
    return this.player?.position;
  }

  getTileType(x: number, y: number): TileType {
    return this.map.getTileType(x, y);
  }

  getTerrainTileAt(x: number, y: number): Tile {
    return this.map.getTile(x, y);
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

  getRandomTilePositions(type: BiomeType, quantity: number = 1): Point[] {
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

    this.map.generateMap(this.mapSize.width, this.mapSize.height);
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
      this.userInterface.camera.update(deltaTime);
      this.map.lightManager.clearLightMap();
      this.map.lightManager.calculateLightLevel();
      this.map.lightManager.calculateLighting(deltaTime);
      this.userInterface.refreshPanel();
      this.lastRenderTime = now;
    }
  }

  // private calculateDynamicLighting() {
  //   // if night, calculate fov for entities
  //   if (this.timeManager.isNighttime) {
  //     for (let entity of this.entities) {
  //       this.map.lightManager.UpdateFOV(entity);
  //     }
  //   }
  //   // when render loop gets called later, it will use updated lightmap
  // }

  // private calculateLighting() {
  //   // this.map.lightManager.lightEmitters.clearLights();
  //   // this.map.lightManager.lightEmitters.setLight(12, 12, [240, 240, 30]);
  //   // this.map.lightManager.lightEmitters.setLight(20, 20, [240, 60, 60]);
  //   // this.map.lightManager.lightEmitters.setLight(45, 25, [200, 200, 200]);
  //   if (this.timeManager.isNighttime) {
  //     for (let entity of this.entities) {
  //       this.map.lightManager.lightEmitters.setLight(
  //         entity.position.x,
  //         entity.position.y,
  //         this.map.lightManager.lightDefaults.torchBright
  //       );
  //     }
  //   }
  //   //update lightmap object
  //   this.map.lightManager.calculateLighting();
  // }

  private getActorName(actor: Actor): string {
    switch (actor.type) {
      case TileType.Player:
        return `Player`;
      case TileType.Entity:
        return `%c{${actor.tile.color}}Entity%c{}`;
      case TileType.Plant:
        return `%c{${actor.tile.color}}Plant%c{}`;
      default:
        return "unknown actor";
    }
  }

  private generatePlants(): void {
    this.plants = [];
    let positions = this.map.getRandomTilePositions(
      Tile.Biomes.grassland.biome,
      this.treeCount
    );
    for (let position of positions) {
      this.plants.push(new Shrub(this, position));
    }
    this.treePoint = positions[0];
  }

  private generatePlayer(): void {
    const pos = this.map.getRandomTilePositions(
      Tile.Biomes.grassland.biome,
      1
    )[0];
    this.player = new Player(this, pos);
  }

  private generateBeings(): void {
    this.entities = [];
    let positions = this.map.getRandomTilePositions(
      Tile.Biomes.grassland.biome,
      this.entityCount
    );
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

  checkBox(x: number, y: number): void {
    switch (this.map.getTileType(x, y)) {
      case Tile.shrub.type:
        this.map.setTile(x, y, Tile.cutTree);
        this.userInterface.statusLine.boxes += 1;
        if (this.treePoint.x == x && this.treePoint.y == y) {
          this.userInterface.messageLog.appendText(
            "Continue with 'spacebar' or 'return'."
          );
          this.userInterface.messageLog.appendText(
            "Hooray! You found a pineapple."
          );
          this.gameState.foundPineapple = true;
        } else {
          this.userInterface.messageLog.appendText("This box is empty.");
        }
        break;
      case Tile.cutTree.type:
        this.map.setTile(x, y, Tile.treeStump);
        this.userInterface.messageLog.appendText("You destroy this box!");
        break;
      case Tile.treeStump.type:
        this.userInterface.messageLog.appendText(
          "This box is already destroyed."
        );
        break;
      default:
        this.userInterface.messageLog.appendText("There is no box here!");
        break;
    }
  }

  destroyBox(actor: Actor, x: number, y: number): void {
    switch (this.map.getTileType(x, y)) {
      case TileType.Plant:
      case TileType.CutTree:
        this.map.setTile(x, y, Tile.treeStump);
        if (this.treePoint.x == x && this.treePoint.y == y) {
          this.userInterface.messageLog.appendText(
            "Continue with 'spacebar' or 'return'."
          );
          this.userInterface.messageLog.appendText(
            `Game over - ${this.getActorName(
              actor
            )} detroyed the box with the pineapple.`
          );
          this.gameState.pineappleWasDestroyed = true;
        } else {
          this.userInterface.messageLog.appendText(
            `${this.getActorName(actor)} detroyed a box.`
          );
        }
        break;
      case TileType.TreeStump:
        this.userInterface.messageLog.appendText(
          "This box is already destroyed."
        );
        break;
      default:
        this.userInterface.messageLog.appendText("There is no box here!");
        break;
    }
  }

  catchPlayer(actor: Actor): void {
    this.userInterface.messageLog.appendText(
      "Continue with 'spacebar' or 'return'."
    );
    this.userInterface.messageLog.appendText(
      `Game over - you were captured by ${this.getActorName(actor)}!`
    );
    this.gameState.playerWasCaught = true;
  }

  static delay(delayInMs: number): Promise<any> {
    return new Promise((resolve) =>
      setTimeout(() => {
        return resolve(true);
      }, delayInMs)
    );
  }
}
