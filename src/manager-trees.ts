import { EntityBase } from "./entities/entity";
import { TreeSpecies, TreeSpeciesEnum } from "./entities/tree/tree-species";
import { Game } from "./game";
import { BiomeId, Biomes } from "./biomes";
import { Point } from "./point";
import { World } from "miniplex";
import { generateId, getNumberFromRange } from "./misc-utility";
import { TileSubType, TileType } from "./tile";
import { SystemBranches } from "./system-branches";
import { SystemLeaves } from "./system-leaves";
import { SystemTreeRenderer } from "./system-tree-renderer";
import { Layer } from "./renderer";

export interface Segment {
  position: Point;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  curve: number;
  length: number;
  width: number;
  segmentOrder: number; // resets to 0 for each branch
  rendered?: boolean;
  leavesRendered?: boolean;
}

export interface TreeBranch {
  id: number;
  segments: Segment[];
  doneExtending: boolean;
  doneBranching: boolean;
  branchOrder: number;
  branchCount: number; // how many times does this branch, branch
  isTrunk?: boolean;
}

export class ManagerTrees {
  constructor(private game: Game, private world: World) {}

  public init(): void {}

  public spawn(species: TreeSpecies): EntityBase {
    let pos: Point;
    let actor: EntityBase;
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
      // console.log("tree pos", pos);
      let trunkBaseTextureIndex =
        SystemTreeRenderer.getRandomTrunkBaseTexture(species);
      let trunkTextureIndex = SystemTreeRenderer.getRandomTrunkTexture(species);
      let entityProps: EntityBase = {
        id: generateId(),
        name: "Tree",
        position: pos,
        collider: true,
        subType: TileSubType.Tree,
        type: TileType.Plant,
        species: species.id,
        renderable: SystemTreeRenderer.generateBaseSprite(
          this.game,
          pos,
          species,
          trunkBaseTextureIndex
        ),
        growthStep: 0,
        trunk: {
          id: generateId(),
          segments: [],
          doneExtending: false,
          doneBranching: false,
          branchOrder: 0,
          branchCount: 0,
          isTrunk: true,
        },
        trunkTextureIndex: trunkTextureIndex,
        branchTextureIndex: SystemTreeRenderer.getRandomTrunkTexture(species),
        trunkSegmentWidth: getNumberFromRange(
          species.trunkSegmentWidthMin,
          species.trunkSegmentWidthRange
        ),
        trunkSegmentHeight: getNumberFromRange(
          species.trunkSegmentHeightMin,
          species.trunkSegmentHeightRange
        ),
        ...SystemBranches.add(species),
        ...SystemLeaves.add(species),
      };
      actor = this.world.add(entityProps);
      this.game.collisionManager.occupyTile(
        actor.position.x,
        actor.position.y,
        Layer.PLANT,
        actor.id
      );
      this.game.timeManager.addToSchedule(actor, true);
    }
    return actor;
  }

  public growTree(tree: EntityBase): boolean {
    // console.log("-- curve in growth func: ", tree.curve);
    let growSuccess = false;
    growSuccess = SystemBranches.growTrunk(tree);
    if (growSuccess) {
      // only sort on trunk growth- otherwise buggy for leaves
      tree.renderable?.sortChildren();
    }
    if (!growSuccess) {
      growSuccess = SystemBranches.growBranches(0, tree);
    }
    if (tree.trunk.segments.length) {
    }
    return growSuccess;
  }

  public drawTree(tree: EntityBase): void {
    const {
      renderable,
      trunk,
      branches,
      leaves,
      species,
      trunkTextureIndex,
      branchTextureIndex,
      leavesPerSegment,
      leafSize,
      leafDensity,
    } = tree;
    const treeSpecies = TreeSpecies.treeSpecies[species];
    SystemTreeRenderer.renderTrunk(
      trunk,
      renderable,
      treeSpecies,
      trunkTextureIndex
    );

    SystemTreeRenderer.renderBranches(
      branches,
      renderable,
      treeSpecies,
      branchTextureIndex
    );

    SystemTreeRenderer.renderLeaves(
      branches,
      leaves,
      renderable,
      treeSpecies,
      leavesPerSegment,
      leafSize,
      leafDensity
    );
  }
}
