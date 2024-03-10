import { Color, Lighting } from "rot-js/lib/index";
import { Game } from "./game";
import PreciseShadowcasting from "rot-js/lib/fov/precise-shadowcasting";
import { MapWorld } from "./map-world";
import { Color as ColorType } from "rot-js/lib/color";
import { Tile } from "./tile";
import { Viewport } from "./camera";
import { multiColorLerp } from "./misc-utility";

export class LightManager {
  public lightMap: { [key: string]: ColorType }; // x,y -> rgba color string
  public readonly lightDefaults: { [key: string]: ColorType };
  private lightingFov: PreciseShadowcasting;
  public lightEmitters: Lighting;
  private lightEmitterById: { [id: string]: [number, number] };
  public ambientLight: ColorType;
  public targetAmbientLight: ColorType;
  private cachedViewport: Viewport;

  constructor(private game: Game, private map: MapWorld) {
    this.lightDefaults = {
      sunlight: [255, 255, 255],
      moonlight: [70, 70, 135],
      ambientDaylight: [100, 100, 100],
      ambientNightLight: [60, 60, 60],
      torchBright: [235, 165, 30],
      torchDim: [200, 200, 30],
      fire: [240, 60, 60],
    };
    this.lightMap = {};
    this.lightEmitterById = {};
    this.calculateLightLevel(false); // initial
    this.calculateLightLevel(true); // target

    this.interpolateLightState(1);
    this.lightingFov = new PreciseShadowcasting(this.lightPasses.bind(this), {
      topology: 8,
    });
    this.lightEmitters = new Lighting(this.reflectivity.bind(this), {
      range: 6,
      passes: 2,
    });
    this.lightEmitters.setFOV(this.lightingFov);

    this.lightEmitters.compute(this.lightingCallback.bind(this));
    console.log("lightMap", this.lightMap);
  }

  public calculateLightLevel(calculateTarget = true) {
    // Set the target light state instead of the current light state
    let ambientLightToUpdate = this.targetAmbientLight;
    if (!calculateTarget) {
      ambientLightToUpdate = this.ambientLight;
    }
    if (this.game.timeManager.isDayTime) {
      ambientLightToUpdate = multiColorLerp(
        [
          this.lightDefaults.ambientDaylight,
          this.lightDefaults.sunlight,
          this.lightDefaults.ambientNightLight,
        ],
        this.game.timeManager.remainingCyclePercent
      );
    } else {
      ambientLightToUpdate = multiColorLerp(
        [
          this.lightDefaults.ambientDaylight,
          this.lightDefaults.moonlight,
          this.lightDefaults.ambientNightLight,
        ],
        this.game.timeManager.remainingCyclePercent
      );
    }

    if (!calculateTarget) {
      this.ambientLight = ambientLightToUpdate;
    } else {
      this.targetAmbientLight = ambientLightToUpdate;
    }
  }

  lerp(x: number, y: number, a: number): number {
    return x * (1 - a) + y * a;
  }

  private lightPasses(x: number, y: number): boolean {
    var key = MapWorld.coordsToKey(x, y);
    if (key in this.map.tileMap) {
      // return this.map.terrainTileMap[key].biomeType != "hills";
      return true;
    }
    return false;
  }

  public clearLightMap() {
    this.lightMap = {};
  }

  public reflectivity(x: number, y: number) {
    const key = MapWorld.coordsToKey(x, y);
    const biome = this.map.biomeMap[key];
    if (!biome) {
      return 0;
    }
    const isBlocking = biome.id == "hills" || biome.id == "grass";
    const isWater =
      biome.id == "ocean" || biome.id == "oceandeep" || biome.id == "swamp";
    const isReflectiveDirt = biome.id == "sandydirt" || biome.id == "beach";
    const isShadowed = biome.id == "forestgrass" || biome.id == "valley";
    if (isBlocking) {
      return 0;
    }
    if (isShadowed) {
      return 0.13;
    }
    if (isReflectiveDirt) {
      return 0.28;
    }
    if (isWater) {
      return 0.37;
    }
    return 0.22;
  }

  public lightingCallback(x: number, y: number, color: ColorType) {
    if (this.game.userInterface.camera.inViewport(x, y)) {
      this.lightMap[MapWorld.coordsToKey(x, y)] = color;
    }
  }

  public interpolateLightState(deltaTime: number) {
    // Interpolate between the current light state and the target light state based on
    // how much time has passed since the last frame
    this.ambientLight = Color.lerp(
      this.ambientLight,
      this.targetAmbientLight,
      deltaTime
    );
  }

  public calculateLighting(deltaTime: number) {
    // Interpolate the light state before computing the lighting
    this.interpolateLightState(deltaTime);
    this.lightEmitters.compute(this.lightingCallback.bind(this));
  }

  public clearAllDynamicLights() {
    for (let entity of this.game.entities) {
      if (this.lightEmitterById[entity.id]) {
        const [x, y] = this.lightEmitterById[entity.id];
        this.lightEmitters.setLight(x, y, null);
        this.lightEmitterById[entity.id] = null;
      }
    }
  }

  public clearChangedDynamicLights() {
    for (let entity of this.game.entities) {
      if (this.lightEmitterById[entity.id]) {
        const [x, y] = this.lightEmitterById[entity.id];
        if (entity.position.x != x || entity.position.y != y) {
          this.lightEmitters.setLight(x, y, null);
          this.lightEmitterById[entity.id] = null;
        }
      }
    }
  }

  public updateDynamicLighting() {
    if (this.game.timeManager.isNighttime) {
      for (let entity of this.game.entities) {
        this.lightEmitterById[entity.id] = [
          entity.position.x,
          entity.position.y,
        ];
        this.lightEmitters.setLight(
          entity.position.x,
          entity.position.y,
          this.lightDefaults.torchBright
        );
      }
    }
  }
}
