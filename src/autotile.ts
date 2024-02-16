import { TileType } from "./tile";

export class Autotile {
  static NW = Math.pow(2, 0);
  static N = Math.pow(2, 1);
  static NE = Math.pow(2, 2);
  static W = Math.pow(2, 3);
  static E = Math.pow(2, 4);
  static SW = Math.pow(2, 5);
  static S = Math.pow(2, 6);
  static SE = Math.pow(2, 7);

  // static BITMASK = {
  //   2: 1,
  //   8: 2,
  //   10: 3,
  //   11: 4,
  //   16: 5,
  //   18: 6,
  //   22: 7,
  //   24: 8,
  //   26: 9,
  //   27: 10,
  //   30: 11,
  //   31: 12,
  //   64: 13,
  //   66: 14,
  //   72: 15,
  //   74: 16,
  //   75: 17,
  //   80: 18,
  //   82: 19,
  //   86: 20,
  //   88: 21,
  //   90: 22,
  //   91: 23,
  //   94: 24,
  //   95: 25,
  //   104: 26,
  //   106: 27,
  //   107: 28,
  //   120: 29,
  //   122: 30,
  //   123: 31,
  //   126: 32,
  //   127: 33,
  //   208: 34,
  //   210: 35,
  //   214: 36,
  //   216: 37,
  //   218: 38,
  //   219: 39,
  //   222: 40,
  //   223: 41,
  //   248: 42,
  //   250: 43,
  //   251: 44,
  //   254: 45,
  //   255: 46,
  //   0: 47,
  // };

  static BITMASK = {
    2: 44,
    8: 45,
    10: 39,
    11: 38,
    16: 43,
    18: 41,
    22: 40,
    24: 33,
    26: 31,
    27: 30,
    30: 29,
    31: 28,
    64: 42,
    66: 32,
    72: 37,
    74: 27,
    75: 25,
    80: 35,
    82: 19,
    86: 18,
    88: 21,
    90: 15,
    91: 23,
    94: 42,
    95: 12,
    104: 36,
    106: 26,
    107: 24,
    120: 21,
    122: 5,
    123: 6,
    126: 5,
    127: 4,
    208: 34,
    210: 17,
    214: 16,
    216: 22,
    218: 11,
    219: 10,
    222: 9,
    223: 8,
    248: 20,
    250: 3,
    251: 2,
    254: 1,
    255: 47,
    0: 46,
  };

  // static BITMASK = {
  //   2: 47,
  //   8: 47,
  //   10: 3,
  //   11: 47,
  //   16: 9,
  //   18: 6,
  //   22: 47,
  //   24: 33,
  //   26: 9,
  //   27: 10,
  //   30: 11,
  //   31: 20,
  //   64: 46,
  //   66: 32,
  //   72: 15,
  //   74: 16,
  //   75: 17,
  //   80: 18,
  //   82: 19,
  //   86: 20,
  //   88: 21,
  //   90: 22,
  //   91: 47,
  //   94: 24,
  //   95: 25,
  //   104: 47,
  //   106: 27,
  //   107: 16,
  //   120: 8,
  //   122: 30,
  //   123: 31,
  //   126: 32,
  //   127: 34,
  //   208: 5,
  //   210: 35,
  //   214: 24,
  //   216: 37,
  //   218: 39,
  //   219: 1,
  //   222: 41,
  //   223: 36,
  //   248: 28,
  //   250: 43,
  //   251: 40,
  //   254: 38,
  //   255: 0,
  //   0: 47,
  // };

  public static autotileLookup(
    mapObject: { [pos: string]: TileType },
    x_boundary: number,
    y_boundary: number,
    x: number,
    y: number
  ): number {
    let sum = 0;
    let n = false;
    let e = false;
    let s = false;
    let w = false;

    const pos = `${x},${y}`;

    // just return 0 for walls and handle it later
    if (!mapObject[pos] || mapObject[pos] == TileType.Wall) return 0;

    if (y > 0 && mapObject[`${x},${y - 1}`]) {
      n = true;
      sum += Autotile.N;
    }
    if (x > 0 && mapObject[`${x - 1},${y}`]) {
      w = true;
      sum += Autotile.W;
    }
    if (x < x_boundary && mapObject[`${x + 1},${y}`]) {
      e = true;
      sum += Autotile.E;
    }
    if (y < y_boundary && mapObject[`${x},${y + 1}`]) {
      s = true;
      sum += Autotile.S;
    }

    if (n && w && y > 0 && x > 0 && mapObject[`${x - 1},${y - 1}`])
      sum += Autotile.NW;
    if (n && e && y > 0 && x < x_boundary && mapObject[`${x + 1},${y - 1}`])
      sum += Autotile.NE;
    if (s && w && y < y_boundary && x > 0 && mapObject[`${x - 1},${y + 1}`])
      sum += Autotile.SW;
    if (
      s &&
      e &&
      x < x_boundary &&
      y < y_boundary &&
      mapObject[`${x + 1},${y + 1}`]
    )
      sum += Autotile.SE;

    return Autotile.BITMASK[sum];
  }

  public static autotile(mapObject: { [pos: string]: TileType }): {
    [pos: string]: TileType;
  } {
    console.log("autotile rawMapObj: ", mapObject);
    const tiles = {};
    const mapKeys = Object.keys(mapObject);
    const [maxX, maxY] = mapKeys.reduce(
      (acc, key) => {
        const [x, y] = key.split(",").map(Number);
        acc[0] = Math.max(acc[0], x);
        acc[1] = Math.max(acc[1], y);
        return acc;
      },
      [0, 0]
    );

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= maxX; x++) {
        const key = `${x},${y}`;
        const tileValue = mapObject[key] || 0;
        // if (tileValue == MapTileType.wall) {
        //   tiles[key] = -1;
        // }
        // if (tileValue == MapTileType.floor) {
        //   tiles[key] = Autotile.autotileLookup(mapObject, maxX, maxY, x, y);
        // }
        tiles[key] = Autotile.autotileLookup(mapObject, maxX, maxY, x, y);
      }
    }

    console.log("autotiled map: ", tiles);

    return tiles;
  }
}
