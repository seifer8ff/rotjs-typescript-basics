import { Color as ColorType } from "rot-js/lib/color";
import { indexToXY, positionToIndex } from "./misc-utility";
import { Layer } from "./renderer";
import { LightManager } from "./light-manager";
import { Color } from "rot-js";
import { LightPhase } from "./map-shadows";

console.log("--------  -- - - - - ---- ---test");

onmessage = (e) => {
  const {
    viewportTiles,
    dynamicLightMap,
    sunMap,
    occlusionMap,
    cloudMap,
    options,
  }: {
    viewportTiles: number[];
    dynamicLightMap: ColorType[];
    sunMap: number[];
    occlusionMap: number[];
    cloudMap: number[];
    options: {
      ambientLight: ColorType;
      isDaytime: boolean;
      lightPhase: LightPhase;
      ambientLightStrength: number;
      minCloudLevel: number;
      maxSunbeamLevel: number;
      shadowStrength: number;
      ambientOcclusionShadowStrength: number;
      cloudStrength: number;
      sunbeamStrength: number;
      remainingPhasePercent: number;
      lightDefaults: {
        [key: string]: ColorType;
      };
    };
  } = e?.data.data;
  if (viewportTiles) {
    const lightMap = calculateLightMap(
      viewportTiles,
      dynamicLightMap,
      sunMap,
      occlusionMap,
      cloudMap,
      options
    );

    postMessage(lightMap);
  }
};

const calculateLightMap = (
  viewportTiles: number[],
  dynamicLightMap: ColorType[],
  sunMap: number[],
  occlusionMap: number[],
  cloudMap: number[],
  options: {
    ambientLight: ColorType;
    isDaytime: boolean;
    lightPhase: LightPhase;
    ambientLightStrength: number;
    minCloudLevel: number;
    maxSunbeamLevel: number;
    shadowStrength: number;
    ambientOcclusionShadowStrength: number;
    cloudStrength: number;
    sunbeamStrength: number;
    remainingPhasePercent: number;
    lightDefaults: {
      [key: string]: ColorType;
    };
  }
) => {
  let pos: [number, number];
  if (!viewportTiles) {
    return [];
  }
  const lightMap = [];

  viewportTiles.forEach((posIndex) => {
    pos = indexToXY(posIndex, Layer.TERRAIN);
    lightMap[posIndex] = calculateLightFor(
      pos[0],
      pos[1],
      dynamicLightMap,
      sunMap,
      occlusionMap,
      cloudMap,
      options,
      false
    );
  });
  return lightMap;
};

const calculateLightFor = (
  x: number,
  y: number,
  lightMap: ColorType[], // x,y -> color based on light sources
  shadowMap: number[], // x,y -> number based on sun position
  occlusionMap: number[], // x,y -> number based on occlusion
  cloudMap: number[], // x,y -> number based on cloud cover
  options: {
    ambientLight: ColorType;
    isDaytime: boolean;
    lightPhase: LightPhase;
    ambientLightStrength: number;
    minCloudLevel: number;
    maxSunbeamLevel: number;
    shadowStrength: number;
    ambientOcclusionShadowStrength: number;
    cloudStrength: number;
    sunbeamStrength: number;
    remainingPhasePercent: number;
    lightDefaults: {
      [key: string]: ColorType;
    };
  },
  highlight: boolean = false
): ColorType => {
  const posIndex = positionToIndex(x, y, Layer.TERRAIN);
  const ambientLight = options.ambientLight;
  const isDaytime = options.isDaytime;
  const phase = options.lightPhase;
  const isNight = !options.isDaytime;
  const isSettingPhase = phase === LightPhase.setting;
  let shadow = isSettingPhase
    ? options.lightDefaults.shadowSunset
    : options.lightDefaults.shadowSunrise;
  let ambientOccShadow = options.lightDefaults.ambientOcc;
  const shadowLevel = shadowMap[posIndex];
  const occlusionLevel = occlusionMap[posIndex];
  const isShadowed =
    Math.abs(shadowLevel - options.ambientLightStrength) > 0.01;
  const isOccluded = occlusionLevel !== 1;
  const cloudLevel = cloudMap[posIndex];
  const isClouded = cloudLevel > options.minCloudLevel;
  const isCloudClear = cloudLevel < options.maxSunbeamLevel;

  const shadowStrength = options.shadowStrength;
  let ambOccShadowStrength = options.ambientOcclusionShadowStrength;
  const cloudStrength = options.cloudStrength;
  const sunbeamStrength = options.sunbeamStrength;
  let cloudShadow = Color.multiply(
    isSettingPhase
      ? options.lightDefaults.cloudShadowSetting
      : options.lightDefaults.cloudShadow,
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
      1 - options.remainingPhasePercent
    );
  }

  let light = ambientLight;
  let lightMapValue = lightMap[posIndex];

  if (lightMapValue != undefined) {
    // override shadows light if there is a light source
    light = Color.add(light, lightMapValue);
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
      1 - cloudStrength * (1 - (cloudLevel - options.minCloudLevel))
    );
  }

  if (isCloudClear) {
    // // light = Color.interpolate(light, ambientOccShadow, 1 - shadowStrength);
    // light = Color.interpolate(ambientOccShadow, light, shadowStrength * 0.9);
    // light = Color.interpolate(
    //   light,
    //   this.game.map.options.lightDefaults.purple,
    //   cloudStrength * cloudLevel
    // );
    light = Color.interpolate(
      light,
      // this.lightDefaults.purple,
      isNight
        ? options.lightDefaults.blueLight
        : options.lightDefaults.yellowLight,
      cloudStrength * ((options.maxSunbeamLevel - cloudLevel) * sunbeamStrength)
    );

    // light = Color.interpolate(
    //   light,
    //   isNight
    //     ? this.game.map.options.lightDefaults.blueLight
    //     : this.game.map.options.lightDefaults.yellowLight,
    //   cloudStrength *
    //     ((0.25 - cloudLevel) * 1)
    // );
  }

  if (highlight) {
    light = Color.interpolate(light, options.lightDefaults.fullLight, 0.4);
  }
  return light;
};
