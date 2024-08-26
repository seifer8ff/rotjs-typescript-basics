import { EntityBase } from "./entities/entity";
import { TreeSpecies } from "./entities/tree/tree-species";
import { getItemFromRange, getNumberFromRange } from "./misc-utility";
import { RNG } from "rot-js";
import { Sprite } from "pixi.js";
import { Segment } from "./manager-trees";
import { SystemBranches } from "./system-branches";

export interface Leaf {
  branchId: number;
  sprite: Sprite;
}

// handle spawning, updating, and rendering of tree leaves
export class SystemLeaves {
  constructor() {}

  public init(): void {}

  public static add(species: TreeSpecies): EntityBase {
    let added: EntityBase = {
      leaves: new Map<number, Sprite[]>(),
      leafDistance: species.leafDistance,
      leafSize: getNumberFromRange(species.leafMinSize, species.leafSizeRange),
      leavesPerSegment: getNumberFromRange(
        species.leavesPerSegmentMin,
        species.leavesPerSegmentRange
      ),
      leafDensity: 1,
    };
    return added;
  }

  public static addLeaves(
    segment: Segment,
    leaves: Sprite[],
    leavesPerSegment: number,
    leafSize: number,
    leafDensity: number,
    species: TreeSpecies
  ): Sprite[] {
    let leaf: Sprite;
    let angle: number;
    let distance: number;
    let rotation: number;
    let leafCount: number = Math.round(leavesPerSegment * leafDensity);
    const initialRotation = RNG.getUniform() * 360;

    for (let i: number = 0; i < leafCount; i++) {
      leaf = new Sprite(getItemFromRange(species.textureSet.leaf));
      angle = RNG.getUniform() * species.leafCoverageAngle;
      // increase the distance by the number of branches
      distance =
        RNG.getUniform() * species.branchSegmentCount * species.leafDistance;
      rotation =
        angle + RNG.getUniform() * 2 * initialRotation - initialRotation;
      leaf.anchor.set(0.5);
      leaf.position.set(
        segment.x2 + SystemBranches.lengthdir_x(distance, angle),
        segment.y2 - SystemBranches.lengthdir_y(distance, angle)
      );
      leaf.rotation = rotation;
      leaf.width = leafSize;
      leaf.height = leafSize;

      leaves.push(leaf);
    }
    segment.leavesRendered = true;
    return leaves;
  }
}
