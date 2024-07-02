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

  constructor(private game: Game, private map: MapWorld) {
    this.lightDefaults = {
      fullLight: [255, 255, 255],
      purple: [255, 0, 255],
      highLight: [240, 240, 240],
      mediumLight: [230, 230, 230],
      sunlight: [255, 255, 255],
      yellowLight: [255, 240, 230],
      blueLight: [65, 65, 110],
      moonlight: [90, 90, 150],
      ambientDaylight: [100, 100, 100],
      ambientSunset: [250, 205, 160],
      ambientNightLight: [60, 60, 60],
      torchBright: [235, 165, 30],
      torchDim: [200, 200, 30],
      fire: [240, 60, 60],
      ambientOcc: [50, 50, 60], // how much to reduce from full brightness when in shadow
      // cloudShadow: [50, 50, 55], // how much to reduce from full brightness when in cloud shadow
      cloudShadow: [20, 20, 27], // how much to reduce from full brightness when in cloud shadow
      cloudShadowSetting: [60, 60, 60], // how much to reduce from full brightness when in cloud shadow
      shadowSunset: [200, 60, 40],
      shadowSunrise: [30, 30, 42], // blue
    };
    this.lightMap = {};
    this.lightEmitterById = {};
    this.interpolateAmbientLight(false); // initial
    this.interpolateAmbientLight(true); // target

    this.interpolateLightState();
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

  public interpolateAmbientLight(calculateTarget = true) {
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
    if (!this.map.isPassable(x, y)) {
      return false;
    }

    if (this.game.isOccupiedByTree(x, y)) {
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

  public interpolateLightState() {
    const progress = this.game.timeManager.turnAnimTimePercent;
    // Interpolate between the current light state and the target light state based on
    // the progress from start to this.game.options.maxTurnDelay
    this.ambientLight = Color.lerp(
      this.ambientLight,
      this.targetAmbientLight,
      progress
    );
  }

  public renderUpdate(interpPercent: number) {
    // Interpolate the light state before computing the lighting
    this.interpolateLightState();
  }

  public recalculateDynamicLighting() {
    this.lightEmitters.compute(this.lightingCallback.bind(this));
  }

  public clearAllDynamicLights() {
    for (let actor of this.game.actorManager.actors) {
      if (this.lightEmitterById[actor.id]) {
        const [x, y] = this.lightEmitterById[actor.id];
        this.lightEmitters.setLight(x, y, null);
        this.lightEmitterById[actor.id] = null;
      }
    }
  }

  public clearChangedDynamicLights() {
    for (let actor of this.game.actorManager.actors) {
      if (this.lightEmitterById[actor.id]) {
        const [x, y] = this.lightEmitterById[actor.id];
        if (actor.position.x != x || actor.position.y != y) {
          this.lightEmitters.setLight(x, y, null);
          this.lightEmitterById[actor.id] = null;
        }
      }
    }
  }

  public updateDynamicLighting() {
    if (this.game.timeManager.isNighttime) {
      for (let actor of this.game.actorManager.actors) {
        let updateLight = false;
        if (!this.lightEmitterById[actor.id]) {
          updateLight = true;
        }
        if (this.lightEmitterById[actor.id]) {
          const [x, y] = this.lightEmitterById[actor.id];
          if (actor.position.x != x || actor.position.y != y) {
            updateLight = true;
          }
        }

        if (updateLight) {
          this.lightEmitterById[actor.id] = [
            actor.position.x,
            actor.position.y,
          ];
          this.lightEmitters.setLight(
            actor.position.x,
            actor.position.y,
            this.lightDefaults.torchBright
          );
        }
      }
    }
  }

  public getLightColorFor(
    x: number,
    y: number,
    lightMap: { [pos: string]: ColorType } = null, // x,y -> color based on light sources
    shadowMap: { [pos: string]: number } = null, // x,y -> number based on sun position
    occlusionMap: { [pos: string]: number } = null, // x,y -> number based on occlusion
    cloudMap: { [pos: string]: number } = null, // x,y -> number based on cloud cover
    highlight: boolean = false
  ): ColorType {
    const key = MapWorld.coordsToKey(x, y);
    const ambientLight = this.ambientLight;
    const isDaytime = this.game.timeManager.isDayTime;
    const phase = this.game.timeManager.lightPhase;
    const isNight = this.game.timeManager.isNighttime;
    const isSettingPhase = phase === LightPhase.setting;
    let shadow = isSettingPhase
      ? this.lightDefaults.shadowSunset
      : this.lightDefaults.shadowSunrise;
    let ambientOccShadow = this.lightDefaults.ambientOcc;
    const shadowLevel = shadowMap[key];
    const occlusionLevel = occlusionMap[key];
    const isShadowed =
      Math.abs(shadowLevel - this.game.map.shadowMap.ambientLightStrength) >
      0.01;
    const isOccluded = occlusionLevel !== 1;
    const cloudLevel = cloudMap[key];
    const isClouded = cloudLevel > this.map.cloudMap.cloudMinLevel;
    const isCloudClear = cloudLevel < this.map.cloudMap.sunbeamMaxLevel;

    const shadowStrength = this.game.map.shadowMap.shadowStrength;
    let ambOccShadowStrength =
      this.game.map.shadowMap.ambientOcclusionShadowStrength;
    const cloudStrength = this.game.map.cloudMap.cloudStrength;
    const sunbeamStrength = this.game.map.cloudMap.sunbeamStrength;
    let cloudShadow = Color.multiply(
      isSettingPhase
        ? this.lightDefaults.cloudShadowSetting
        : this.lightDefaults.cloudShadow,
      ambientLight
    );
    // const cloudShadow = Color.multiply(
    //   !isNight && isSettingPhase
    //     ? this.lightDefaults.cloudShadowSetting
    //     : this.lightDefaults.cloudShadow,
    //   ambientLight
    // );
    // console.log(this.game.timeManager.remainingCyclePercent);
    if (!isNight && isSettingPhase) {
      // console.log(this.game.timeManager.remainingCyclePercent);

      cloudShadow = Color.interpolate(
        cloudShadow,
        ambientLight,
        1 - this.game.timeManager.remainingPhasePercent
      );
    }

    let light = ambientLight;

    if (key in lightMap && lightMap[key] != null) {
      // override shadows light if there is a light source
      light = Color.add(light, lightMap[key]);
    } else {
      if (isOccluded) {
        light = Color.interpolate(
          light,
          ambientOccShadow,
          (1 - occlusionLevel) * ambOccShadowStrength
        );
      }
      if (isShadowed && isDaytime) {
        light = Color.interpolate(
          light,
          shadow,
          (1 - shadowLevel) * shadowStrength
        );
      }
    }
    light = Color.multiply(ambientLight, light);

    if (isClouded && isDaytime) {
      //darken the light very slightly based on cloudStrength
      // 1 - cloudLevel to darken the areas where cloud level is high.
      // cloudLevel - cloudMinLevel to only darken clouds where the cloud level is above a certain threshold.
      light = Color.interpolate(
        light,
        cloudShadow,
        1 - cloudStrength * (1 - (cloudLevel - this.map.cloudMap.cloudMinLevel))
      );
    }

    if (isCloudClear) {
      // // light = Color.interpolate(light, ambientOccShadow, 1 - shadowStrength);
      // light = Color.interpolate(ambientOccShadow, light, shadowStrength * 0.9);
      // light = Color.interpolate(
      //   light,
      //   this.game.map.lightManager.lightDefaults.purple,
      //   cloudStrength * cloudLevel
      // );
      light = Color.interpolate(
        light,
        // this.lightDefaults.purple,
        isNight ? this.lightDefaults.blueLight : this.lightDefaults.yellowLight,
        cloudStrength *
          ((this.map.cloudMap.sunbeamMaxLevel - cloudLevel) * sunbeamStrength)
      );

      // light = Color.interpolate(
      //   light,
      //   isNight
      //     ? this.game.map.lightManager.lightDefaults.blueLight
      //     : this.game.map.lightManager.lightDefaults.yellowLight,
      //   cloudStrength *
      //     ((0.25 - cloudLevel) * 1)
      // );
    }

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
