import { Color, Lighting, Map as RotJsMap } from "rot-js/lib/index";
import { RNG } from "rot-js";
import { Game } from "./game";
import { Biome, BiomeType, Season, Tile, TileType } from "./tile";
import { Point } from "./point";
import { Actor } from "./entities/actor";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import PreciseShadowcasting from "rot-js/lib/fov/precise-shadowcasting";
import Map from "rot-js/lib/map/map";
import { MapWorld } from "./map-world";
import { Color as ColorType, lerp, toHex, toRGB } from "rot-js/lib/color";

export class LightManager {
  public lightMap: { [key: string]: string }; // x,y -> rgba color string
  public readonly lightDefaults: { [key: string]: ColorType };
  private lightingFov: PreciseShadowcasting;
  public lightEmitters: Lighting;
  public ambientLight: ColorType;
  public shadowLight: ColorType;

  constructor(private game: Game, private map: MapWorld) {
    this.lightDefaults = {
      sunlight: [255, 255, 255],
      moonlight: [70, 70, 135],
      ambientDaylight: [100, 100, 100],
      shadowDaylight: [50, 50, 50],
      ambientNightLight: [60, 60, 60],
      shadowNightLight: [25, 25, 25],
      torchBright: [240, 240, 30],
      torchDim: [200, 200, 30],
      fire: [240, 60, 60],
    };
    this.lightMap = {};
    this.calculateLightLevel();
    this.lightingFov = new PreciseShadowcasting(this.lightPasses.bind(this), {
      topology: 4,
    });
    this.lightEmitters = new Lighting(this.reflectivity.bind(this), {
      range: 10,
      passes: 2,
    });
    this.lightEmitters.setFOV(this.lightingFov);

    this.lightEmitters.compute(this.lightingCallback.bind(this));
    console.log("lightMap", this.lightMap);
  }

  public calculateLightLevel() {
    if (this.game.timeManager.isDayTime) {
      this.ambientLight = this.multiColorLerp(
        [
          this.lightDefaults.ambientDaylight,
          this.lightDefaults.sunlight,
          this.lightDefaults.ambientNightLight,
        ],
        this.game.timeManager.remainingCyclePercent
      );
      this.shadowLight = Color.interpolate(
        this.lightDefaults.shadowNightLight,
        this.lightDefaults.shadowDaylight,
        this.game.timeManager.remainingCyclePercent
      );
    } else {
      this.ambientLight = this.multiColorLerp(
        [
          this.lightDefaults.ambientDaylight,
          this.lightDefaults.moonlight,
          this.lightDefaults.ambientNightLight,
        ],
        this.game.timeManager.remainingCyclePercent
      );
      this.shadowLight = Color.interpolate(
        this.lightDefaults.shadowNightLight,
        this.lightDefaults.shadowDaylight,
        this.game.timeManager.remainingCyclePercent
      );
    }
  }

  lerp(x: number, y: number, a: number): number {
    return x * (1 - a) + y * a;
  }

  public multiColorLerp(colors: ColorType[], t: number): ColorType {
    t = Math.max(0, Math.min(1, t));
    const delta = 1 / (colors.length - 1);
    const startIndex = Math.floor(t / delta);
    if (startIndex === colors.length - 1) {
      return colors[colors.length - 1];
    }
    const localT = (t % delta) / delta;
    return [
      this.lerp(colors[startIndex][0], colors[startIndex + 1][0], localT),
      this.lerp(colors[startIndex][1], colors[startIndex + 1][1], localT),
      this.lerp(colors[startIndex][2], colors[startIndex + 1][2], localT),
    ];
  }

  // UpdateFOV(actor: Actor, innerRadius: number = 4, outerRadius: number = 14) {
  //   const fov = new PreciseShadowcasting(this.lightPasses.bind(this));

  //   /* output callback */
  //   fov.compute(
  //     actor.position.x,
  //     actor.position.y,
  //     outerRadius,
  //     (xPos, yPos, r, visibility) => {
  //       const dx = xPos - actor.position.x;
  //       const dy = yPos - actor.position.y;
  //       const distanceSquared = dx * dx + dy * dy;
  //       const key = this.coordinatesToKey(xPos, yPos);
  //       const fovLightColor: ColorType = [240, 180, 100];

  //       if (
  //         xPos < 0 ||
  //         yPos < 0 ||
  //         xPos >= this.game.mapSize.width ||
  //         yPos >= this.game.mapSize.height
  //       ) {
  //         // outside of map bounds
  //         return;
  //       }

  //       if (distanceSquared > outerRadius * outerRadius) {
  //         // outside of visible range
  //         return;
  //       }

  //       const midRadius = Math.floor((innerRadius + outerRadius) / 2);
  //       const innerRadiusSquared = innerRadius * innerRadius;
  //       const midRadiusSquared = midRadius * midRadius;

  //       if (distanceSquared <= innerRadiusSquared || r == 0) {
  //         // tile is within inner radius
  //         // this.lightMap[key] = Color.interpolate(
  //         //   fovLightColor,
  //         //   baseColor,
  //         //   1
  //         // );
  //         this.lightMap[key] = toRGB(fovLightColor);
  //         return;
  //       }

  //       let tileVisibilty: number;
  //       tileVisibilty = 1 / Math.abs(r - midRadius / 2);
  //       // if (distanceSquared <= midRadiusSquared) {
  //       //   // constrain mid radius darkness to 0.2
  //       //   tileVisibilty = this.lerp(0, 1, 1 / Math.abs(r - innerRadius / 2));
  //       // } else {
  //       //   // start calculating outer radius darkness from midpoint rather than actor pos
  //       //   tileVisibilty = 1 / Math.abs(r - midRadius / 2);
  //       // }

  //       let baseColorString = this.lightMap[key];
  //       let baseColor: ColorType;
  //       if (!baseColorString) {
  //         baseColorString = toRGB(this.ambientLight);
  //       }
  //       baseColor = Color.fromString(baseColorString);
  //       if (!baseColor) {
  //         return;
  //       }

  //       const interpolatedColor = Color.interpolate(
  //         baseColor,
  //         fovLightColor,
  //         tileVisibilty
  //       );

  //       // scale white to a shade of black
  //       // const colorValue = Math.floor(255 * tileVisibilty);
  //       // const colorValue = Math.floor(this.lightMap[this.coordinatesToKey(x, y)] * tileVisibilty);
  //       // if (colorValue === Infinity) {
  //       //   // prevent any edge cases/bugs from reaching the renderer
  //       //   return;
  //       // }

  //       // update the light map for this position
  //       // this.lightMap[key] = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;
  //       this.lightMap[key] = toRGB(interpolatedColor);
  //     }
  //   );
  // }

  // UpdateFOV(actor: Actor, innerRadius: number = 4, outerRadius: number = 14) {
  //   const fov = new PreciseShadowcasting(this.lightPasses.bind(this));

  //   /* output callback */
  //   fov.compute(
  //     actor.position.x,
  //     actor.position.y,
  //     outerRadius,
  //     (xPos, yPos, r, visibility) => {
  //       const dx = xPos - actor.position.x;
  //       const dy = yPos - actor.position.y;
  //       const distanceSquared = dx * dx + dy * dy;
  //       const key = this.coordinatesToKey(xPos, yPos);
  //       const fovLightColor: ColorType = [240, 100, 60];

  //       if (
  //         xPos < 0 ||
  //         yPos < 0 ||
  //         xPos >= this.game.mapSize.width ||
  //         yPos >= this.game.mapSize.height
  //       ) {
  //         // outside of map bounds
  //         return;
  //       }

  //       if (distanceSquared > outerRadius * outerRadius) {
  //         // outside of visible range or at the actor's position
  //         return;
  //       }

  //       const midRadius = Math.floor((innerRadius + outerRadius) / 2);
  //       const innerRadiusSquared = innerRadius * innerRadius;
  //       const midRadiusSquared = midRadius * midRadius;

  //       if (distanceSquared <= innerRadiusSquared || r == 0) {
  //         // tile is within inner radius
  //         // this.lightMap[key] = Color.interpolate(
  //         //   fovLightColor,
  //         //   baseColor,
  //         //   1
  //         // );
  //         this.lightMap[key] = toHex(fovLightColor);
  //         return;
  //       }

  //       let tileVisibilty: number;
  //       if (distanceSquared <= midRadiusSquared) {
  //         // constrain mid radius darkness to 0.2
  //         tileVisibilty = this.lerp(0, 1, 1 / Math.abs(r - innerRadius / 2));
  //       } else {
  //         // start calculating outer radius darkness from midpoint rather than actor pos
  //         tileVisibilty = 1 / Math.abs(r - midRadius / 2);
  //       }

  //       let baseColorString = this.lightMap[key];
  //       let baseColor: ColorType;
  //       if (!baseColorString) {
  //         baseColorString = toHex(this.ambientLight);
  //       }
  //       baseColor = Color.fromString(baseColorString);
  //       if (!baseColor) {
  //         return;
  //       }

  //       const modColor = Color.interpolate(
  //         baseColor,
  //         fovLightColor,
  //         tileVisibilty
  //       );
  //       console.log("tileVisibilty", tileVisibilty, "modColor", modColor);

  //       // scale white to a shade of black
  //       // const colorValue = Math.floor(255 * tileVisibilty);
  //       // const colorValue = Math.floor(this.lightMap[this.coordinatesToKey(x, y)] * tileVisibilty);
  //       // if (colorValue === Infinity) {
  //       //   // prevent any edge cases/bugs from reaching the renderer
  //       //   return;
  //       // }

  //       // update the light map for this position
  //       // this.lightMap[key] = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;
  //       this.lightMap[key] = toHex(modColor);
  //     }
  //   );
  // }

  private lightPasses(x: number, y: number): boolean {
    var key = this.coordinatesToKey(x, y);
    // console.log("key: ", key);
    if (key in this.map.terrainTileMap) {
      // console.log("light pass: ", this.map.terrainTileMap[key]);
      return this.map.terrainTileMap[key].biomeType != "ocean";
    }
    return false;
  }

  public clearLightMap() {
    this.lightMap = {};
  }

  private coordinatesToKey(x: number, y: number): string {
    return x + "," + y;
  }

  private keyToPoint(key: string): Point {
    let parts = key.split(",");
    return new Point(parseInt(parts[0]), parseInt(parts[1]));
  }

  public reflectivity(x: number, y: number) {
    return this.map.terrainTileMap[this.coordinatesToKey(x, y)] == Tile.water
      ? 0
      : 0.4;
  }

  public lightingCallback(x: number, y: number, color: ColorType) {
    this.lightMap[this.coordinatesToKey(x, y)] = toRGB(color);
  }

  public calculateLighting() {
    this.lightEmitters.compute(this.lightingCallback.bind(this));
  }
}
