import { Game } from "../../game";
import { Actor, DescriptionBlock } from "../actor";
import { Point } from "../../point";
import { Tile, TileSubType, TileType } from "../../tile";
import { Action } from "../../actions/action";
import { GrowAction } from "../../actions/growAction";
import TypeIcon from "../../shoelace/assets/icons/person-vcard.svg";
import GoalIcon from "../../shoelace/assets/icons/geo-alt.svg";
import ActionIcon from "../../shoelace/assets/icons/sign-turn-slight-right.svg";
import PinIcon from "../../shoelace/assets/icons/pin-map.svg";
import { Layer } from "../../renderer";
// import LSystem from "lindenmayer";
import { ParticleContainer, Sprite, Texture } from "pixi.js";
import { PointerTarget } from "../../camera";
import { TreeSpecies } from "./tree-species";
import { RNG } from "rot-js";
import { generateId, getItemFromRange } from "../../misc-utility";
import { last } from "lodash";

export interface Segment {
  position: Point;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  curve: number;
  length: number;
  width: number;
  rendered?: boolean;
}

export interface TreeBranch {
  segments: Segment[];
  growLeaves: boolean;
  doneExtending: boolean;
  doneBranching: boolean;
  order: number;
  branchCount: number;
}

export function isTreeTrunk(
  branch: TreeBranch | TreeTrunk
): branch is TreeTrunk {
  return (<TreeTrunk>branch).trunkBase !== undefined;
}

export interface TreeTrunk extends TreeBranch {
  trunkBase?: Sprite;
}

export class Tree implements Actor {
  id: number;
  name?: string;
  tile: Tile;
  subType: TileSubType;
  type: TileType;
  goal: Action;
  action: Action;
  sprite: ParticleContainer;

  trunkTexture: Texture; // final texture for trunk
  trunkBaseTexture: Texture; // texture used for where the trunk meets the ground

  private branchSegmentWidth: number; // current width of branch
  private branchSegmentLength: number; // current length of branch
  private trunkSegmentWidth: number; // current width of trunk
  private branchesPerSegment: number; // maximum number of branches per segment (based on chance)
  private leafSize: number; // current size of leaf;
  private leafAlpha: number; // current alpha of leaf
  private branchOrder: number; // current order of branch
  private leavesPerBranch: number; // number of leaves per branch (used to calculate max number of leaves at any time)

  private branchChance: number;
  private leafSprites: Sprite[] = []; // array of leaf sprites (for easy removal)
  private growthStep = 0;
  private fullyGrown = false;
  private curve: number;
  private curveDir: number;
  private treeTrunk: TreeTrunk;
  private treeBranches: TreeBranch[];

  private growLeaves: boolean = true;

  constructor(
    private game: Game,
    public position: Point,
    public species: TreeSpecies
  ) {
    this.id = generateId();
    this.tile = Tile.tree;
    this.type = this.tile.type;
    this.subType = TileSubType.Tree;
    this.name = `${this.subType} - ${this.species.name}`;
    this.growLeaves = true;

    const worldPoint = Tile.translatePoint(
      this.position,
      Layer.PLANT,
      Layer.TERRAIN
    );
    const screenPos = this.game.userInterface.camera.TileToScreenCoords(
      worldPoint.x,
      worldPoint.y,
      Layer.TERRAIN
    );
    this.initTree(screenPos.x, screenPos.y);
    this.renderTree(1);
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

  private initTree(x: number, y: number): void {
    // set tree options
    // branch width
    // leaf size
    // leaf count
    // branch count
    // branch length
    this.trunkSegmentWidth = this.getRandFrom(
      this.species.trunkSegmentWidthMin,
      this.species.trunkSegmentWidthRange
    );
    this.branchSegmentWidth = this.getRandFrom(
      this.species.branchSegmentWidthMin,
      this.species.branchSegmentWidthRange
    );
    this.branchChance = this.species.branchChance;
    this.leafSize = this.getRandFrom(
      this.species.leafMinSize,
      this.species.leafSizeRange
    );
    this.branchesPerSegment = this.getRandFrom(
      this.species.maxBranchesPerSegment,
      this.species.maxBranchesPerSegmentRange
    );
    this.leavesPerBranch = this.getRandFrom(
      this.species.leavesPerBranchMin,
      this.species.leavesPerBranchRange
    );
    this.leafAlpha = this.species.maxLeafAlpha;
    this.curve = 80 + RNG.getUniform() * 20; // close to 90 degrees from ground
    this.randomizeTrunkStyle();
    this.treeBranches = [];
    this.treeTrunk = {
      segments: [],
      order: this.branchOrder,
      growLeaves: false,
      doneExtending: false,
      doneBranching: false,
      branchCount: 0,
    };
    this.branchOrder = 0;

    // generate first trunk segment
    // let width = this.trunkSegmentWidth;
    let length = this.getRandFrom(
      this.species.trunkSegmentHeightMin,
      this.species.trunkSegmentHeightRange
    );
    let x1 = x;
    let y1 = y;
    let x2 = x1 + this.lengthdir_x(length, this.curve);
    let y2 = y1 - this.lengthdir_y(length, this.curve);
    let firstTrunkSegment: Segment = {
      position: new Point(x1, y1),
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      curve: this.curve,
      length: length,
      width: this.trunkSegmentWidth,
    };
    this.treeTrunk.segments.push(firstTrunkSegment);
    this.treeBranches.push(this.treeTrunk);

    this.curveDir = RNG.getUniform() > 0.5 ? 1 : -1; // reset curve dir
    this.curve +=
      RNG.getUniform() * this.species.branchCurveAngle * this.curveDir; // set new curve dir
    this.branchOrder++;
    this.trunkSegmentWidth *= this.species.trunkWidthDegrade;
    if (this.trunkSegmentWidth < this.species.branchSegmentWidthMin)
      this.trunkSegmentWidth = this.species.branchSegmentWidthMin;
    if (length < this.species.branchSegmentHeightMin)
      length = this.species.branchSegmentHeightMin;
    x1 = x2;
    y1 = y2;
    x2 = x1 + this.lengthdir_x(length, this.curve);
    y2 = y1 - this.lengthdir_y(length, this.curve);
  }

  private getRandFrom(min: number, range: number): number {
    return min + RNG.getUniform() * range;
  }

  private growTreeTrunk(): boolean {
    const trunkSegments = this.species.trunkSegmentCount;

    // add one trunk
    // or add one branch to a single existing branch
    if (this.treeTrunk.segments.length < trunkSegments) {
      let lastSegment =
        this.treeTrunk.segments[this.treeTrunk.segments.length - 1];
      let width = lastSegment.width;
      let length = lastSegment.length;
      width *= this.species.trunkWidthDegrade;
      if (width < this.species.branchSegmentWidthMin)
        width = this.species.branchSegmentWidthMin;
      if (length < this.species.branchSegmentHeightMin)
        length = this.species.branchSegmentHeightMin;
      let x1 = lastSegment.x2;
      let y1 = lastSegment.y2;
      let x2 = x1 + this.lengthdir_x(length, this.curve);
      let y2 = y1 - this.lengthdir_y(length, this.curve);
      let newSegment: Segment = {
        position: new Point(x1, y1),
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        curve: this.curve,
        length: length,
        width: width,
      };
      this.treeTrunk.segments.push(newSegment);
      if (this.treeTrunk.segments.length === trunkSegments) {
        this.treeTrunk.doneExtending = true;
      }
      return true;
    }
    return false;
  }

  private growTreeBranches(): boolean {
    // add branches to trunk
    // or add branches to existing branches
    let growSuccess = false;

    // add first branch to trunk
    if (this.treeBranches.length === 0) {
      let lastSegment =
        this.treeTrunk.segments[this.treeTrunk.segments.length - 1];
      this.curve =
        lastSegment.curve +
        (this.species.branchForkMin +
          RNG.getUniform() * this.species.branchForkRange) *
          this.curveDir;
      let width = lastSegment.width;
      let length = lastSegment.length;
      width *= this.species.branchSegmentWidthDegrade;
      if (width < this.species.branchSegmentWidthMin) {
        width = this.species.branchSegmentWidthMin;
      }
      length *= this.species.branchSegmentHeightDegrade;
      if (length < this.species.branchSegmentHeightMin) {
        length = this.species.branchSegmentHeightMin;
      }

      let x1 = lastSegment.x2 + this.lengthdir_x(length, this.curve) / 2;
      let y1 = lastSegment.y2 + this.lengthdir_y(length, this.curve) / 3;
      let x2 = x1 + this.lengthdir_x(length, this.curve);
      let y2 = y1 - this.lengthdir_y(length, this.curve);
      let newBranch: TreeBranch = {
        segments: [
          {
            position: new Point(x1, y1),
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            curve: this.curve,
            length: length,
            width: width,
          },
        ],
        growLeaves: false,
        doneExtending: false,
        doneBranching: false,
        order: this.branchOrder,
        branchCount: 0,
      };
      this.treeBranches.push(newBranch);
      this.branchOrder++;
      this.curveDir = RNG.getUniform() > 0.5 ? 1 : -1; // reset curve dir
      this.curve +=
        RNG.getUniform() * this.species.branchCurveAngle * this.curveDir; // set new curve dir
      growSuccess = true;
    }

    // extend existing branches
    if (!growSuccess) {
      for (let treeBranch of this.treeBranches) {
        if (!treeBranch.doneExtending) {
          let lastSegment = treeBranch.segments[treeBranch.segments.length - 1];
          let width = lastSegment.width;
          let length = lastSegment.length;
          width *= this.species.branchSegmentWidthDegrade;
          if (width < this.species.branchSegmentWidthMin)
            width = this.species.branchSegmentWidthMin;
          length *= this.species.branchSegmentHeightDegrade;
          if (length < this.species.branchSegmentHeightMin)
            length = this.species.branchSegmentHeightMin;
          let x1 = lastSegment.x2;
          let y1 = lastSegment.y2;
          let x2 = x1 + this.lengthdir_x(length, this.curve);
          let y2 = y1 - this.lengthdir_y(length, this.curve);
          let newSegment: Segment = {
            position: new Point(x1, y1),
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            curve: this.curve,
            length: length,
            width: width,
          };
          treeBranch.segments.push(newSegment);

          if (treeBranch.segments.length >= this.species.branchSegmentCount) {
            treeBranch.doneExtending = true;
          }
          this.branchOrder++;
          this.curveDir = RNG.getUniform() > 0.5 ? 1 : -1; // reset curve dir
          this.curve +=
            RNG.getUniform() * this.species.branchCurveAngle * this.curveDir; // set new curve dir
          growSuccess = true;
          break;
        }
      }
    }

    // add a new branch to an existing segment/branch
    // starting from top of tree
    if (!growSuccess) {
      for (let i = 0; i < this.treeBranches.length; i++) {
        // start at the bottom of the tree for better looking branching
        // let treeBranch = this.treeBranches[i];
        let treeBranch = RNG.getItem(this.treeBranches);
        if (!treeBranch) {
          continue;
        }
        if (
          treeBranch.branchCount < this.branchesPerSegment &&
          !treeBranch.doneBranching
        ) {
          // const randSegment = RNG.getItem(treeBranch.segments);
          const randSegment = getItemFromRange(
            treeBranch.segments,
            2,
            treeBranch.segments.length - 1
          );
          if (
            !randSegment ||
            randSegment?.width <= this.species.branchSegmentWidthMin
          ) {
            continue;
          }
          this.curve =
            randSegment.curve +
            (this.species.branchForkMin +
              RNG.getUniform() * this.species.branchForkRange) *
              (RNG.getUniform() > 0.5 ? 1 : -1);

          let width = randSegment.width;
          let length = randSegment.length;
          width *= this.species.branchSegmentWidthDegrade;
          if (width < this.species.branchSegmentWidthMin)
            width = this.species.branchSegmentWidthMin;
          if (length < this.species.branchSegmentHeightMin)
            length = this.species.branchSegmentHeightMin;
          let x1 = randSegment.x2;
          let y1 = randSegment.y2;
          let x2 = x1 + this.lengthdir_x(length, this.curve);
          let y2 = y1 - this.lengthdir_y(length, this.curve);
          const rand = RNG.getUniform();
          let doneBranching = false;
          doneBranching = rand > this.branchChance;
          // if (isTreeTrunk(treeBranch)) {
          //   doneBranching = false;
          // } else {
          //   doneBranching = rand > this.branchChance;
          // }
          // if (isTreeTrunk(treeBranch)) {
          //   // tree trunk is less likely to finish branching
          //   if (RNG.getUniform() > 0.6) {
          //     doneBranching = rand > this.branchChance;
          //   }
          // } else {
          //   doneBranching = rand > this.branchChance;
          // }
          let newBranch: TreeBranch = {
            segments: [
              {
                position: new Point(x1, y1),
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                curve: this.curve,
                length: length,
                width: width,
              },
            ],
            growLeaves: true,
            doneExtending: false,
            // stop some branches from branching to keep tree from getting too dense
            doneBranching,
            order: this.branchOrder,
            branchCount: 0,
          };
          this.treeBranches.push(newBranch);
          treeBranch.branchCount++;
          this.branchOrder++;
          this.branchChance += this.species.branchChanceGrow; // grow branch chance every time tree grows
          this.curveDir = RNG.getUniform() > 0.5 ? 1 : -1; // reset curve dir
          this.curve +=
            RNG.getUniform() * this.species.branchCurveAngle * this.curveDir; // set new curve dir
          growSuccess = true;
          break;
        }
      }
    }
    return growSuccess;
  }

  private renderTrunkBase(attachSegment: Segment, attachSprite: Sprite): void {
    // add a sprite for where the trunk meets the ground
    let trunkBaseSprite = new Sprite(this.trunkBaseTexture);
    this.sprite.addChild(trunkBaseSprite);

    const trunkBaseIdealWidth = 6; // pixels wide space that aligns with the trunk
    const ratio = attachSegment.width / trunkBaseIdealWidth;
    trunkBaseSprite.width *= ratio;
    trunkBaseSprite.height *= ratio;
    trunkBaseSprite.tint = attachSprite.tint;
    trunkBaseSprite.anchor.set(0.5, 0.5);
    trunkBaseSprite.position.set(
      attachSprite.position.x,
      attachSprite.position.y + attachSprite.height / 2
    );
    trunkBaseSprite.zIndex = -1;
  }

  private renderBranch(branch: TreeBranch, tint: string): boolean {
    let renderSuccess: boolean = false;
    let sprite: Sprite;
    let isTrunk = branch === this.treeTrunk;
    let segment: Segment;
    const fullyRendered = branch.segments.every((s) => s.rendered);
    if (!fullyRendered) {
      segment = branch.segments[branch.segments.length - 1];

      if (isTrunk) {
        sprite = new Sprite(this.trunkTexture);
      } else {
        // TODO: add branch sprites
        sprite = new Sprite(this.trunkTexture);
      }
      this.sprite.addChild(sprite);
      segment.rendered = true;
      renderSuccess = true;

      sprite.anchor.set(0.5);
      sprite.width = segment.width;
      sprite.height = segment.length * 1.2; // hide gaps between segments

      sprite.position.set(
        segment.position.x - this.sprite.position.x,
        segment.position.y - this.sprite.position.y
      );
      sprite.angle = -segment.curve + 90;
      sprite.tint = tint;
      sprite.zIndex = branch.order;

      if (this.growthStep === 1) {
        // add a sprite for where the trunk meets the ground
        // first trunk segment
        this.renderTrunkBase(segment, sprite);
      }
    }

    return renderSuccess;
  }

  // shouldn't this just render the latest version of the tree?
  // shouldn't need growthSteps or any of that
  private renderTree(growthSteps: number = 1): boolean {
    // add to existing sprite rather than clearing and redrawing
    const firstGrowth = this.growthStep === 0;
    const leafRot = RNG.getUniform() * 360;
    const terrainPoint = Tile.translatePoint(
      this.position,
      Layer.PLANT,
      Layer.TERRAIN
    );
    const tint = this.game.renderer.getTintForPosition(terrainPoint);
    let growSuccess: boolean = false;

    if (firstGrowth) {
      this.sprite = new ParticleContainer(1000, {
        vertices: true,
        position: true,
        rotation: true,
        scale: true,
        tint: true,
      });
    }

    for (let i = 0; i < growthSteps; i++) {
      if (this.treeBranches.length > 1) {
        // only start growing leaves once there are branches
        this.renderLeaves(tint);
      }

      if (this.fullyGrown) {
        break;
      }
      // add trunk
      growSuccess = this.renderBranch(this.treeTrunk, tint);
      if (!growSuccess) {
        // add branches to trunk
        for (let treeBranch of this.treeBranches) {
          growSuccess = this.renderBranch(treeBranch, tint);
          if (growSuccess) {
            break;
          }
        }
      }
      if (!growSuccess) {
        this.fullyGrown = true;
      }
    }

    return growSuccess;
  }

  private randomizeLeafSize() {
    this.leafSize =
      this.species.leafMinSize + RNG.getUniform() * this.species.leafSizeRange;
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
    const growSteps = 1;
    let growSuccess = false;

    for (let i = 0; i < growSteps; i++) {
      // grow leaves
      this.ageLeaves();
      // add trunk
      growSuccess = this.growTreeTrunk();
      if (!growSuccess) {
        // add branches to trunk
        growSuccess = this.growTreeBranches();
      }
      if (!growSuccess) {
        this.fullyGrown = true;
        break;
      }
    }

    this.growthStep += 1; // increment growth step
    this.renderTree(growSteps);
  }

  private renderLeaves(tint: string): void {
    if (this.growLeaves === false) {
      return;
    }
    const leafsPerGrowth = this.leavesPerBranch / 4;
    const maxLeaves =
      this.leavesPerBranch *
      this.treeBranches.length *
      this.species.leavesPerBranchDensity;

    for (let i = 0; i < leafsPerGrowth; i++) {
      if (this.leafSprites.length >= maxLeaves) {
        break;
      }
      const leafRot = RNG.getUniform() * 360;
      // get newer branches first
      let randomValue = Math.pow(RNG.getUniform(), 2);
      let branchIndex = Math.floor(
        (1 - randomValue) * this.treeBranches.length
      );
      let branch = this.treeBranches[branchIndex];
      if (!branch.growLeaves) {
        continue;
      }
      let segment = RNG.getItem(branch?.segments || []);
      if (!branch || !segment) {
        return;
      }
      this.leafAlpha -= 0.02;
      this.leafSize -= 0.1;
      if (this.leafAlpha < this.species.minLeafAlpha) {
        this.leafAlpha = this.species.maxLeafAlpha;
      }
      if (this.leafSize < this.species.leafMinSize) {
        this.randomizeLeafSize();
      }
      let angle = RNG.getUniform() * this.species.leafCoverageAngle;
      let distance =
        RNG.getUniform() *
        this.species.branchSegmentCount *
        this.species.leafDistance;
      let leafX = segment.x2 + this.lengthdir_x(distance, angle);
      let leafY = segment.y2 - this.lengthdir_y(distance, angle);
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
      leafSprite.alpha = this.leafAlpha;
      leafSprite.width = this.leafSize;
      leafSprite.height = this.leafSize;
      leafSprite.zIndex = branch.order + 1;
      this.leafSprites.push(leafSprite);
    }
  }

  private ageLeaves(): void {
    const maxLeaves =
      this.treeBranches.length *
      this.leavesPerBranch *
      this.species.leavesPerBranchDensity;
    const timeScale = this.game.timeManager.timeScale;
    // fudged nextLeafCount calc, but doesn't really matter
    const nextLeafCount =
      this.leafSprites.length +
      this.leavesPerBranch * this.species.leavesPerBranchDensity;
    const deadLeafCount = 3;
    let newAlpha = 1;
    let newScale = 1;
    let leafIndex = 0;
    let leaf: Sprite;
    if (nextLeafCount >= maxLeaves) {
      for (let i = 0; i < deadLeafCount; i++) {
        leaf = this.leafSprites[i];
        if (!leaf) break;

        leafIndex = this.leafSprites.indexOf(leaf);
        leaf.y += RNG.getUniform() * 8 * timeScale;
        // gentle sway
        leaf.x += (RNG.getUniform() * 2 - 1) * timeScale;
        leaf.rotation += (RNG.getUniform() * 2 - 1) * timeScale;
        if (leaf.y >= -20) {
          // fade the leaf out as it reaches the ground
          newAlpha = leaf.alpha - 0.12 * timeScale;
          newAlpha = newAlpha < 0 ? 0 : newAlpha;
          leaf.alpha = newAlpha;
          newScale = leaf.scale.x - 0.03 * timeScale;
          newScale = newScale < 0.4 ? 0.4 : newScale;
          leaf.scale.set(newScale);

          if (leaf.y >= 0) {
            leaf.destroy();
            this.leafSprites.splice(leafIndex, 1);
          }
        }
      }
    }
  }

  public getDescription(): DescriptionBlock[] {
    const descriptionBlocks: DescriptionBlock[] = [];
    descriptionBlocks.push({
      icon: PinIcon,
      getDescription: (pointerTarget?: PointerTarget) =>
        `${pointerTarget?.position.x}, ${pointerTarget?.position.y}`,
    });
    descriptionBlocks.push({
      icon: TypeIcon,
      getDescription: () => this.subType,
    });
    if (this.goal) {
      descriptionBlocks.push({
        icon: GoalIcon,
        getDescription: () => this.goal.name,
      });
    }
    if (this.action) {
      descriptionBlocks.push({
        icon: ActionIcon,
        getDescription: () => this.action.name,
      });
    }
    return descriptionBlocks;
  }
}
