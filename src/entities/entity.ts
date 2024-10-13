import { Point } from "../point";
import { Tile, TileSubType, TileType } from "../tile";
import { Action } from "../actions/action";
import { PointerTarget } from "../camera";
import { Renderable } from "../renderer";
import { TreeSpeciesID } from "./tree/tree-species";
import { Leaf, Segment, TreeBranch } from "../manager-trees";
import { Sprite, Texture } from "pixi.js";

export interface WithID {
  id: number;
}

export interface WithName {
  name?: string;
}

export interface WithPosition {
  position?: Point;
  collider?: boolean;
}

export interface WithTile {
  tile?: number;
  type?: TileType;
  subType?: TileSubType;
}

export interface WithAI {
  action?: Action;
  goal?: Action;
}

export interface WithRenderable {
  renderable?: Renderable;
}

export interface WithGrowth {
  growthStep?: number;
}

export interface WithSpecies {
  species?: TreeSpeciesID;
}

export interface WithTrunk {
  trunk?: TreeBranch;
  curve?: number;
  curveDirection?: number;
  trunkTextureIndex?: number;
  trunkBaseTextureIndex?: number;
}

export interface WithBranches {
  branches?: TreeBranch[];
  branchTextureIndex?: number;
  branchesPerSegment?: number;
  branchChance?: number;
  trunkSegmentWidth?: number;
  trunkSegmentHeight?: number;
  branchSegmentWidth?: number;
  branchSegmentHeight?: number;
  totalSegments?: number;
}

export interface WithLeaves {
  leaves?: Map<number, Leaf[]>; // branch ID -> leaf sprite []
  leafTextureIndex?: number;
  leavesPerSegment?: number;
  leafSize?: number;
  leafDistance?: number;
  leafDensity?: number;
}

export type EntityBase = Partial<
  WithID &
    WithName &
    WithPosition &
    WithTile &
    WithAI &
    WithRenderable &
    WithGrowth &
    WithSpecies &
    WithTrunk &
    WithBranches &
    WithLeaves
>;

export enum ComponentType {
  id = "id",
  name = "name",
  position = "position",
  collider = "collider",
  tile = "tile",
  type = "type",
  subType = "subType",
  action = "action",
  goal = "goal",
  renderable = "renderable",
  species = "species",
  growthStep = "growthStep",
  trunk = "trunk",
  curve = "curve",
  curveDirection = "curveDirection",
  trunkTextureIndex = "trunkTextureIndex",
  branches = "branches",
  branchTextureIndex = "branchTextureIndex",
  branchesPerSegment = "branchesPerSegment",
  branchChance = "branchChance",
  trunkSegmentWidth = "trunkSegmentWidth",
  trunkSegmentHeight = "trunkSegmentHeight",
  branchSegmentWidth = "branchSegmentWidth",
  branchSegmentHeight = "branchSegmentHeight",
  totalSegments = "totalSegments",
  leaves = "leaves",
  leavesPerSegment = "leavesPerSegment",
  leafSize = "leafSize",
  leafDistance = "leafDistance",
  leafDensity = "leafDensity",
}
