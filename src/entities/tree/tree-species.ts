import { Sprite, Texture } from "pixi.js";
import { Tile } from "../../tile";

// textures, including variations, for tree
export interface TreeTextureSet {
  trunk: Texture[];
  branch: Texture[];
  trunkBase: Texture[];
  leaf: Texture[];
}

// paths to textures
export interface TreeTextureSetDef {
  trunk: string[];
  branch: string[];
  trunkBase: string[];
  leaf: string[];
}

export interface PlantSpecies {
  id: string;
  name: string;
  iconPath: string;
  textureSet: TreeTextureSet;
  growthOptions: PlantGrowthOptions;
}

export interface TreeSpeciesDef {
  id: string;
  name: string;
  iconPath: string;
  textureSet: {
    trunk: string[];
    branch: string[];
    trunkBase: string[];
    leaf: string[];
  };
  growthOptions: PlantGrowthOptions;
  trunkSegmentCount?: number;
  branchSegmentCount?: number;
  trunkSegmentHeightMin?: number;
  trunkSegmentHeightRange?: number;
  trunkSegmentWidthMin?: number;
  trunkSegmentWidthRange?: number;
  trunkSegmentWidthDegrade?: number;
  maxBranchesPerSegment?: number;
  maxBranchesPerSegmentRange?: number;
  branchChance?: number;
  branchChanceGrow?: number;

  branchSegmentWidthMin?: number;
  branchSegmentWidthRange?: number;
  branchSegmentWidthDegrade?: number;
  branchSegmentHeightMin?: number;
  branchSegmentHeightRange?: number;
  branchSegmentHeightDegrade?: number;
  branchCurveAngle?: number;
  branchForkMin?: number;
  branchForkRange?: number;
  minTrunkBaseSize?: number;
  leavesPerBranchMin?: number;
  maxLeafCount?: number;
  leavesPerBranchRange?: number;
  leafMinSize?: number;
  leafSizeRange?: number;
  leavesPerBranchDensity?: number;
  leafDistance?: number;

  minLeafAlpha?: number;
  maxLeafAlpha?: number;
  leafCoverageAngle?: number;
}

export interface PlantGrowthOptions {
  temperature: {
    min: number;
    max: number;
  };
  moisture: {
    min: number;
    max: number;
  };
  height: {
    min: number;
    max: number;
  };
  light: {
    min: number;
    max: number;
  };
}

export class TreeSpecies {
  static treeSpecies: {
    [id: string]: TreeSpecies;
  } = {};
  public id: string;
  public name: string;
  public iconPath: string;
  public textureSet: TreeTextureSet;
  public growthOptions: {
    temperature: {
      min: number;
      max: number;
    };
    moisture: {
      min: number;
      max: number;
    };
    height: {
      min: number;
      max: number;
    };
    light: {
      min: number;
      max: number;
    };
  };

  public trunkSegmentCount: number;
  public branchSegmentCount: number;
  public trunkSegmentHeightMin: number;
  public trunkSegmentHeightRange: number;
  public trunkSegmentWidthMin: number;
  public trunkSegmentWidthRange: number;
  public trunkWidthDegrade: number;
  public maxBranchesPerSegment: number;
  public maxBranchesPerSegmentRange: number;
  public branchChance: number;
  public branchChanceGrow: number;
  public branchSegmentWidthMin: number;
  public branchSegmentWidthRange: number;
  public branchSegmentWidthDegrade: number;
  public branchSegmentHeightMin: number;
  public branchSegmentHeightRange: number;
  public branchSegmentHeightDegrade: number;
  public branchCurveAngle: number;
  public branchForkMin: number;
  public branchForkRange: number;
  public minTrunkBaseSize: number;
  public leavesPerBranchMin: number;
  public leavesPerBranchRange: number;
  public leavesPerBranchDensity: number;
  public leafDistance: number;
  public leafMinSize: number;
  public leafSizeRange: number;
  public maxLeafAlpha: number;
  public minLeafAlpha: number;
  public leafCoverageAngle: number;

  constructor(options: TreeSpeciesDef) {
    this.id = options.id; // id of the tree species
    this.name = options.name; // name of the tree species
    this.iconPath = options.iconPath; // path to the icon representing the tree species
    this.growthOptions = options.growthOptions; // growth options for the tree species
    this.trunkSegmentCount =
      options.trunkSegmentCount !== undefined ? options.trunkSegmentCount : 6; // length of the trunk
    this.branchSegmentCount =
      options.branchSegmentCount !== undefined ? options.branchSegmentCount : 9; // segments in each branch (segments can have different lengths and widths)
    this.trunkSegmentHeightMin =
      options.trunkSegmentHeightMin !== undefined
        ? options.trunkSegmentHeightMin
        : 6; // height of each trunk segment
    this.trunkSegmentHeightRange =
      options.trunkSegmentHeightRange !== undefined
        ? options.trunkSegmentHeightRange
        : 3; // random range added to trunk segment height
    this.trunkSegmentWidthMin =
      options.trunkSegmentWidthMin !== undefined
        ? options.trunkSegmentWidthMin
        : 6; // width of each trunk segment
    this.trunkSegmentWidthRange =
      options.trunkSegmentWidthRange !== undefined
        ? options.trunkSegmentWidthRange
        : 3; // random range added to trunk segment width
    this.trunkWidthDegrade =
      options.trunkSegmentWidthDegrade !== undefined
        ? options.trunkSegmentWidthDegrade
        : 0.86; // degradation factor for trunk width
    this.maxBranchesPerSegment =
      options.maxBranchesPerSegment !== undefined
        ? options.maxBranchesPerSegment
        : 2; // maximum number of branches one branch can split into
    this.maxBranchesPerSegmentRange =
      options.maxBranchesPerSegmentRange !== undefined
        ? options.maxBranchesPerSegmentRange
        : 2; // random range added to maxBranchesPerSegment
    this.branchChance =
      options.branchChance !== undefined ? options.branchChance : 1; // starting chance of branching
    this.branchChanceGrow =
      options.branchChanceGrow !== undefined ? options.branchChanceGrow : -0.1; // how much the chance of branching increases per segment
    this.branchSegmentWidthMin =
      options.branchSegmentWidthMin !== undefined
        ? options.branchSegmentWidthMin
        : 1; // minimum width of branch
    this.branchSegmentWidthRange =
      options.branchSegmentWidthRange !== undefined
        ? options.branchSegmentWidthRange
        : 2; // range of width of branches
    this.branchSegmentHeightMin =
      options.branchSegmentHeightMin !== undefined
        ? options.branchSegmentHeightMin
        : 2; // minimum length of branch
    this.branchSegmentHeightRange =
      options.branchSegmentHeightRange !== undefined
        ? options.branchSegmentHeightRange
        : 2; // range of length of branches
    this.branchSegmentWidthDegrade =
      options.branchSegmentWidthDegrade !== undefined
        ? options.branchSegmentWidthDegrade
        : 0.92; // degradation factor for branch width
    this.branchSegmentHeightDegrade =
      options.branchSegmentHeightDegrade !== undefined
        ? options.branchSegmentHeightDegrade
        : 0.82; // degradation factor for branch length
    this.branchCurveAngle =
      options.branchCurveAngle !== undefined ? options.branchCurveAngle : 10; // angle at which each branch curves
    this.branchForkMin =
      options.branchForkMin !== undefined ? options.branchForkMin : 20; // minimum angle of branch from the parent branch
    this.branchForkRange =
      options.branchForkRange !== undefined ? options.branchForkRange : 30; // range of angle of branch
    this.minTrunkBaseSize =
      options.minTrunkBaseSize !== undefined ? options.minTrunkBaseSize : 2; // minimum number of segments without branches
    this.leafMinSize =
      options.leafMinSize !== undefined ? options.leafMinSize : 11; // minimum size of each leaf
    this.leafSizeRange =
      options.leafSizeRange !== undefined ? options.leafSizeRange : 8; // range of sizes for each leaf
    this.leavesPerBranchDensity =
      options.leavesPerBranchDensity !== undefined
        ? options.leavesPerBranchDensity
        : 1; // density of leaves on each branch/segment
    this.leafDistance =
      options.leafDistance !== undefined ? options.leafDistance : 1.1; // distance from the end of the branch where leaves are generated
    this.leavesPerBranchMin =
      options.leavesPerBranchMin !== undefined
        ? options.leavesPerBranchMin
        : 20; // minimum number of leaves per branch/branch end
    this.leavesPerBranchRange =
      options.leavesPerBranchRange !== undefined
        ? options.leavesPerBranchRange
        : 30; // random range added to leaf count
    this.maxLeafAlpha =
      options.maxLeafAlpha !== undefined ? options.maxLeafAlpha : 1; // maximum opacity of leaves
    this.minLeafAlpha =
      options.minLeafAlpha !== undefined ? options.minLeafAlpha : 0.2; // minimum opacity of leaves
    this.leafCoverageAngle =
      options.leafCoverageAngle !== undefined ? options.leafCoverageAngle : 360; // angle at which the leaves cover the branch
    this.textureSet = {
      // textures for different parts of the tree
      trunk: TreeSpecies.generateSpeciesTextures(options.textureSet.trunk),
      branch: TreeSpecies.generateSpeciesTextures(options.textureSet.branch),
      trunkBase: TreeSpecies.generateSpeciesTextures(
        options.textureSet.trunkBase
      ),
      leaf: TreeSpecies.generateSpeciesTextures(options.textureSet.leaf),
    };
    console.log("new tree species", this);
  }

  static generateSpeciesTextures(paths: string[]) {
    return paths.map((path) => {
      const sprite = Sprite.from(path);
      const texture = sprite?.texture;
      if (sprite) {
        sprite.destroy();
      }
      return texture;
    });
  }

  static processTreeSpecies() {
    if (TreeSpecies.treeSpecies.length) return;
    const speciesDefs: TreeSpeciesDef[] = [
      {
        id: "pine",
        name: "Pine",
        iconPath: "tree_00",
        textureSet: {
          trunk: ["trunk_00", "trunk_01", "trunk_02"],
          branch: ["trunk_00", "trunk_01", "trunk_02"],
          trunkBase: ["trunk_base_pine"],
          leaf: [
            "leaf_pine_00",
            "leaf_pine_01",
            "leaf_pine_02",
            "leaf_pine_03",
          ],
        },
        growthOptions: {
          temperature: {
            min: 0,
            max: 100,
          },
          moisture: {
            min: 0,
            max: 100,
          },
          height: {
            min: 0,
            max: 100,
          },
          light: {
            min: 0,
            max: 100,
          },
        },
      },
      {
        id: "birch",
        name: "Birch",
        iconPath: "tree_01",
        textureSet: {
          trunk: ["trunk_03"],
          branch: ["trunk_03"],
          trunkBase: ["trunk_base_birch"],
          leaf: ["leaf_birch_00", "leaf_birch_01", "leaf_birch_02"],
        },
        growthOptions: {
          temperature: {
            min: 0,
            max: 100,
          },
          moisture: {
            min: 0,
            max: 100,
          },
          height: {
            min: 0,
            max: 100,
          },
          light: {
            min: 0,
            max: 100,
          },
        },
        trunkSegmentCount: 4,
        trunkSegmentHeightMin: 5,
        trunkSegmentHeightRange: 3,
        trunkSegmentWidthMin: 4,
        trunkSegmentWidthRange: 3,
        trunkSegmentWidthDegrade: 0.98,

        minTrunkBaseSize: 3,
        branchSegmentHeightMin: 4,
        branchSegmentHeightRange: 8,
        branchSegmentHeightDegrade: 0.95,
        branchSegmentWidthDegrade: 0.93,
        branchSegmentWidthMin: 0.81,
        branchSegmentWidthRange: 0,
        branchChance: 1,
        branchChanceGrow: -0.28,
        maxBranchesPerSegment: 2,
        maxBranchesPerSegmentRange: 1,
        branchCurveAngle: 5,
        branchForkMin: 12,
        branchForkRange: 8,
        leafDistance: 1.8,
        leavesPerBranchMin: 25,
        leavesPerBranchRange: 10,
        leavesPerBranchDensity: 1.3,
        leafSizeRange: 6,
        leafMinSize: 8,
      },
      {
        id: "maple",
        name: "Maple",
        iconPath: "tree_01",
        textureSet: {
          trunk: ["trunk_03"],
          branch: ["trunk_03"],
          trunkBase: ["trunk_base_birch"],
          leaf: ["leaf_maple_00", "leaf_maple_01", "leaf_maple_02"],
        },
        growthOptions: {
          temperature: {
            min: 0,
            max: 100,
          },
          moisture: {
            min: 0,
            max: 100,
          },
          height: {
            min: 0,
            max: 100,
          },
          light: {
            min: 0,
            max: 100,
          },
        },
      },
      {
        id: "cottoncandy",
        name: "Cotton Candy",
        iconPath: "tree_01",
        textureSet: {
          trunk: ["trunk_03"],
          branch: ["trunk_03"],
          trunkBase: ["trunk_base_birch"],
          leaf: ["leaf_pink_00", "leaf_pink_01", "leaf_pink_02"],
        },
        growthOptions: {
          temperature: {
            min: 0,
            max: 100,
          },
          moisture: {
            min: 0,
            max: 100,
          },
          height: {
            min: 0,
            max: 100,
          },
          light: {
            min: 0,
            max: 100,
          },
        },
      },
    ];

    speciesDefs.forEach((speciesDef) => {
      TreeSpecies.treeSpecies[speciesDef.id] = new TreeSpecies(speciesDef);
    });
  }
}
