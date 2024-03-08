import { Game } from "./game";
import { Actor } from "./entities/actor";
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
  // public transitionTime: number;
  public isDayTime: boolean;
  public isNighttime: boolean;
  public currentYear: number;
  public currentDay: number;
  public currentTime: number;
  public currentTurn: number;
  public remainingCyclePercent: number; // how much time left before day/night cycles. expressed as decimal

  constructor(private game: Game) {
    this.scheduler = new Action();
    this.isPaused = false;

    this.maxTimeScale = 10;
    this.dayLength = 15;
    this.nightLength = 15;
    this.daysPerYear = 10;

    // this.transitionTime = 10;
    this.timeScale = 1;
    this.currentYear = 1;
    this.currentDay = 1;
    this.currentTime = 0;
    this.currentTurn = 0;
    this.isDayTime = true;
    this.isNighttime = !this.isDayTime;
    this.calculateCurrentTime();
  }

  public addToSchedule(
    actor: Actor,
    repeat: boolean,
    initialTimeDelay?: number
  ): Action {
    return this.scheduler.add(actor, repeat, initialTimeDelay);
  }

  public nextOnSchedule(): Actor {
    this.calculateCurrentTime();
    return this.scheduler.next();
  }

  public calculateCurrentTime(): void {
    this.currentTurn = this.scheduler.getTime();
    const totalDayLength = this.dayLength + this.nightLength;
    this.currentYear =
      Math.floor(this.currentTurn / totalDayLength / this.daysPerYear) + 1;
    this.currentDay =
      (Math.floor(this.currentTurn / totalDayLength) % this.daysPerYear) + 1;
    this.currentTime = this.currentTurn % totalDayLength;
    this.isNighttime = this.currentTime >= this.dayLength;
    this.isDayTime = !this.isNighttime;

    // how much time is left before the next transition
    // at start: 1, mid: 0.5, end: 0
    this.remainingCyclePercent = this.isDayTime
      ? 1 - this.currentTime / this.dayLength
      : (this.currentTime - this.dayLength) / this.nightLength;
  }

  public getCurrentTimeForDisplay(): string {
    return `Year: ${this.currentYear}  -  ${
      this.isDayTime ? "Day" : "Night"
    }: ${this.currentDay}  -  Hour: ${this.currentTime}`;
  }

  public setDuration(time: number): Action {
    return this.scheduler.setDuration(time);
  }

  public togglePause(): void {
    this.setIsPaused(!this.isPaused);
  }

  public setIsPaused(isPaused: boolean): void {
    this.isPaused = isPaused;
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
