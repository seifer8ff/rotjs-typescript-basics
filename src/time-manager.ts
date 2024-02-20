import { Map as RotJsMap } from "rot-js/lib/index";
import { RNG } from "rot-js";
import { FOV } from "rot-js/lib/index";
import { Game } from "./game";
import { Biome, BiomeType, Season, Tile, TileType } from "./tile";
import { Point } from "./point";
import { Actor } from "./entities/actor";
import { Layer } from "./renderer";
import { Autotile } from "./autotile";
import Simplex from "rot-js/lib/noise/simplex";
import Action from "rot-js/lib/scheduler/action";

export class TimeManager {
  private scheduler: Action;
  public timeScale: number;
  public turnDelayInMs: number; // how long to wait between turns
  public isPaused: boolean;

  // time values are in turns
  public maxTimeScale: number;
  public daysPerYear: number;
  public dayLength: number;
  public nightLength: number;
  public transitionTime: number;
  public isDayTime: boolean;
  public isNighttime: boolean;
  public currentYear: number;
  public currentDay: number;
  public currentTime: number;
  public currentTurn: number;

  constructor(private game: Game) {
    this.scheduler = new Action();
    this.isPaused = false;

    this.maxTimeScale = 10;
    this.dayLength = 50;
    this.nightLength = 20;
    this.daysPerYear = 4;

    this.transitionTime = 10;
    this.timeScale = 1;
    this.currentYear = 1;
    this.currentDay = 1;
    this.currentTime = 0;
    this.currentTurn = 0;
    this.isDayTime = true;
    this.isNighttime = !this.isDayTime;
  }

  public addToSchedule(
    actor: Actor,
    repeat: boolean,
    initialTimeDelay?: number
  ): Action {
    return this.scheduler.add(actor, repeat, initialTimeDelay);
  }

  public nextOnSchedule(): Actor {
    this.currentTurn = this.scheduler.getTime();
    this.calculateCurrentTime();
    return this.scheduler.next();
  }

  public calculateCurrentTime(): void {
    this.currentYear =
      Math.floor(this.currentTurn / this.dayLength / this.daysPerYear) + 1;
    this.currentDay =
      (Math.floor(this.currentTurn / this.dayLength) % this.daysPerYear) + 1;
    this.currentTime = this.currentTurn % this.dayLength;
  }

  public getCurrentTimeForDisplay(): string {
    return `Year: ${this.currentYear}  -  Day: ${this.currentDay}  -  Hour: ${this.currentTime}`;
  }

  public setDuration(time: number): Action {
    return this.scheduler.setDuration(time);
  }

  public togglePause(): void {
    this.isPaused = !this.isPaused;
    console.log("isPaused: ", this.isPaused);
  }

  public setTimescale(scale: number): void {
    this.timeScale = scale;
    if (this.timeScale > this.maxTimeScale) {
      this.timeScale = this.maxTimeScale;
    }
    if (this.timeScale <= 0) {
      this.timeScale = 0;
      this.isPaused = true;
    } else {
      this.isPaused = false;
    }
  }
}
