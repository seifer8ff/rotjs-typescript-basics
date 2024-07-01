import { RNG } from "rot-js/lib/index";
import { Player } from "./entities/player";
import { Point } from "./point";
import { Shrub } from "./entities/shrub";
import { Tree } from "./entities/tree/tree";
import { TreeSpecies } from "./entities/tree/tree-species";
import { Actor } from "./entities/actor";
import { Person } from "./entities/person";
import { GameState, Stages } from "./game-state";
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
import GameStats from "gamestats.js";
import * as PIXI from "pixi.js";
import { positionToIndex } from "./misc-utility";
import { InitAssets } from "./assets";
import { GameSettings } from "./game-settings";

export class Game {
  // starting options
  public settings: GameSettings;
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
  public stats: GameStats;

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
    this.settings = new GameSettings();
    if ((window as any).scheduler) {
      this.scheduler = (window as any).scheduler;
    }
    console.log("this.scheduler", this.scheduler, window);
    this.ticker = Ticker.shared;
    this.ticker.autoStart = false;
    this.ticker.stop();
    if (GameSettings.options.gameSeed == undefined) {
      GameSettings.options.gameSeed = Math.floor(RNG.getUniform() * 1000000);
    }
    RNG.setSeed(GameSettings.options.gameSeed);
    console.log("Game seed:", GameSettings.options.gameSeed);
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
    this.stats = new GameStats();
    this.initStats();
  }

  public initStats(): void {
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
      this.userInterface.gameDisplay,
      options,
    ]);
    console.log("stats", this.stats);
  }

  public async Init(): Promise<boolean> {
    await this.initializeProceduralAssets();
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

  // convert and x,y position to an index in the spriteCache (and other) array
  public positionToIndex(x: number, y: number, layer: Layer): number {
    return positionToIndex(
      x,
      y,
      layer,
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height
    );
  }

  public indexToPosition(index: number, layer: Layer): Point {
    let x = 0;
    let y = 0;
    let ratio = 1;
    if (layer === Layer.PLANT) {
      ratio = Tile.size / Tile.plantSize;
    }
    y = Math.floor(index / (GameSettings.options.gameSize.width * ratio));
    x = index % (GameSettings.options.gameSize.width * ratio);
    return new Point(x, y);
  }

  private async initializeProceduralAssets(): Promise<boolean> {
    // load all sprites
    // generate Tilesets
    await InitAssets();

    // generate Tree Species definitions
    TreeSpecies.processTreeSpecies();
    return true;
  }

  private async addActors(): Promise<boolean> {
    this.generatePlants();
    this.generateBeings();
    return true;
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
    await this.addActors();
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
      if (this.postTurnWaitTime > 0 && !this.timeManager.isPaused) {
        this.postTurnWaitTime -= deltaTime * this.timeManager.timeScale;
      }
      if (this.postTurnWaitTime < 0) {
        this.postTurnWaitTime = 0;
      }

      if (!this.timeManager.isPaused && this.postTurnWaitTime <= 0) {
        this.gameLoop();
        this.postTurnWaitTime = GameSettings.options.turnAnimDelay;
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
    for (let plant of this.plants) {
      // instead of having the userinterface add the plant to the scene,
      // let each plant add itself, including branches and leaves
      // this simplifies multitile entities
      plant.draw();
    }
  }

  private drawEntities(): void {
    // this.game.renderer.clearLayer(Layer.ENTITY, true);
    for (let entity of this.entities) {
      entity.draw();
    }
  }

  private renderLoop(interpPercent: number) {
    this.stats?.begin();

    this.map.draw();

    this.userInterface.camera.renderUpdate(interpPercent);

    if (this.gameState.stage === Stages.Play) {
      this.timeManager.renderUpdate(this.postTurnWaitTime);

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
      const viewportInTiles = this.userInterface.camera.viewportUnpadded;
      this.renderer.renderChunkedLayers(
        [Layer.TERRAIN, Layer.ENTITY, Layer.PLANT, Layer.UI],
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

  private generatePlants(): void {
    this.plants = [];
    let positions: Point[] = [];

    positions = this.map.getRandomTilePositions(
      Biomes.Biomes.moistdirt.id,
      GameSettings.options.plants.shrubCount,
      true,
      true
    );
    console.log("shrub positions", positions);
    for (let position of positions) {
      this.plants.push(new Shrub(this, position));
    }

    let split = Math.ceil(GameSettings.options.plants.treeCount / 8);
    positions = [];
    if (GameSettings.options.plants.treeCount < 4) {
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.moistdirt.id,
          GameSettings.options.plants.treeCount,
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
    let entitySplit = Math.ceil(GameSettings.options.entities.entityCount / 8);
    let positions = [];
    if (GameSettings.options.entities.entityCount < 4) {
      positions.push(
        ...this.map.getRandomTilePositions(
          Biomes.Biomes.moistdirt.id,
          GameSettings.options.entities.entityCount
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

    // this.player = new Player(this, positions.splice(0, 1)[0]);
    for (let position of positions) {
      const biome = this.map.getBiome(position.x, position.y);
      this.spawnEntityInBiome(position, biome.id);
      // this.spawnRandomEntity(position);
    }

    // render the entity layer upon spawning entities
    // TODO: RENDER SPECIFIC POINTS UPON SPAWNING ADDITIONAL ENTITIES
    // this.renderer.renderLayers(
    //   [Layer.ENTITY],
    //   GameSettings.options.gameSize.width,
    //   GameSettings.options.gameSize.height,
    //   new Point(
    //     Math.floor(GameSettings.options.gameSize.width / 2),
    //     Math.floor(GameSettings.options.gameSize.height / 2)
    //   )
    // );
    this.renderer.renderChunkedLayers(
      [Layer.ENTITY],
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      new Point(
        Math.floor(GameSettings.options.gameSize.width / 2),
        Math.floor(GameSettings.options.gameSize.height / 2)
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

  static delay(delayInMs: number): Promise<any> {
    return new Promise((resolve) =>
      setTimeout(() => {
        return resolve(true);
      }, delayInMs)
    );
  }
}
