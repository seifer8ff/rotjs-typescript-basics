import { Game } from "./game";
import {
  getScaledNoise,
  indexToPosition,
  indexToXY,
  lerp,
  positionToIndex,
} from "./misc-utility";
import { MapWorld } from "./map-world";
import { Point } from "./point";
import { Biomes } from "./biomes";
import Noise from "rot-js/lib/noise/noise";
import { LightPhase } from "./map-shadows";
import { RNG } from "rot-js";
import { GameSettings } from "./game-settings";
import { Layer } from "./renderer";

export class MapClouds {
  public windSpeed: Point; // vector of cloud speed and direction
  public cloudMap: number[];
  public targetCloudMap: number[];
  public cloudStrength: number;
  public sunbeamStrength: number;
  public baseCloudNoise: number;
  public baseWindSpeed: number;
  public cloudMinLevel: number; // threshold for when a cloud begins
  public sunbeamMaxLevel: number; // threshold for when a sunbeam ends
  private cloudOffset: Point; // offset for cloud noise generator simulates cloud movement

  constructor(private game: Game, private map: MapWorld) {
    this.cloudMap = [];
    this.targetCloudMap = [];
    this.cloudStrength = 1;
    this.sunbeamStrength = 0.7;
    this.windSpeed = new Point(0.5, -0.2);
    this.cloudMinLevel = 0.75;
    this.sunbeamMaxLevel = 0.3;
    this.baseWindSpeed = 0.5 / 100;
    this.baseCloudNoise = 35;
    this.cloudOffset = new Point(0, 0);
  }

  public init() {
    this.cloudMap = [];
    this.targetCloudMap = [];
    let posIndex: number;
    for (let i = 0; i < GameSettings.options.gameSize.width; i++) {
      for (let j = 0; j < GameSettings.options.gameSize.height; j++) {
        posIndex = positionToIndex(i, j, Layer.TERRAIN);
        this.cloudMap[posIndex] = 0;
        this.targetCloudMap[posIndex] = 0;
      }
    }
  }

  public generateCloudMap(): void {
    const width = GameSettings.options.gameSize.width;
    const height = GameSettings.options.gameSize.height;
    this.updateCloudOffset();
    this.updateWindSpeed();

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const posIndex = positionToIndex(x, y, Layer.TERRAIN);
        this.cloudMap[posIndex] = this.generateCloudLevel(
          x,
          y,
          width,
          height,
          this.game.noise
        );
        this.targetCloudMap[posIndex] = this.cloudMap[posIndex];
      }
    }
    this.interpolateStrength();
  }

  public generateCloudLevel(
    x: number,
    y: number,
    width: number,
    height: number,
    noise: Noise
  ): number {
    const key = MapWorld.coordsToKey(x, y);
    const biome = this.map.biomeMap[key];
    let noiseX = x / width - 0.5;
    let noiseY = y / height - 0.5;

    noiseX += this.cloudOffset.x;
    noiseY += this.cloudOffset.y;

    let cloudLevel = 0;
    let cloudLevelNoise = 0;
    let offset = 155; // any value works, just offsets the noise for other octaves

    let cloudSize = 10;
    let cloudIntensity = 0.33;

    switch (biome?.id) {
      case Biomes.Biomes.oceandeep.id:
        cloudSize = 2;
        cloudIntensity = 0.44;
        break;
      case Biomes.Biomes.ocean.id:
        cloudSize = 4.5;
        cloudIntensity = 0.42;
        break;
      case Biomes.Biomes.hillshigh.id:
      case Biomes.Biomes.hillsmid.id:
        cloudSize = 19;
        cloudIntensity = 0.37;
        break;
      case Biomes.Biomes.hillslow.id:
        cloudSize = 15;
        cloudIntensity = 0.33;
      case Biomes.Biomes.swamp.id:
        cloudIntensity = 0.34;
      default:
        cloudSize = 12;
        break;
    }

    // basic big smooth soft clouds and sunbeams
    cloudLevelNoise =
      cloudIntensity *
      getScaledNoise(noise, cloudSize * noiseX, cloudSize * noiseY);
    cloudLevel += cloudLevelNoise;

    // medium clouds where there are no sunbeams
    cloudLevelNoise =
      (cloudIntensity + 0.12) *
      getScaledNoise(
        noise,
        cloudSize + 10 * (noiseX + offset),
        cloudSize + 10 * (noiseY + offset)
      );

    if (cloudLevel > this.sunbeamMaxLevel) {
      cloudLevel += cloudLevelNoise;
    }

    cloudLevelNoise =
      (cloudIntensity - 0.08) *
      getScaledNoise(
        noise,
        cloudSize + 15 * (noiseX + offset),
        cloudSize + 15 * (noiseY + offset)
      );

    if (cloudLevel > this.sunbeamMaxLevel) {
      cloudLevel += cloudLevelNoise;
    }

    if (cloudLevel > 1) {
      cloudLevel = 1;
    } else if (cloudLevel < 0) {
      cloudLevel = 0;
    }
    return cloudLevel;
  }

  public updateCloudOffset() {
    this.cloudOffset.x += this.windSpeed.x * this.baseWindSpeed;
    this.cloudOffset.y += this.windSpeed.y * this.baseWindSpeed;
  }

  public updateWindSpeed() {
    // each frame, modify windspeed such that it changes direction gradually over time
    const windSpeed = this.windSpeed;
    const windSpeedMax = 0.7;
    const windSpeedMin = -0.7;
    const windSpeedChangeChance = 0.01;
    const windSpeedChangeAmount = 0.05;
    const windSpeedChangeDirection = 0.16;
    const windSpeedChangeDirectionChance = 0.1;

    if (RNG.getUniform() < windSpeedChangeChance) {
      windSpeed.x +=
        RNG.getUniform() < 0.5 ? windSpeedChangeAmount : -windSpeedChangeAmount;
    }
    if (RNG.getUniform() < windSpeedChangeChance) {
      windSpeed.y +=
        RNG.getUniform() < 0.5 ? windSpeedChangeAmount : -windSpeedChangeAmount;
    }
    if (RNG.getUniform() < windSpeedChangeDirectionChance) {
      windSpeed.x +=
        RNG.getUniform() < 0.5
          ? windSpeedChangeDirection
          : -windSpeedChangeDirection;
    }
    if (RNG.getUniform() < windSpeedChangeDirectionChance) {
      windSpeed.y +=
        RNG.getUniform() < 0.5
          ? windSpeedChangeDirection
          : -windSpeedChangeDirection;
    }
    windSpeed.x = Math.min(windSpeedMax, Math.max(windSpeedMin, windSpeed.x));
    windSpeed.y = Math.min(windSpeedMax, Math.max(windSpeedMin, windSpeed.y));
  }

  public calcCloudsFor(x: number, y: number): number {
    return this.generateCloudLevel(
      x,
      y,
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      this.game.noise
    );
  }

  // called each game turn
  public turnUpdate() {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    this.updateWindSpeed();
    this.updateCloudOffset();
    const tileIndexes = this.game.userInterface.camera.viewportTilesUnpadded;
    let posIndex: number;
    let posXY: [number, number];
    for (let i = 0; i < tileIndexes.length; i++) {
      posIndex = tileIndexes[i];
      posXY = indexToXY(posIndex, Layer.TERRAIN);
      this.targetCloudMap[posIndex] = this.calcCloudsFor(posXY[0], posXY[1]);
    }
    this.interpolateStrength();
  }

  public renderUpdate(interPercent: number) {
    this.interpolateCloudState();
  }

  private interpolateStrength() {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    const lightTransitionPercent = this.game.timeManager.lightTransitionPercent;
    const remainingCyclePercent = this.game.timeManager.remainingCyclePercent;
    const phase = this.game.timeManager.lightPhase;

    let remainingLightTransitionPercent;
    let cloudStrength = this.cloudStrength;
    let sunbeamStrength = this.sunbeamStrength;

    if (phase === LightPhase.rising) {
      remainingLightTransitionPercent =
        (1 - remainingCyclePercent) / lightTransitionPercent;
      cloudStrength = lerp(remainingLightTransitionPercent, 1, 0.95);
      sunbeamStrength = lerp(
        remainingLightTransitionPercent,
        this.sunbeamMaxLevel,
        1
      ); // prevent sunbeams from flickering
    } else if (phase === LightPhase.peak) {
      // smoothly fade between 0 and 1 repeatedly, in a wave
      // const wave = Math.sin(remainingCyclePercent * Math.PI);
      // cloudStrength = lerp(wave, 0.95, 1);
      // sunbeamStrength = lerp(wave, 1, this.sunbeamMaxLevel);
    } else if (phase === LightPhase.setting) {
      remainingLightTransitionPercent =
        remainingCyclePercent / lightTransitionPercent;
      cloudStrength = lerp(remainingLightTransitionPercent, 1, 0.95);
      sunbeamStrength = lerp(
        remainingLightTransitionPercent,
        this.sunbeamMaxLevel,
        1
      );
    }
    this.cloudStrength = Math.round(cloudStrength * 1000) / 1000;
    this.sunbeamStrength = Math.round(sunbeamStrength * 1000) / 1000;
  }

  public interpolateCloudState() {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    let val: number;
    let key: string;
    let posIndex: number;
    // only iterate through tiles in the viewport
    const tileIndexes = this.game.userInterface.camera.viewportTilesUnpadded;
    for (let i = 0; i < tileIndexes.length; i++) {
      posIndex = tileIndexes[i];
      val = lerp(
        this.game.timeManager.turnAnimTimePercent,
        this.cloudMap[posIndex],
        this.targetCloudMap[posIndex]
      );
      this.cloudMap[posIndex] = val;
    }
  }

  setCloudLevel(x: number, y: number, cloudLevel: number): void {
    this.cloudMap[positionToIndex(x, y, Layer.TERRAIN)] = cloudLevel;
  }

  getCloudLevel(x: number, y: number): number {
    return this.cloudMap[positionToIndex(x, y, Layer.TERRAIN)];
  }

  onEnter(positions: Point[]): void {
    if (!GameSettings.options.toggles.enableClouds) {
      return;
    }
    let posIndex: number;
    let cloudVal: number;
    positions.forEach((pos) => {
      posIndex = positionToIndex(pos.x, pos.y, Layer.TERRAIN);
      cloudVal = this.calcCloudsFor(pos.x, pos.y);
      this.cloudMap[posIndex] = cloudVal;
      this.targetCloudMap[posIndex] = cloudVal;
    });
  }
}
