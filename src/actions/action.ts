import { Point } from "../point";

export interface Action {
  readonly id: number; // unique identifier for the action
  readonly name: string;
  readonly description?: string;
  targetPos: Point; // where the action takes place
  durationInTurns: number; // how long the action lasts

  run(): Promise<any>; // side effects of the action
}
