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
  trunkLength?: number;
  branchLength?: number;
  trunkSegmentHeight?: number;
  trunkSegmentWidthMin?: number;
  trunkSegmentWidthRange?: number;
  trunkWidthDegrade?: number;
  maxBranchesPerSegment?: number;
  maxBranchesPerSegmentRange?: number;
  branchChance?: number;
  branchChanceGrow?: number;

  minBranchWidth?: number;
  minBranchLength?: number;
  branchWidthDegrade?: number;
  branchLengthDegrade?: number;
  branchBendAmount?: number;
  branchForkMin?: number;
  branchForkRange?: number;
  minTrunkBaseSize?: number;
  leafMinCount?: number;
  maxLeafCount?: number;
  leafCountRange?: number;
  leafMinSize?: number;
  leafSizeRange?: number;
  leafDensity?: number;
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

  public trunkLength: number;
  public branchLength: number;
  public trunkSegmentHeight: number;
  public trunkSegmentWidthMin: number;
  public trunkSegmentWidthRange: number;
  public trunkWidthDegrade: number;
  public maxBranchesPerSegment: number;
  public maxBranchesPerSegmentRange: number;
  public branchChance: number;
  public branchChanceGrow: number;
  public minBranchWidth: number;
  public minBranchLength: number;
  public branchWidthDegrade: number;
  public branchLengthDegrade: number;
  public branchBendAmount: number;
  public branchForkMin: number;
  public branchForkRange: number;
  public minTrunkBaseSize: number;
  public maxLeafCount: number;
  public leafMinCount: number;
  public leafCountRange: number;
  public leafMinSize: number;
  public leafSizeRange: number;
  public leafDensity: number;
  public leafDistance: number;
  public maxLeafAlpha: number;
  public minLeafAlpha: number;
  public leafCoverageAngle: number;

  constructor(species: TreeSpeciesDef) {
    this.id = species.id; // id of the tree species
    this.name = species.name; // name of the tree species
    this.iconPath = species.iconPath; // path to the icon representing the tree species
    // this.textureSet = species.textureSet; // textures for different parts of the tree
    this.growthOptions = species.growthOptions; // growth options for the tree species
    this.trunkLength = species.trunkLength || 6; // length of the trunk
    this.branchLength = species.branchLength || 1.3 * Tile.plantSize; // length of the branches
    this.trunkSegmentHeight = species.trunkSegmentHeight || 4; // height of each trunk segment
    this.trunkSegmentWidthMin = species.trunkSegmentWidthMin || 6; // width of each trunk segment
    this.trunkSegmentWidthRange = species.trunkSegmentWidthRange || 3; // random range added to trunk segment width
    this.trunkWidthDegrade = species.trunkWidthDegrade || 0.86; // degradation factor for trunk width
    this.maxBranchesPerSegment = species.maxBranchesPerSegment || 2; // maximum number of branches one branch can split into
    this.maxBranchesPerSegmentRange = species.maxBranchesPerSegmentRange || 2; // random range added to maxBranchesPerSegment
    this.branchChance = species.branchChance || 3; // starting chance of branching
    this.branchChanceGrow = species.branchChanceGrow || 2; // how much the chance of branching increases per segment
    this.minBranchWidth = species.minBranchWidth || 1; // minimum width of branch
    this.minBranchLength = species.minBranchLength || 2; // minimum length of branch
    this.branchWidthDegrade = species.branchWidthDegrade || 0.92; // degradation factor for branch width
    this.branchLengthDegrade = species.branchLengthDegrade || 0.82; // degradation factor for branch length
    this.branchBendAmount = species.branchBendAmount || 10; // amount of bend in each branch
    this.branchForkMin = species.branchForkMin || 20; // minimum angle of branch
    this.branchForkRange = species.branchForkRange || 30; // range of angle of branch
    this.minTrunkBaseSize = species.minTrunkBaseSize || 2; // minimum number of segments without branches
    this.leafMinSize = species.leafMinSize || 1.5; // minimum size of each leaf
    this.leafSizeRange = species.leafSizeRange || 4; // range of sizes for each leaf
    this.leafDensity = species.leafDensity || 4; // density of leaves on each branch/segment
    this.leafDistance = species.leafDistance || 1.1; // distance from the end of the branch where leaves are generated
    this.leafMinCount = species.leafMinCount || 4; // minimum number of leaves per branch/branch end
    this.maxLeafCount = species.maxLeafCount || 250; // maximum number of leaves on the entire tree
    this.leafCountRange = species.leafCountRange || 7; // random range added to leaf count
    this.maxLeafAlpha = species.maxLeafAlpha || 1; // maximum opacity of leaves
    this.minLeafAlpha = species.minLeafAlpha || 0.2; // minimum opacity of leaves
    this.leafCoverageAngle = species.leafCoverageAngle || 360; // angle at which the leaves cover the branch
    this.textureSet = {
      // textures for different parts of the tree
      trunk: TreeSpecies.generateSpeciesTextures(species.textureSet.trunk),
      branch: TreeSpecies.generateSpeciesTextures(species.textureSet.branch),
      trunkBase: TreeSpecies.generateSpeciesTextures(
        species.textureSet.trunkBase
      ),
      leaf: TreeSpecies.generateSpeciesTextures(species.textureSet.leaf),
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
        trunkLength: 4,
        trunkSegmentWidthMin: 2,
        trunkSegmentWidthRange: 0,
        trunkWidthDegrade: 0.95,
        branchWidthDegrade: 0.91,
        minTrunkBaseSize: 3,
        minBranchWidth: 0.75,
        // branchChance: 1,
        // branchChanceGrow: 0.1,
        branchBendAmount: 10,
        branchForkMin: 15,
        branchForkRange: 30,
        leafDistance: 0.9,
        leafSizeRange: 2,
        leafMinSize: 0.8,
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
