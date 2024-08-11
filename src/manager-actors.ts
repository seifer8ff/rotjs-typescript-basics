import { RNG } from "rot-js/lib/index";
import { Actor } from "./entities/actor";

import { Game } from "./game";
import { Layer } from "./renderer";
import { generateId } from "./misc-utility";
import { Point } from "./point";
import { GameSettings } from "./game-settings";
import { BiomeId, Biomes } from "./biomes";
import { Cow } from "./entities/cow";
import { Tile, TileSubType, TileType } from "./tile";
import { SharkBlue } from "./entities/shark-blue";
import { Seagull } from "./entities/seagull";
import { Mushroom } from "./entities/mushroom";
import { Tree } from "./entities/tree/tree";
import {
  TreeSpecies,
  TreeSpeciesEnum,
  TreeSpeciesID,
} from "./entities/tree/tree-species";
import { Shrub } from "./entities/shrub";
import { Query, World } from "miniplex";
import { ComponentType, EntityBase } from "./entities/entity";
import { EntityBuilder } from "./entity-builder";

export class ManagerActors {
  public allActors: Actor[]; // all actors, including actor, trees, and anything else not tilemap based
  public actors: Actor[];
  public trees: Tree[];
  public shrubs: Shrub[]; // not considered an actor as tilemap based
  private landBiomes: BiomeId[];
  private waterBiomes: BiomeId[];
  private airBiomes: BiomeId[];
  private shrubBiomes: BiomeId[];
  private world: World<EntityBase>;

  // queries
  private allShrubs: Query<EntityBase>;

  constructor(private game: Game) {
    this.allActors = [];
    this.actors = [];
    this.trees = [];
    this.shrubs = [];
    this.landBiomes = [
      Biomes.Biomes.moistdirt.id,
      Biomes.Biomes.hillsmid.id,
      Biomes.Biomes.hillshigh.id,
      Biomes.Biomes.valley.id,
      Biomes.Biomes.snowhillshillsmid.id,
      Biomes.Biomes.snowmoistdirt.id,
    ];
    this.waterBiomes = [Biomes.Biomes.ocean.id, Biomes.Biomes.oceandeep.id];
    this.airBiomes = [...this.landBiomes, Biomes.Biomes.ocean.id];
    this.shrubBiomes = [Biomes.Biomes.moistdirt.id];
    this.world = new World<EntityBase>();
    this.allShrubs = this.world
      .with(ComponentType.subType)
      .where(({ subType }) => subType === TileSubType.Shrub);
  }

  public addInitialActors(): void {
    this.addAnimals();
    this.addPlants();
  }

  getRandomActorPositions(subtype: TileSubType, quantity: number = 1): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (let actor of this.allActors) {
      if (actor.subType === subtype) {
        buffer.push(actor.position);
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  public getRandomTreePositions(
    species: TreeSpeciesID,
    quantity: number = 1
  ): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (let tree of this.trees) {
      if (tree.species.id === species) {
        buffer.push(tree.position);
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  public getActorsAt(x: number, y: number): Actor[] {
    return this.allActors.filter(
      (actor) => actor.position.x === x && actor.position.y === y
    );
  }

  private addAnimals(): void {
    for (let i = 0; i < GameSettings.options.spawn.inputs.cowCount; i++) {
      this.spawnActor(Cow);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.sharkCount; i++) {
      this.spawnActor(SharkBlue);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.seagullCount; i++) {
      this.spawnActor(Seagull);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.mushroomCount; i++) {
      this.spawnActor(Mushroom);
    }

    this.game.renderer.renderChunkedLayers(
      [Layer.ENTITY],
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      new Point(
        Math.floor(GameSettings.options.gameSize.width / 2),
        Math.floor(GameSettings.options.gameSize.height / 2)
      )
    );
    this.game.userInterface.components.updateSideBarContent(
      "Entities",
      this.actors
    );
  }

  private addPlants(): void {
    const quarter = Math.floor(GameSettings.options.spawn.inputs.treeCount / 4);
    for (let i = 0; i < GameSettings.options.spawn.inputs.treeCount; i++) {
      let type: TreeSpeciesID;
      type =
        i < quarter
          ? TreeSpeciesEnum.PINE
          : i < quarter * 2
          ? TreeSpeciesEnum.BIRCH
          : i < quarter * 3
          ? TreeSpeciesEnum.COTTONCANDY
          : TreeSpeciesEnum.MAPLE;
      this.spawnTree(Tree, TreeSpecies.treeSpecies[type]);
    }
    for (let i = 0; i < GameSettings.options.spawn.inputs.shrubCount; i++) {
      this.spawnShrub();
    }
  }

  private spawnActor<ActorWithSubtype extends Actor>(classType: {
    new (game: Game, pos: Point): ActorWithSubtype;
    subType?: TileSubType;
  }): Actor {
    let pos: Point;
    let actor: Actor;
    switch (classType.subType) {
      case TileSubType.Animal:
        // get a random position in biome
        pos = this.game.map.getRandomTilePositions(this.landBiomes, 1, true)[0];
        break;
      case TileSubType.Fish:
        pos = this.game.map.getRandomTilePositions(
          this.waterBiomes,
          1,
          false
        )[0];
        break;
      case TileSubType.Bird:
        pos = this.game.map.getRandomTilePositions(this.airBiomes, 1, true)[0];
        break;
      default:
        pos = this.game.map.getRandomTilePositions(this.landBiomes, 1, true)[0];
        break;
    }
    if (pos) {
      actor = new classType(this.game, pos);
      this.actors.push(actor);
      this.allActors.push(actor);
      this.game.timeManager.addToSchedule(actor, true);
      actor.draw();
    }

    return actor;
  }

  private spawnTree<TreeWithSubtype extends Tree>(
    classType: {
      new (game: Game, pos: Point, species: TreeSpecies): TreeWithSubtype;
      subType?: TileSubType;
    },
    species: TreeSpecies
  ): Tree {
    let pos: Point;
    let actor: Tree;
    let biomes: BiomeId[];
    switch (species.id) {
      case TreeSpeciesEnum.PINE:
        biomes = [Biomes.Biomes.moistdirt.id];
        break;
      case TreeSpeciesEnum.BIRCH:
        biomes = [Biomes.Biomes.hillsmid.id, Biomes.Biomes.hillshigh.id];
        break;
      case TreeSpeciesEnum.COTTONCANDY:
        biomes = [Biomes.Biomes.valley.id];
        break;
      case TreeSpeciesEnum.MAPLE:
        biomes = [Biomes.Biomes.snowhillshillsmid.id];
        break;
      default:
        biomes = [Biomes.Biomes.moistdirt.id];
        break;
    }
    pos = this.game.map.getRandomTilePositions(biomes, 1, true, true)[0];
    if (pos) {
      actor = new classType(this.game, pos, species);
      this.trees.push(actor);
      this.allActors.push(actor);
      this.game.timeManager.addToSchedule(actor, true);
      actor.draw();
    }
    return actor;
  }

  // private spawnShrub<ShrubWithSubtype extends Shrub>(classType: {
  //   new (game: Game, pos: Point): ShrubWithSubtype;
  //   subType?: TileSubType;
  // }): Shrub {
  //   let pos: Point;
  //   let actor: Shrub;
  //   pos = this.game.map.getRandomTilePositions(
  //     this.shrubBiomes,
  //     1,
  //     true,
  //     true
  //   )[0];
  //   if (pos) {
  //     actor = new classType(this.game, pos);
  //     this.shrubs.push(actor);
  //     actor.draw();
  //   }
  //   return actor;
  // }

  private spawnShrub(): EntityBase {
    let pos: Point;
    let actor: EntityBase;
    pos = this.game.map.getRandomTilePositions(
      this.shrubBiomes,
      1,
      true,
      true
    )[0];
    if (pos) {
      console.log("shrubPos", pos);
      // actor = new EntityBuilder(this.world)
      //   .addPosition(pos.x, pos.y)
      //   .addName("Shrub")
      //   .build();
      // builder method is too heavyweight, especially for adding components during runtime
      actor = this.world.add({
        id: generateId(),
        position: pos,
        // name: "Shrub",
        tile: Tile.shrub.id,
        subType: TileSubType.Shrub,
        type: TileType.Plant,
      });
      this.world.addComponent(actor, ComponentType.name, "Shrub");
    }
    return actor;
  }

  public getShrubs(): Query<EntityBase> {
    return this.allShrubs;
  }
}
