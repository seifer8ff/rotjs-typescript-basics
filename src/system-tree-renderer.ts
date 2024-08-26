import { EntityBase } from "./entities/entity";
import { TreeSpecies } from "./entities/tree/tree-species";
import {
  getItemFromRange,
  getNumberFromRange,
  inverseLerp,
} from "./misc-utility";
import { Color, RNG } from "rot-js";
import { ParticleContainer, Sprite, Texture } from "pixi.js";
import { Segment, TreeBranch } from "./manager-trees";
import { SystemBranches } from "./system-branches";
import { Point } from "./point";
import { Layer, Renderable } from "./renderer";
import { GameSettings } from "./game-settings";
import { SystemLeaves } from "./system-leaves";
import { Game } from "./game";
import { Tile } from "./tile";
import { Color as ColorType } from "rot-js/lib/color";
import { clamp } from "lodash";
import { LightManager } from "./light-manager";

// handle spawning, updating, and rendering of tree leaves
export class SystemTreeRenderer {
  constructor() {}

  public static getRandomTrunkBaseTexture(species: TreeSpecies): number {
    return RNG.getUniformInt(0, species.textureSet.trunkBase.length - 1);
  }

  public static getRandomTrunkTexture(species: TreeSpecies): number {
    return RNG.getUniformInt(0, species.textureSet.trunk.length - 1);
  }

  public static getTrunkBaseTexture(species: TreeSpecies, index: number) {
    return species.textureSet.trunkBase[index];
  }

  public static getTrunkTexture(species: TreeSpecies, index: number) {
    return species.textureSet.trunk[index];
  }

  public static generateBaseSprite(
    game: Game,
    pos: Point,
    species: TreeSpecies,
    trunkBaseTextureIndex: number
  ): Renderable {
    const sprite = new ParticleContainer(500, {
      vertices: true,
      position: true,
      rotation: true,
      scale: true,
      tint: GameSettings.shouldTint(),
    });
    const spritePos = game.userInterface.camera.TileToScreenCoords(
      pos.x,
      pos.y,
      Layer.TREE
    );
    sprite.position.set(spritePos.x, spritePos.y);
    return SystemTreeRenderer.renderTrunkBase(
      sprite,
      species,
      trunkBaseTextureIndex
    );
  }

  public static renderTrunkBase(
    renderable: ParticleContainer,
    species: TreeSpecies,
    trunkBaseTextureIndex: number
  ): Renderable {
    const trunkBase = Sprite.from(
      SystemTreeRenderer.getTrunkBaseTexture(species, trunkBaseTextureIndex)
    );
    trunkBase.anchor.set(0.5);
    trunkBase.zIndex = 999;
    SystemTreeRenderer.tintSegmentSprite(trunkBase, trunkBase.position.y);
    renderable.addChild(trunkBase);
    return renderable;
  }

  public static renderTrunk(
    trunk: TreeBranch,
    renderable: Renderable,
    species: TreeSpecies,
    trunkTextureIndex: number
  ) {
    if (trunk?.segments?.length) {
      const fullyRendered = trunk.segments.every((s) => s.rendered);
      if (!fullyRendered) {
        let spriteTexture = SystemTreeRenderer.getTrunkTexture(
          species,
          trunkTextureIndex
        );
        SystemTreeRenderer.renderBranch(
          trunk,
          renderable as ParticleContainer,
          spriteTexture
        );
      }
    }
  }

  public static renderBranches(
    branches: TreeBranch[],
    renderable: Renderable,
    species: TreeSpecies,
    branchTextureIndex: number
  ) {
    if (branches.length > 0) {
      let fullyRendered = true;
      for (let branch of branches) {
        fullyRendered = branch.segments.every((s) => s.rendered);
        if (!fullyRendered) {
          let spriteTexture = SystemTreeRenderer.getTrunkTexture(
            species,
            branchTextureIndex
          );
          SystemTreeRenderer.renderBranch(
            branch,
            renderable as ParticleContainer,
            spriteTexture
          );
        }
      }
    }
  }

  public static renderBranch(
    branch: TreeBranch,
    renderable: ParticleContainer,
    texture: Texture
  ): ParticleContainer {
    let segment: Segment;
    let sprite: Sprite;
    for (let i = 0; i < branch.segments.length; i++) {
      segment = branch.segments[i];
      if (!segment.rendered) {
        sprite = SystemTreeRenderer.renderSegment(segment, texture);
        // if (branch.isTrunk) {
        SystemTreeRenderer.tintSegmentSprite(sprite, segment.position.y);
        // }

        renderable.addChild(sprite);
      }
    }
    return renderable;
  }

  public static tintSegmentSprite(sprite: Sprite, yPos: number) {
    let tint = LightManager.lightDefaults.fullLight;
    // console.log("segment.y", yPos);
    let darkenAmount = inverseLerp(yPos, -45, 5);
    // console.log("darkenAmount", darkenAmount);
    darkenAmount = clamp(darkenAmount, 0, 0.16);
    tint = Color.interpolate(
      tint,
      LightManager.lightDefaults.shadow,
      darkenAmount
    );
    sprite.tint = Color.toHex(tint);
  }

  public static renderLeaves(
    branches: TreeBranch[],
    leaves: Map<number, Sprite[]>,
    renderable: Renderable,
    species: TreeSpecies,
    leavesPerSegment: number,
    leafSize: number,
    leafDensity: number
  ) {
    if (branches.length > 0) {
      let fullyRendered = true;
      for (let branch of branches) {
        fullyRendered = branch.segments.every((s) => s.leavesRendered);
        if (!fullyRendered) {
          SystemTreeRenderer.renderLeavesForBranch(
            branch,
            leaves?.get(branch.id) || [],
            renderable as ParticleContainer,
            species,
            leavesPerSegment,
            leafSize,
            leafDensity
          );
        }
      }
    }
  }

  public static renderLeavesForBranch(
    branch: TreeBranch,
    leafSprites: Sprite[],
    renderable: ParticleContainer,
    species: TreeSpecies,
    leavesPerSegment?: number,
    leafSize?: number,
    leafDensity?: number
  ): ParticleContainer {
    let segment: Segment;
    for (let i = 0; i < branch.segments.length; i++) {
      segment = branch.segments[i];
      if (!segment.leavesRendered) {
        leafSprites = SystemLeaves.addLeaves(
          segment,
          leafSprites,
          leavesPerSegment,
          leafSize,
          leafDensity,
          species
        );
        for (let leaf of leafSprites) {
          renderable.addChild(leaf);
        }
      }
    }
    return renderable;
  }

  public static renderSegment(segment: Segment, texture: Texture): Sprite {
    let sprite = new Sprite(texture);
    segment.rendered = true;

    sprite.anchor.set(0.5, 1);
    sprite.width = segment.width;
    sprite.height = segment.length * 1.2; // hide gaps between segments
    sprite.position.set(segment.position.x, segment.position.y);

    sprite.angle = -segment.curve + 90;
    // sprite.zIndex = 5;
    // sprite.zIndex = branch.branchOrder;
    // sprite["order"] = branch.branchOrder + segment.segmentOrder

    return sprite;
  }

  public static tintTree(
    position: Point,
    renderable: ParticleContainer,
    lightManager: LightManager
  ) {
    let translatedX = Tile.translate(position.x, Layer.TREE, Layer.TERRAIN);
    let translatedY = Tile.translate(position.y, Layer.TREE, Layer.TERRAIN);
    let colorArray = lightManager.getLightFor(translatedX, translatedY, false);
    let color: ColorType = colorArray;
    if (color === undefined) {
      // position is outside of viewport
      return;
    }
    renderable.tint = Color.toHex(color);
  }
}
