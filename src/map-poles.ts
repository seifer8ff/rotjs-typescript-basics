import { Game } from "./game";
import Simplex from "rot-js/lib/noise/simplex";
import { lerp, normalizeNoise } from "./misc-utility";
import { MapWorld } from "./map-world";
import { Point } from "./point";
import Noise from "rot-js/lib/noise/noise";

export class MapPoles {
  public magnetismMap: { [key: string]: number };
  public scale: number;
  public tileWidth: number;
  public tileHeight: number;
  public range: number;
  public northPole: Point;
  public southPole: Point;

  constructor(private game: Game, private map: MapWorld) {
    this.magnetismMap = {};
    this.scale = 1.2;
    this.tileHeight = this.game.options.gameSize.height / 3;
    this.tileWidth = this.game.options.gameSize.width / 1.5;
    const poleYOffset = this.game.options.gameSize.width / 10;
    this.northPole = new Point(
      Math.floor(this.game.options.gameSize.width / 2),
      poleYOffset
    );
    this.southPole = new Point(
      Math.floor(this.game.options.gameSize.width / 2),
      this.game.options.gameSize.height - poleYOffset
    );
  }

  public generateMagnetism(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Noise
  ): number {
    const key = MapWorld.coordsToKey(x, y);

    let noiseX = x / width - 0.5;
    let noiseY = y / height - 0.5;
    noiseX = x / 3;
    noiseY = y / 3;
    let noiseValue = noise.get(noiseX, noiseY);
    noiseValue = normalizeNoise(noiseValue);

    // reduce noise value away from poles
    const xDistanceFromNorthPole = Math.abs(this.northPole.x - x);
    const yDistanceFromNorthPole = Math.abs(this.northPole.y - y);
    const xDistanceFromSouthPole = Math.abs(this.southPole.x - x);
    const yDistanceFromSouthPole = Math.abs(this.southPole.y - y);
    const xDistanceFromPole = Math.min(
      xDistanceFromNorthPole,
      xDistanceFromSouthPole
    );
    const yDistanceFromPole = Math.min(
      yDistanceFromNorthPole,
      yDistanceFromSouthPole
    );

    if (
      xDistanceFromPole > this.tileWidth ||
      yDistanceFromPole > this.tileHeight
    ) {
      noiseValue = 0;
    } else {
      noiseValue = Math.pow(noiseValue, 0.1); // scale and smooth values
      noiseValue = normalizeNoise(noiseValue);
      noiseValue *= 1 - xDistanceFromPole / this.tileWidth;
      noiseValue *= 1 - yDistanceFromPole / this.tileHeight;
    }

    this.magnetismMap[key] = lerp(noiseValue * this.scale, 0, 1);

    return this.magnetismMap[key];
  }

  // public generateMagnetism(
  //   x: number,
  //   y: number,
  //   width: number,
  //   height: number,
  //   noise: Simplex
  // ): number {
  //   const key = MapWorld.coordsToKey(x, y);

  //   let noiseX = x / width - 0.5;
  //   let noiseY = y / height - 0.5;
  //   noiseX = x / 3;
  //   noiseY = y / 3;
  //   let noiseValue = noise.get(noiseX, noiseY);
  //   noiseValue = normalizeNoise(noiseValue);

  //   // reduce noise value away from poles
  //   const distanceFromNorthPole = this.northPole.distance(new Point(x, y));
  //   const distanceFromSouthPole = this.southPole.distance(new Point(x, y));
  //   const distanceFromPole = Math.min(
  //     distanceFromNorthPole,
  //     distanceFromSouthPole
  //   );

  //   noiseValue = Math.pow(noiseValue, 0.1);
  //   noiseValue *= 1 - distanceFromPole / this.range;

  //   this.magnetismMap[key] = lerp(noiseValue * this.scale, 0, 1);

  //   return this.magnetismMap[key];
  // }

  getMagnetism(x: number, y: number): number {
    const key = MapWorld.coordsToKey(x, y);
    return this.magnetismMap[key];
  }
}
