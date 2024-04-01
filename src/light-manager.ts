import { Color, Lighting } from "rot-js/lib/index";
import { Game } from "./game";
import PreciseShadowcasting from "rot-js/lib/fov/precise-shadowcasting";
import { MapWorld } from "./map-world";
import { Color as ColorType } from "rot-js/lib/color";
import { Tile } from "./tile";
import { Viewport } from "./camera";
import { multiColorLerp } from "./misc-utility";
import { Autotile } from "./autotile";
import { BiomeId } from "./biomes";
import { LightPhase } from "./map-shadows";

export const ImpassibleLightBorder: BiomeId[] = [
  "hillslow",
  "hillsmid",
  "hillshigh",
];

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
      fullLight: [255, 255, 255],
      sunlight: [255, 255, 255],
      moonlight: [90, 90, 150],
      ambientDaylight: [100, 100, 100],
      ambientSunset: [250, 215, 200],
      ambientNightLight: [60, 60, 60],
      torchBright: [235, 165, 30],
      torchDim: [200, 200, 30],
      fire: [240, 60, 60],
      shadow: [239, 230, 241],
      ambientOcc: [225, 225, 233], // how much to reduce from full brightness when in shadow
      shadowSunset: [255, 230, 180], // orange
      shadowSunrise: [215, 215, 225], // blue
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
    const isDaytime = this.game.timeManager.isDayTime;
    const phase = this.game.timeManager.lightPhase;
    if (!calculateTarget) {
      ambientLightToUpdate = this.ambientLight;
    }
    if (isDaytime) {
      if (phase === LightPhase.rising) {
        ambientLightToUpdate = Color.lerp(
          this.lightDefaults.ambientDaylight,
          this.lightDefaults.sunlight,
          this.game.timeManager.remainingPhasePercent
        );
      } else if (phase === LightPhase.peak) {
        ambientLightToUpdate = this.lightDefaults.sunlight;
      } else {
        ambientLightToUpdate = multiColorLerp(
          [
            this.lightDefaults.ambientDaylight,
            this.lightDefaults.ambientSunset,
            this.lightDefaults.sunlight,
          ],
          this.game.timeManager.remainingPhasePercent
        );
      }
    } else {
      if (phase === LightPhase.rising) {
        ambientLightToUpdate = multiColorLerp(
          [
            this.lightDefaults.ambientDaylight,
            this.lightDefaults.ambientNightLight,
            this.lightDefaults.moonlight,
          ],
          this.game.timeManager.remainingPhasePercent
        );
      } else if (phase === LightPhase.peak) {
        ambientLightToUpdate = this.lightDefaults.moonlight;
      } else {
        ambientLightToUpdate = multiColorLerp(
          [
            this.lightDefaults.ambientDaylight,
            this.lightDefaults.ambientNightLight,
            this.lightDefaults.moonlight,
          ],
          this.game.timeManager.remainingPhasePercent
        );
      }
    }

    if (!calculateTarget) {
      this.ambientLight = ambientLightToUpdate;
    } else {
      this.targetAmbientLight = ambientLightToUpdate;
    }
  }

  private lightPasses(x: number, y: number): boolean {
    const tile = this.map.getTile(x, y);
    if (!tile) {
      return false;
    }
    if (ImpassibleLightBorder.includes(tile.biomeId)) {
      return false;
    }

    if (this.game.isOccupiedByPlant(x, y)) {
      return false;
    }

    return true;
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
    const isBlocking =
      biome.id == "hillsmid" ||
      biome.id == "hillslow" ||
      biome.id == "hillshigh" ||
      biome.id == "grass";
    const isWater =
      biome.id == "ocean" || biome.id == "oceandeep" || biome.id == "swamp";
    const isReflectiveDirt = biome.id == "sandydirt" || biome.id == "beach";
    const isShadowed = biome.id == "grass" || biome.id == "valley";
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

  public getLightColorFor(
    x: number,
    y: number,
    lightMap: { [pos: string]: ColorType } = null, // x,y -> color based on light sources
    shadowMap: { [pos: string]: number } = null, // x,y -> number based on sun position
    occlusionMap: { [pos: string]: number } = null, // x,y -> number based on occlusion
    highlight: boolean = false
  ): ColorType {
    const key = MapWorld.coordsToKey(x, y);
    const ambientLight = this.ambientLight;
    const isDaytime = this.game.timeManager.isDayTime;
    // let shadow = this.game.map.lightManager.lightDefaults.shadow;

    const phase = this.game.timeManager.lightPhase;
    let shadow = isDaytime
      ? this.lightDefaults.shadow
      : this.lightDefaults.shadow;
    let ambientOccShadow = this.lightDefaults.ambientOcc;
    const shadowLevel = shadowMap[key];
    const occlusionLevel = occlusionMap[key];
    const isShadowed =
      Math.abs(shadowLevel - this.game.map.sunMap.ambientLightStrength) > 0.01;
    const isOccluded =
      Math.abs(occlusionLevel - this.game.map.sunMap.ambientLightStrength) >
      0.01;

    const shadowStrength = this.game.map.sunMap.shadowStrength;
    const ambOccShadowStrength =
      this.game.map.sunMap.ambientOcclusionShadowStrength;

    let light = ambientLight;

    if (key in lightMap && lightMap[key] != null) {
      // override shadows light if there is a light source
      light = Color.add(light, lightMap[key]);
    } else {
      if (isOccluded) {
        ambientOccShadow = Color.interpolate(
          this.lightDefaults.fullLight,
          this.lightDefaults.ambientOcc,
          ambOccShadowStrength
        );
        light = Color.multiply(light, ambientOccShadow);
      }
      if (isShadowed && isDaytime) {
        shadow = Color.interpolate(
          phase == LightPhase.rising
            ? this.game.map.lightManager.lightDefaults.shadowSunrise
            : this.game.map.lightManager.lightDefaults.shadowSunset,
          shadow,
          shadowStrength
        );
        shadow = Color.interpolate(
          shadow,
          this.lightDefaults.shadow,
          shadowLevel
        );
        light = Color.multiply(light, shadow);
      }
    }
    light = Color.multiply(ambientLight, light);

    if (highlight) {
      light = Color.interpolate(
        light,
        this.game.map.lightManager.lightDefaults.fullLight,
        0.4
      );
    }
    return light;
  }
}
