import { Map as RotJsMap } from "rot-js/lib/index";
import { RNG } from "rot-js";
import { FOV } from "rot-js/lib/index";
import { Game } from "./game";
import { Season, Tile, TileType } from "./tile";
import { Point } from "./point";
import { Actor } from "./entities/actor";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";

export enum MapTileType {
  wall, // walkable tile of any kind
  floor, // impassable tile of any kind
}

export class MapWorld {
  private rawMap: { [key: string]: MapTileType };
  private map: { [key: string]: Tile };

  constructor(private game: Game) {
    this.map = {};
    this.rawMap = {};
  }

  generateMap(width: number, height: number): void {
    this.map = {};
    this.rawMap = {};

    let cellular = new RotJsMap.Cellular(width, height);

    /* cells with 1/2 probability */
    cellular.randomize(0.51);

    /* generate and show four generations */
    for (var i = 0; i < 5; i++) {
      cellular.create(this.cellularCallback.bind(this));
    }
    cellular.connect(this.cellularCallback.bind(this), 0);
    this.autotileMap(this.rawMap);
  }

  autotileMap(rawMap: { [key: string]: MapTileType }) {
    console.log("rawMap to start with: ", rawMap);
    const autotileMap = Autotile.autotile(rawMap);
    let tileIndex;
    let tile;
    Object.keys(autotileMap).forEach((pos) => {
      tileIndex = autotileMap[pos];
      if (tileIndex == MapTileType.wall) {
        tile = Tile.water;
      } else {
        tile = Tile.Tilesets[this.game.biome][Season.Spring][tileIndex];
      }

      if (!tile) {
        console.log(
          `AUTOTILE ERROR: ${this.game.biome} ${Season.Spring} ${tileIndex}`
        );
      }
      this.map[pos] = tile;
    });
  }

  setTile(x: number, y: number, tile: Tile): void {
    this.map[this.coordinatesToKey(x, y)] = tile;
  }

  getRandomTilePositions(type: TileType, quantity: number = 1): Point[] {
    let buffer: Point[] = [];
    let result: Point[] = [];
    for (let key in this.map) {
      // console.log("this.map[key]", key, this.map[key]);
      if (this.map[key].type === type) {
        buffer.push(this.keyToPoint(key));
      }
    }

    let index: number;
    while (buffer.length > 0 && result.length < quantity) {
      index = Math.floor(RNG.getUniform() * buffer.length);
      result.push(buffer.splice(index, 1)[0]);
    }
    return result;
  }

  getTile(x: number, y: number): Tile {
    return this.map[this.coordinatesToKey(x, y)];
  }

  getTileType(x: number, y: number): TileType {
    return this.map[this.coordinatesToKey(x, y)].type;
  }

  // getTileGlyph(x: number, y: number): Tile {
  //   return this.map[this.coordinatesToKey(x, y)];
  // }

  isPassable(x: number, y: number): boolean {
    return (
      this.coordinatesToKey(x, y) in this.map &&
      this.map[this.coordinatesToKey(x, y)]?.type !== Tile.water.type
    );
    // return this.coordinatesToKey(x, y) in this.map;
  }

  draw(): void {
    // TODO: only redraw the sprites thathave changed...
    // or change to only render the sprites around the viewport...
    this.game.renderer.clearScene();
    for (let key in this.map) {
      const tile = this.map[key];
      this.game.userInterface.draw(this.keyToPoint(key), Layer.TERRAIN, [
        tile.sprite,
      ]);
    }
  }

  UpdateFOV(actor: Actor) {
    const fov = new FOV.PreciseShadowcasting(this.lightPasses.bind(this));
    let bgTile;
    let key;

    /* output callback */
    fov.compute(
      actor.position.x,
      actor.position.y,
      3,
      (xPos, yPos, r, visibility) => {
        key = xPos + "," + yPos;
        bgTile = this.map[key];
        if (this.map[key] == null) {
          return;
        }
        console.log("r= " + r);
        console.log("visibility: " + visibility);
        // const glyphs =
        //   r === 0 ? [this.map[key].glyph, actor.glyph] : [this.map[key].glyph];
        // const glyphs = r === 0 ? [actor.glyph, this.map[key].glyph] : [this.map[key].glyph];

        const brightness = 0.55 * (1 / r) * visibility;
        const color = `rgba(244, 197, 91, ${brightness})`;
        // var color = (this.map[xPos+","+yPos] ? "#aa0": "#660");

        // comment out while switching from glyphs to tiles
        // this.game.userInterface.draw(new Point(xPos, yPos), glyphs, glyphs.map(g => color));
      }
    );
  }

  private lightPasses(x, y): boolean {
    var key = x + "," + y;
    if (key in this.map) {
      return this.map[key] != Tile.water;
    }
    return false;
  }

  private coordinatesToKey(x: number, y: number): string {
    return x + "," + y;
  }

  private keyToPoint(key: string): Point {
    let parts = key.split(",");
    return new Point(parseInt(parts[0]), parseInt(parts[1]));
  }

  private cellularCallback(x: number, y: number, wall: number): void {
    // wall meaning impassible
    if (wall) {
      this.rawMap[this.coordinatesToKey(x, y)] = MapTileType.wall;
      return;
    }
    // this.map[this.coordinatesToKey(x, y)] = Tile.floor;
    this.rawMap[this.coordinatesToKey(x, y)] = MapTileType.floor;
  }
}
