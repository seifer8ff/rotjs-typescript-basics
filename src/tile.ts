import { Glyph } from "./glyph";

export const enum TileType {
    Floor,
    Water,
    Box,
    SearchedBox,
    DestroyedBox
}

export class Tile {
    static readonly floor = new Tile(TileType.Floor, new Glyph("."));
    static readonly water = new Tile(TileType.Water, new Glyph("~"));
    static readonly box = new Tile(TileType.Box, new Glyph("#"));
    // static readonly box = new Tile(TileType.Box, new Glyph("#", "#654321"));
    static readonly searchedBox = new Tile(TileType.SearchedBox, new Glyph("X", {foregroundColor: "#666"}));
    static readonly destroyedBox = new Tile(TileType.DestroyedBox, new Glyph("x", {foregroundColor: "#555"}));

    constructor(public readonly type: TileType, public readonly glyph: Glyph) { }
}

export const TileMap: { [key: string]: [number, number] } = {
    "@": [516, 5],  // player
    ".": [32, 0], // floor
    "~": [16, 592], // water
    "#": [48, 720], // box
    "X": [96, 720], // searched box
    "x": [80, 720], // destroyed box
    "P": [568, 0], // Pedro
    "p": [552, 0], // TINY PEDRO - PLACEHOLDER
    "t": [536, 0], // tombstone
    

  //   "M": [88, 0],  // monster
  //   "*": [72, 24], // treasure chest
  //   "g": [64, 40], // gold
  //   "x": [56, 32], // axe
  // //   "p": [56, 64], // potion
  //   "a": [40, 32], // tree 1
  //   "b": [32, 40], // tree 2
  //   "c": [40, 40], // tree 3
  //   "d": [48, 40], // tree 4
  //   "e": [56, 40], // tree 5
  //   "T": [72, 56], // tombstone
  //   "╔": [0, 72],  // room corner
  //   "╗": [24, 72], // room corner
  //   "╝": [72, 72], // room corner
  //   "╚": [48, 72], // room corner
  //   "═": [8, 72],  // room edge
  //   "║": [32, 72], // room edge
  //   "o": [40, 72], // room corner
  }