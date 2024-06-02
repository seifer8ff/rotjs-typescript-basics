import { Game } from "../game";
import { Actor, DescriptionBlock } from "./actor";
import { Point } from "../point";
import { Tile, TileSubType, TileType } from "../tile";
import { Action } from "../actions/action";
import { WaitAction } from "../actions/waitAction";
import { GrowAction } from "../actions/growAction";
import { Color, RNG } from "rot-js";
import TypeIcon from "../shoelace/assets/icons/person-vcard.svg";
import GoalIcon from "../shoelace/assets/icons/geo-alt.svg";
import ActionIcon from "../shoelace/assets/icons/sign-turn-slight-right.svg";
import PinIcon from "../shoelace/assets/icons/pin-map.svg";
import { Layer } from "../renderer";
import LSystem from "lindenmayer";
import {
  AnimatedSprite,
  Application,
  BLEND_MODES,
  BaseTexture,
  BlurFilter,
  Container,
  DisplayObject,
  Graphics,
  ParticleContainer,
  Rectangle,
  RenderTexture,
  Renderer,
  Sprite,
  Texture,
  autoDetectRenderer,
} from "pixi.js";
import { Color as ColorType } from "rot-js/lib/color";

export interface Branch {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  curve: number;
  length: number;
  width: number;
  leafCount: number;
  done: boolean;
  order: number;
  shadow?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

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

// export interface TreeGenerationOptions {
//   trunkLength: number;
//   branchLength: number;
//   trunkSegmentHeight: number;
//   trunkSegmentWidth: number;
//   trunkWidthDegrade: number;
//   maxBranchesPerSegment: number;
//   maxBranchesPerSegmentRange: number;
//   branchChance: number;
//   branchChanceGrow: number;
//   minBranchWidth: number;
//   minBranchLength: number;
//   branchWidthDegrade: number;
//   branchLengthDegrade: number;
//   branchBendAmount: number;
//   branchForkMin: number;
//   branchForkRange: number;
//   minTrunkBaseSize: number;
//   leafSize: number;
//   leafMinCount: number;
//   leafCountRange: number;
//   leafMinSize: number;
//   leafSizeRange: number;
//   leafDensity: number;
//   leafDistance: number;
//   leafAlpha: number;
//   leafEdgeAlpha: number;
//   leafCoverageAngle: number;
// }

// tree
// species
// temp min/max
// moisture min/max
// height min/max
// texture set (with variations inside it)

export interface PlantSpecies {
  id: string;
  name: string;
  iconPath: string;
  textureSet: TreeTextureSet;
  growthOptions: PlantGrowthOptions;
}

export interface PlantSpeciesDef {
  id: string;
  name: string;
  iconPath: string;
  textureSet: TreeTextureSetDef;
  growthOptions: PlantGrowthOptions;
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

export type LeafTextureSet = Texture[];

export class Tree implements Actor {
  static species: PlantSpecies[] = [];
  id: number;
  name?: string;
  tile: Tile;
  subType: TileSubType;
  type: TileType;
  goal: Action;
  action: Action;
  sprite: ParticleContainer;
  species: PlantSpecies;

  leafTextureSet: LeafTextureSet;
  trunkTexture: Texture;
  trunkBaseTexture: Texture;

  private trunkLength: number = 6;
  private branchLength: number = 1.3 * Tile.plantSize;
  // private branchLength: number = 3;
  private trunkSegmentHeight: number = 4;
  private trunkSegmentWidth: number = 6;
  private trunkWidthDegrade: number = 0.86;
  private maxBranchesPerSegment: number = 2; // how many branches one branch can split into
  private maxBranchesPerSegmentRange: number = 2; // random range added to maxBranchesPerSegment
  private branchChance: number = 3; // starting chance of branching
  private branchChanceGrow: number = 2; // how much the chance of branching increases per segment

  private minBranchWidth: number = 1; // minimum width of branch
  private minBranchLength: number = 2; // minimum length of branch
  private branchWidthDegrade: number = 0.92;
  private branchLengthDegrade: number = 0.82;
  private branchBendAmount: number = 10;
  private branchForkMin: number = 20; // minimum angle of branch
  private branchForkRange: number = 30; // range of angle of branch
  private minTrunkBaseSize: number = 2; // minimum number of segments without branches

  private leafSprites: Sprite[] = []; // array of leaf sprites (for easy removal)
  private maxLeafCount: number = 250; // maximum number of leaves on entire tree
  private leafSize: number; // final size of leaf;
  private leafMinCount: number = 4; // min number of leaves per branch/branch end
  private leafCountRange: number = 7; // random range added to leaf count
  private leafMinSize: number = 1.5;
  private leafSizeRange: number = 4;
  private leafDensity: number = 4; // how many leaves are generated per branch/segment
  private leafDistance: number = 1.1; // how far from the end of the branch the leaves are generated
  private maxLeafAlpha: number = 1;
  private minLeafAlpha: number = 0.2;
  private leafCoverageAngle: number = 360; // what angle the leaves cover (360 for all around branch, 180 for top of branch, etc)

  private growthStep = 0;
  private fullyGrown = false;
  private branchGrowthStep = 0;
  branches: { position: Point; branch: Branch }[] = [];

  constructor(
    private game: Game,
    public position: Point,
    public readonly speciesId: string
  ) {
    this.id = Date.now() + RNG.getUniformInt(0, 100000);
    this.tile = Tile.tree;
    this.type = this.tile.type;
    this.subType = TileSubType.Tree;
    this.species = Tree.species.find((s) => s.id === this.speciesId);
    this.name = `${this.subType} - ${this.species.name}`;

    const ratio = Tile.plantSize / Tile.size;
    const screenPos = this.game.userInterface.camera.TileToScreenCoords(
      this.position.x * ratio,
      this.position.y * ratio,
      Layer.TERRAIN
    );
    this.randomizeTrunkStyle();
    this.generatePixelTree(screenPos.x, screenPos.y);
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

  static processSpeciesDef(speciesDef: PlantSpeciesDef) {
    const species = {
      id: speciesDef.id,
      name: speciesDef.name,
      iconPath: speciesDef.iconPath,
      textureSet: {
        trunk: this.generateSpeciesTextures(speciesDef.textureSet.trunk),
        branch: this.generateSpeciesTextures(speciesDef.textureSet.branch),
        trunkBase: this.generateSpeciesTextures(
          speciesDef.textureSet.trunkBase
        ),
        leaf: this.generateSpeciesTextures(speciesDef.textureSet.leaf),
      },
      growthOptions: speciesDef.growthOptions,
    };
    Tree.species.push(species);
  }

  static processTreeSpecies() {
    if (Tree.species.length) return;

    const speciesDefs: PlantSpeciesDef[] = [
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
          leaf: ["leaf_pink_00", "leaf_pink_01"],
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
      this.processSpeciesDef(speciesDef);
    });
  }

  private randomizeTrunkStyle() {
    this.trunkBaseTexture =
      this.species.textureSet.trunkBase[
        RNG.getUniformInt(0, this.species.textureSet.trunkBase.length - 1)
      ];
    this.trunkTexture =
      this.species.textureSet.trunk[
        RNG.getUniformInt(0, this.species.textureSet.trunk.length - 1)
      ];
  }

  private generatePixelTree(x: number, y: number): void {
    // console.log("generate pixel tree");
    this.branches = [];

    // trunk
    let order = 0;
    let curve = 80 + RNG.getUniform() * 20;
    let width = this.trunkSegmentWidth + RNG.getUniform() * 3;
    let length = this.trunkSegmentHeight + RNG.getUniform() * 3;
    let x1 = x;
    let y1 = y;
    let x2 = x1 + this.lengthdir_x(length, curve);
    let y2 = y1 - this.lengthdir_y(length, curve);
    for (let i = 0; i < this.trunkLength; i++) {
      let newBranch = {
        position: new Point(x1, y1),
        branch: {
          x1: x1,
          y1: y1,
          x2: x2,
          y2: y2,
          curve: curve,
          length: length,
          width: width,
          done: false,
          leafCount: this.leafMinCount + RNG.getUniform() * this.leafCountRange,
          order: order,
        },
      };
      if (
        RNG.getUniform() * 100 > this.branchChance ||
        order < this.minTrunkBaseSize
      )
        newBranch.branch.done = true; // don't allow branching on first couple segments
      if (i > this.trunkLength - 2) newBranch.branch.done = false; // last 2 segment must branch
      this.branches.push(newBranch);
      curve +=
        RNG.getUniform() *
        this.branchBendAmount *
        (RNG.getUniform() > 0.5 ? 1 : -1);
      order++;
      this.branchChance += this.branchChanceGrow;
      width *= this.trunkWidthDegrade;
      if (width < this.minBranchWidth)
        width = this.minBranchWidth + RNG.getUniform() * 2;
      if (length < this.minBranchLength)
        length = this.minBranchLength + RNG.getUniform();
      x1 = x2;
      y1 = y2;
      x2 = x1 + this.lengthdir_x(length, curve);
      y2 = y1 - this.lengthdir_y(length, curve);
    }

    // branches
    let count = 0;
    const maxCount =
      this.maxBranchesPerSegment +
      RNG.getUniformInt(0, this.maxBranchesPerSegmentRange);
    for (let k = 0; k < maxCount; k++) {
      count = 0;
      const size = this.branches.length;
      for (let j = 0; j < size; j++) {
        const _b = this.branches[j];
        if (!_b.branch.done) {
          _b.branch.done = RNG.getUniform() > 0.5;
          let curve =
            _b.branch.curve +
            (this.branchForkMin + RNG.getUniform() * this.branchForkRange) *
              (RNG.getUniform() > 0.5 ? 1 : -1);
          let length = _b.branch.length;
          if (length < this.minBranchLength) length = this.minBranchLength;
          // let width = _b.branch.width / 2;
          let width = _b.branch.width;
          width *= this.branchWidthDegrade;
          if (width < this.minBranchWidth) width = this.minBranchWidth;
          let order = _b.branch.order;
          let x1 = _b.branch.x2;
          let y1 = _b.branch.y2;
          let x2 = x1 + this.lengthdir_x(length, curve);
          let y2 = y1 - this.lengthdir_y(length, curve);
          // create branch segments, with length this.branchLength
          for (let i = 0; i < this.branchLength; i++) {
            let newBranch = {
              position: new Point(x1, y1),
              branch: {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                curve: curve,
                length: length,
                width: width,
                done: false,
                leafCount:
                  this.leafMinCount + RNG.getUniform() * this.leafCountRange,
                order: order + 1,
              },
            };
            if (RNG.getUniform() * 100 > this.branchChance) {
              newBranch.branch.done = true;
            }

            if (j === size || count === maxCount) {
              newBranch.branch.done = false; // force leaves on the end of branches
            }
            this.branches.push(newBranch);

            // setup next loop
            curve +=
              RNG.getUniform() *
              this.branchBendAmount *
              (RNG.getUniform() > 0.5 ? 1 : -1);
            order++;
            width *= this.trunkWidthDegrade;
            if (width < this.minBranchWidth) {
              width = this.minBranchWidth;
            }
            length *= this.branchLengthDegrade;
            if (length < this.minBranchLength) {
              length = this.minBranchLength;
            }
            x1 = x2;
            y1 = y2;
            x2 = x1 + this.lengthdir_x(length, curve);
            y2 = y1 - this.lengthdir_y(length, curve);
          }
        }
      }
    }

    this.leafSize = this.leafMinSize + RNG.getUniform() * this.leafSizeRange;
    // this.branches.sort((a, b) => b.branch.order - a.branch.order);
    // generate sprite from branches
    this.generateSprite();
  }

  private generateSprite(growthSteps: number = 1): void {
    // add to existing sprite rather than clearing and redrawing
    const firstGrowth = this.growthStep === 0;
    const leafRot = RNG.getUniform() * 360;
    const ratio = Tile.size / Tile.plantSize;

    const tint = this.game.renderer.getTintForPosition(
      new Point(
        Math.floor(this.position.x / ratio), // get the light color of the larger tile
        Math.floor(this.position.y / ratio)
      )
    );

    // let sprite: Sprite;

    if (firstGrowth) {
      // this.sprite = new Container();
      // this.sprite = new ParticleContainer();
      this.sprite = new ParticleContainer(1000, {
        vertices: true,
        position: true,
        rotation: true,
        scale: true,
        tint: true,
      });
    }

    let totalSegmentCount = this.growthStep + growthSteps; // how many segments to add
    if (totalSegmentCount > this.branches.length) {
      totalSegmentCount = this.branches.length;
      this.fullyGrown = true;
    }

    for (let i = this.growthStep; i <= totalSegmentCount; i++) {
      const trunkBaseStep = this.growthStep === 2;

      let sprite: Sprite;
      const branch = this.branches[i];
      let isTrunk = false;
      if (branch) {
        isTrunk = branch.branch.order <= this.trunkLength;

        // draw trunk/branch
        if (isTrunk) {
          sprite = new Sprite(this.trunkTexture);
          // sprite = Sprite.from(this.trunkSpritePath);
        } else {
          // TODO: add branch sprite
          sprite = new Sprite(this.trunkTexture);
        }
        this.sprite.addChild(sprite);

        sprite.anchor.set(0.5);
        sprite.width = branch.branch.width * 1.1;
        sprite.height = branch.branch.length * 1.2; // hide gaps between segments
        sprite.position.set(
          branch.position.x - this.sprite.position.x,
          branch.position.y - this.sprite.position.y
        );
        sprite.angle = -branch.branch.curve + 90;
        sprite.tint = tint;

        if (trunkBaseStep) {
          // add a sprite for where the trunk meets the ground
          let trunkBaseSprite = new Sprite(this.trunkBaseTexture);
          this.sprite.addChild(trunkBaseSprite);
          trunkBaseSprite.anchor.set(0.5, 0);
          trunkBaseSprite.position.set(0, -22);
          trunkBaseSprite.width *= 1.2;
          trunkBaseSprite.height *= 1.2;
          trunkBaseSprite.tint = tint;
        }

        // add leafs to branches that are not done and are not trunk
        if (!branch.branch.done && !isTrunk) {
          let leafAlpha = this.maxLeafAlpha;
          for (let j = 0; j < branch.branch.leafCount * this.leafDensity; j++) {
            if (this.leafSprites.length >= this.maxLeafCount) break;
            leafAlpha -= 0.02;
            if (leafAlpha < this.minLeafAlpha) {
              leafAlpha = this.maxLeafAlpha;
            }
            let angle = RNG.getUniform() * this.leafCoverageAngle;
            let distance =
              RNG.getUniform() * this.branchLength * this.leafDistance;
            let leafX = branch.branch.x2 + this.lengthdir_x(distance, angle);
            let leafY = branch.branch.y2 - this.lengthdir_y(distance, angle);
            let leafRotation = angle + RNG.getUniform() * 2 * leafRot - leafRot;
            const leafSprite = new Sprite(
              this.species.textureSet.leaf[
                RNG.getUniformInt(0, this.species.textureSet.leaf.length - 1)
              ]
            );
            this.sprite.addChild(leafSprite);
            leafSprite.anchor.set(0.5);
            leafSprite.position.set(
              leafX - this.sprite.position.x,
              leafY - this.sprite.position.y
            );
            leafSprite.tint = tint;
            leafSprite.rotation = leafRotation;
            leafSprite.alpha = leafAlpha;
            this.leafSprites.push(leafSprite);
          }
        }
        this.growthStep += 1;
      }
    }
    console.throttle(250).log("this.treee sprite", this.sprite);
  }

  private lengthdir_x(length: number, direction: number): number {
    return length * Math.cos((direction * Math.PI) / 180);
  }

  private lengthdir_y(length: number, direction: number): number {
    return length * Math.sin((direction * Math.PI) / 180);
  }

  draw(): void {
    if (this.sprite) {
      this.game.renderer.addToScene(this.position, Layer.PLANT, this.sprite);
    }
  }

  public plan(): void {
    this.action = new GrowAction(this.game, this, this.position);
  }

  act(): Promise<any> {
    return this.action.run();
  }

  growTree() {
    if (!this.fullyGrown) {
      this.generateSprite(1);
      // this.updateShadowSprite();
      // this.shadowGraphics = this.generateShadowGraphics(this.graphics);
    }
    this.ageTree();
    return;
  }

  private ageTree() {
    const deadLeafCount = RNG.getUniformInt(3, 12);
    if (this.leafSprites.length > this.maxLeafCount / 2) {
      for (let i = 0; i < deadLeafCount; i++) {
        const leaf = this.leafSprites[i];
        leaf.y += RNG.getUniform() * 8;
        if (leaf.y > 0) {
          leaf.destroy();
          this.leafSprites.splice(i, 1);
        }
      }
    }
  }

  public getDescription(): DescriptionBlock[] {
    const descriptionBlocks = [];
    descriptionBlocks.push({
      icon: PinIcon,
      text: `${this.position.x}, ${this.position.y}`,
    });
    descriptionBlocks.push({ icon: TypeIcon, text: this.subType });
    if (this.goal) {
      descriptionBlocks.push({ icon: GoalIcon, text: this.goal.name });
    }
    if (this.action) {
      descriptionBlocks.push({ icon: ActionIcon, text: this.action.name });
    }
    return descriptionBlocks;
  }
}
