import { EntityBase } from "./entities/entity";
import { TreeSpecies } from "./entities/tree/tree-species";
import { Game } from "./game";
import { Point } from "./point";
import { World } from "miniplex";
import {
  generateId,
  getItemFromRange,
  getNumberFromRange,
} from "./misc-utility";
import { RNG } from "rot-js";
import { Segment, TreeBranch } from "./manager-trees";

// handle spawning, updating, and rendering of tree branches
export class SystemBranches {
  constructor() {}

  public static add(species: TreeSpecies): EntityBase {
    let added: EntityBase = {
      branches: [],
      branchesPerSegment: getNumberFromRange(
        species.maxBranchesPerSegment,
        species.maxBranchesPerSegmentRange
      ),
      branchSegmentWidth: getNumberFromRange(
        species.branchSegmentWidthMin,
        species.branchSegmentWidthRange
      ),
      branchSegmentHeight: getNumberFromRange(
        species.branchSegmentHeightMin,
        species.branchSegmentHeightRange
      ),
      branchChance: species.branchChance,
      curve: 80 + RNG.getUniform() * 20,
      curveDirection: SystemBranches.resetCurveDir(),
      totalSegments: 0,
    };
    return added;
  }

  public static growTrunk(tree: EntityBase): boolean {
    // console.log("species", species, species?.trunkSegmentCount);
    const species = TreeSpecies.treeSpecies[tree.species];
    const trunkSegmentCount = species?.trunkSegmentCount || 0;
    const trunkSegments = tree.trunk.segments;

    // add one trunk
    // or add one branch to a single existing branch
    if (trunkSegments?.length < trunkSegmentCount) {
      let lastSegment = trunkSegments[trunkSegments.length - 1];
      let width: number;
      let length: number;
      let x1: number;
      let y1: number;
      let segmentOrder: number;

      if (!lastSegment) {
        width = tree.trunkSegmentWidth;
        length = tree.trunkSegmentHeight;
        x1 = 0;
        y1 = -1; // offset by 1 pixel to hide any seams between trunk and base
        segmentOrder = 0;
      } else {
        width = lastSegment.width;
        length = lastSegment.length;
        x1 = lastSegment.x2;
        y1 = lastSegment.y2;
        segmentOrder = lastSegment.segmentOrder + 1;
      }
      tree.curveDirection = SystemBranches.resetCurveDir();
      tree.curve = SystemBranches.getCurveAtSegment(
        tree.curve,
        tree.curveDirection,
        species
      );
      width *= species.trunkSegmentWidthDegrade;
      if (width < tree.trunkSegmentWidth) width = tree.trunkSegmentWidth;
      if (length < tree.trunkSegmentHeight) length = tree.trunkSegmentHeight;
      let x2 = x1 + SystemBranches.lengthdir_x(length, tree.curve);
      let y2 = y1 - SystemBranches.lengthdir_y(length, tree.curve);
      let newSegment: Segment = {
        position: new Point(x1, y1),
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        curve: tree.curve,
        length: length,
        width: width,
        segmentOrder,
      };
      tree.trunk.segments.push(newSegment);
      return true;
    }
    return false;
  }

  public static growBranch(
    growthStep: number,
    branch: TreeBranch,
    tree: EntityBase,
    species: TreeSpecies
  ): boolean {
    const maxSegmentCount = branch.isTrunk
      ? species.trunkSegmentCount
      : species.branchSegmentCount;
    if (branch.segments.length < maxSegmentCount) {
      let lastSegment = branch.segments[branch.segments.length - 1];
      tree.curve = SystemBranches.getCurveAtSegment(
        lastSegment.curve,
        tree.curveDirection,
        species
      );
      let newSegment = SystemBranches.addSegment(lastSegment, tree, species);
      branch.segments.push(newSegment);
      tree.curveDirection = SystemBranches.resetCurveDir();
      tree.curve = SystemBranches.getCurveAtSegment(
        tree.curve,
        tree.curveDirection,
        species
      );
      return true;
    }
    return false;
  }

  public static growBranches(growthStep: number, tree: EntityBase): boolean {
    const species = TreeSpecies.treeSpecies[tree.species];
    let growSuccess = false;
    if (tree.branches.length === 0) {
      // there are no branches to grow
      // add a branch to the trunk
      let newBranch = SystemBranches.addBranch(
        growthStep,
        tree.trunk,
        tree,
        species
      );
      if (newBranch) {
        tree.branches.push(newBranch);
        return true;
      }
    }

    if (!tree.trunk.doneBranching && tree.branchChance > 0) {
      // trunk is not done branching, so let's try adding a new branch to the trunk
      let newBranch = SystemBranches.addBranch(
        growthStep,
        tree.trunk,
        tree,
        species
      );
      // branch.doneBranching = branch.branchCount > tree.branchesPerSegment;
      if (newBranch) {
        tree.branches.push(newBranch);
        return true;
      }
    }

    // extend a branch
    for (let branch of tree.branches) {
      if (branch.doneExtending) {
        continue;
      }
      growSuccess = SystemBranches.growBranch(
        growthStep,
        branch,
        tree,
        species
      );
      if (growSuccess) {
        branch.doneExtending = SystemBranches.isDoneExtending(branch, species);
        return true;
      }
    }

    // no success growing existing branches, so let's try adding a new branch
    // to an existing segment of an existing branch
    if (tree.branchChance > 0) {
      // console.log("add new branch");
      for (let i = 0; i < tree.branches.length; i++) {
        // start at the bottom of the tree for better looking branching
        // let branch = RNG.getItem(tree.branches);
        let branch = tree.branches[i];
        let newBranch = SystemBranches.addBranch(
          growthStep,
          branch,
          tree,
          species
        );
        if (newBranch) {
          tree.branches.push(newBranch);
          return true;
        }
      }
    }
    return false;
  }

  public static addSegment(
    lastSegment: Segment,
    tree: EntityBase,
    species: TreeSpecies
  ): Segment {
    if (lastSegment.width <= species.branchSegmentWidthMin) {
      return null;
    }
    let width = lastSegment.width;
    let length = lastSegment.length;
    let x1 = lastSegment.x2;
    let y1 = lastSegment.y2;
    let segmentOrder = lastSegment.segmentOrder + 1;
    width *= species.branchSegmentWidthDegrade;
    if (width < tree.branchSegmentWidth) width = tree.branchSegmentWidth;
    if (length < tree.branchSegmentHeight) length = tree.branchSegmentHeight;
    // tree.curveDirection = this.resetCurveDir();
    // tree.curve = this.getCurveAtFork(
    //   lastSegment.curve,
    //   tree.curveDirection, // reset in step above
    //   species
    // );
    let x2 = x1 + SystemBranches.lengthdir_x(length, tree.curve);
    let y2 = y1 - SystemBranches.lengthdir_y(length, tree.curve);
    let newSegment: Segment = {
      position: new Point(x1, y1),
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      curve: tree.curve,
      length: length,
      width: width,
      segmentOrder,
    };
    tree.totalSegments++;
    return newSegment;
  }

  public static addBranch(
    growthStep: number,
    branch: TreeBranch,
    tree: EntityBase,
    species: TreeSpecies
  ): TreeBranch {
    // add branch
    // add first segment to branch
    // that way growBranches can always assume to have a branch and a lastSegment
    if (!branch) {
      return null; // no branch to add to
    }
    if (branch.doneBranching) {
      return null; // branch is done branching
    }
    if (branch.segments === undefined) {
      return null; // branch is empty
    }
    if (branch.segments?.length < 3) {
      return null; // branch is too short to add a new branch
    }
    if (!branch.isTrunk && branch.branchCount > tree.branchesPerSegment) {
      return null; // branch has too many branches
    }
    if (branch.isTrunk && branch.branchCount > species.trunkMaxBranches) {
      return null; // limit trunk branching
    }

    let lastSegment: Segment;
    if (branch.isTrunk) {
      lastSegment = branch.segments[branch.segments.length - 1];
    } else {
      lastSegment = getItemFromRange(
        branch.segments,
        1,
        branch.segments.length - 2
      );
    }
    tree.curveDirection = SystemBranches.resetCurveDir();
    tree.curve = SystemBranches.getCurveAtFork(
      lastSegment.curve,
      tree.curveDirection, // reset in step above
      species
    );
    let newSegment = SystemBranches.addSegment(lastSegment, tree, species);
    let newBranch: TreeBranch = {
      id: generateId(),
      segments: [newSegment],
      doneExtending: false,
      doneBranching: false,
      branchOrder: 0,
      branchCount: 0,
    };
    newBranch.doneBranching =
      RNG.getUniform() > tree.branchChance && tree.branchChance <= 0;
    tree.curveDirection = SystemBranches.resetCurveDir(); // reset curve dir
    tree.curve = SystemBranches.getCurveAtSegment(
      lastSegment.curve,
      tree.curveDirection,
      species
    ); // set new curve angle
    tree.branchChance -= species.branchChanceDegrade; // grow branch chance every time tree grows
    branch.branchCount++;
    branch.doneBranching = SystemBranches.isDoneBranching(branch, species);
    return newBranch;
  }

  public static isDoneBranching(
    branch: TreeBranch,
    species: TreeSpecies
  ): boolean {
    // don't flip doneBranching flag if already set to false- it shouldn't suddenly start growing again
    if (!branch.doneBranching) {
      if (branch.isTrunk) {
        return branch.branchCount > species.trunkMaxBranches;
      } else {
        return branch.branchCount > species.maxBranchesPerSegment;
      }
    }
    return branch.doneBranching;
  }

  public static isDoneExtending(
    branch: TreeBranch,
    species: TreeSpecies
  ): boolean {
    return branch.segments.length >= species.branchSegmentCount;
  }

  public static lengthdir_x(length: number, direction: number): number {
    return length * Math.cos((direction * Math.PI) / 180);
  }

  public static lengthdir_y(length: number, direction: number): number {
    return length * Math.sin((direction * Math.PI) / 180);
  }

  public static resetCurveDir() {
    return RNG.getUniform() > 0.5 ? 1 : -1;
  }

  public static getCurveAtFork(
    lastCurve: number,
    curveDir: number,
    species: TreeSpecies
  ) {
    return (
      lastCurve +
      (species.branchForkMin + RNG.getUniform() * species.branchForkRange) *
        curveDir
    );
  }

  public static getCurveAtSegment(
    lastCurve: number,
    curveDir: number,
    species: TreeSpecies
  ) {
    return lastCurve + RNG.getUniform() * species.branchCurveAngle * curveDir;
  }
}
