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
  private leafSize: number; // final size of leaf;
  private branchChance: number;
  private leafSprites: Sprite[] = []; // array of leaf sprites (for easy removal)
  private growthStep = 0;
  private fullyGrown = false;
  private branchGrowthStep = 0;
  branches: { position: Point; branch: Branch }[] = [];

  constructor(
    private game: Game,
    public position: Point,
    public species: TreeSpecies
  ) {
    this.id = Date.now() + RNG.getUniformInt(0, 100000);
    this.tile = Tile.tree;
    this.type = this.tile.type;
    this.subType = TileSubType.Tree;
    this.name = `${this.subType} - ${this.species.name}`;

    const ratio = Tile.plantSize / Tile.size;
    const screenPos = this.game.userInterface.camera.TileToScreenCoords(
      this.position.x * ratio,
      this.position.y * ratio,
      Layer.TERRAIN
    );
    this.branchChance = this.species.branchChance;
    this.randomizeTrunkStyle();
    this.generatePixelTree(screenPos.x, screenPos.y);
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
    let width = this.species.trunkSegmentWidthMin;
    // let width =
    //   this.species.trunkSegmentWidthMin +
    //   (RNG.getUniform() * this.species.trunkSegmentWidthRange);
    let length = this.species.trunkSegmentHeight + RNG.getUniform() * 3;
    let x1 = x;
    let y1 = y;
    let x2 = x1 + this.lengthdir_x(length, curve);
    let y2 = y1 - this.lengthdir_y(length, curve);
    for (let i = 0; i < this.species.trunkLength; i++) {
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
            this.species.leafMinCount +
            RNG.getUniform() * this.species.leafCountRange,
          order: order,
        },
      };
      if (
        RNG.getUniform() * 100 > this.branchChance ||
        order < this.species.minTrunkBaseSize
      )
        newBranch.branch.done = true; // don't allow branching on first couple segments
      if (i > this.species.trunkLength - 2) newBranch.branch.done = false; // last 2 segment must branch
      this.branches.push(newBranch);
      curve +=
        RNG.getUniform() *
        this.species.branchBendAmount *
        (RNG.getUniform() > 0.5 ? 1 : -1);
      order++;
      this.branchChance += this.species.branchChanceGrow;
      width *= this.species.trunkWidthDegrade;
      if (width < this.species.minBranchWidth)
        width = this.species.minBranchWidth + RNG.getUniform() * 2;
      if (length < this.species.minBranchLength)
        length = this.species.minBranchLength + RNG.getUniform();
      x1 = x2;
      y1 = y2;
      x2 = x1 + this.lengthdir_x(length, curve);
      y2 = y1 - this.lengthdir_y(length, curve);
    }

    // branches
    let count = 0;
    const maxCount =
      this.species.maxBranchesPerSegment +
      RNG.getUniformInt(0, this.species.maxBranchesPerSegmentRange);
    for (let k = 0; k < maxCount; k++) {
      count = 0;
      const size = this.branches.length;
      for (let j = 0; j < size; j++) {
        const _b = this.branches[j];
        if (!_b.branch.done) {
          _b.branch.done = RNG.getUniform() > 0.5;
          let curve =
            _b.branch.curve +
            (this.species.branchForkMin +
              RNG.getUniform() * this.species.branchForkRange) *
              (RNG.getUniform() > 0.5 ? 1 : -1);
          let length = _b.branch.length;
          if (length < this.species.minBranchLength)
            length = this.species.minBranchLength;
          // let width = _b.branch.width / 2;
          let width = _b.branch.width;
          width *= this.species.branchWidthDegrade;
          if (width < this.species.minBranchWidth)
            width = this.species.minBranchWidth;
          let order = _b.branch.order;

          let x1 = _b.branch.x2;
          let y1 = _b.branch.y2;
          let x2 = x1 + this.lengthdir_x(length, curve);
          let y2 = y1 - this.lengthdir_y(length, curve);
          // create branch segments, with length this.branchLength
          for (let i = 0; i < this.species.branchLength; i++) {
            let newBranch = {
              position: new Point(x1 + (x2 - x1) / 2, y1), // center on x
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
                  this.species.leafMinCount +
                  RNG.getUniform() * this.species.leafCountRange,
                order: order + 1,
              },
            };
            if (RNG.getUniform() * 100 > this.species.branchChance) {
              newBranch.branch.done = true;
            }

            if (j === size || count === maxCount) {
              newBranch.branch.done = false; // force leaves on the end of branches
            }
            this.branches.push(newBranch);

            // setup next loop
            curve +=
              RNG.getUniform() *
              this.species.branchBendAmount *
              (RNG.getUniform() > 0.5 ? 1 : -1);
            order++;
            width *= this.species.trunkWidthDegrade;
            if (width < this.species.minBranchWidth) {
              width = this.species.minBranchWidth;
            }
            length *= this.species.branchLengthDegrade;
            if (length < this.species.minBranchLength) {
              length = this.species.minBranchLength;
            }
            x1 = x2;
            y1 = y2;
            x2 = x1 + this.lengthdir_x(length, curve);
            y2 = y1 - this.lengthdir_y(length, curve);
          }
        }
      }
    }

    this.leafSize =
      this.species.leafMinSize + RNG.getUniform() * this.species.leafSizeRange;
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
        isTrunk = branch.branch.order <= this.species.trunkLength;

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
        sprite.width = branch.branch.width;
        // sprite.height = branch.branch.length;
        // sprite.width = branch.branch.width * 1.1;
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

          const trunkBaseIdealWidth = 6; // pixels wide space that aligns with the trunk
          const ratio = branch.branch.width / trunkBaseIdealWidth;
          trunkBaseSprite.width *= ratio;
          trunkBaseSprite.height *= ratio;
          trunkBaseSprite.tint = tint;
          trunkBaseSprite.anchor.set(0.5, 0.5);
          trunkBaseSprite.position.set(
            sprite.position.x,
            sprite.position.y + sprite.height / 2
          );
          // trunkBaseSprite.rotation = sprite.rotation;
        }

        // if (trunkBaseStep) {
        //   // add a sprite for where the trunk meets the ground
        //   let trunkBaseSprite = new Sprite(this.trunkBaseTexture);
        //   this.sprite.addChild(trunkBaseSprite);

        //   const trunkBaseIdealWidth = 8; // 8 pixels wide space that aligns with the trunk
        //   const ratio = branch.branch.width / trunkBaseIdealWidth;
        //   trunkBaseSprite.width *= ratio * 1.2;
        //   // trunkBaseSprite.width *= 1.2;
        //   // trunkBaseSprite.height *= 1.2;
        //   trunkBaseSprite.height *= ratio * 1.2;
        //   trunkBaseSprite.tint = tint;
        //   trunkBaseSprite.anchor.set(0.5, 0);
        //   // trunkBaseSprite.position.set(0, -22);
        //   trunkBaseSprite.position.set(0, -22 * ratio * 1.2);
        // }

        // add leafs to branches that are not done and are not trunk
        if (!branch.branch.done && !isTrunk) {
          let leafAlpha = this.species.maxLeafAlpha;
          for (
            let j = 0;
            j < branch.branch.leafCount * this.species.leafDensity;
            j++
          ) {
            if (this.leafSprites.length >= this.species.maxLeafCount) break;
            leafAlpha -= 0.02;
            if (leafAlpha < this.species.minLeafAlpha) {
              leafAlpha = this.species.maxLeafAlpha;
            }
            let angle = RNG.getUniform() * this.species.leafCoverageAngle;
            let distance =
              RNG.getUniform() *
              this.species.branchLength *
              this.species.leafDistance;
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
    if (this.leafSprites.length > this.species.maxLeafCount / 2) {
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
    const descriptionBlocks: DescriptionBlock[] = [];
    descriptionBlocks.push({
      icon: PinIcon,
      getDescription: (pointerTarget: PointerTarget) =>
        `${pointerTarget.position.x}, ${pointerTarget.position.y}`,
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
