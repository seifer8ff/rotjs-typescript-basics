import { RNG } from "rot-js/lib/index";
import { Actor } from "./entities/actor";

import { Game } from "./game";
import { Layer } from "./renderer";
import { lerp, lerpEaseIn, lerpEaseInOut, lerpEaseOut } from "./misc-utility";

export interface Animation {
  id: number;
  actor: Actor;
  tileKey: string;
  action: "move";
  turnDuration: number;
}

export interface AnimationOptions {
  lerpStyle: "linear" | "easeIn" | "easeOut" | "easeInOut";
}

export interface MoveAnimation extends Animation {
  oldPos: [number, number];
  newPos: [number, number];
}

export class ManagerAnimation {
  public options = {
    lerpStyle: "easeInOut",
  };

  public animations: Animation[] = [];

  constructor(private game: Game) {}

  public start() {}

  public animUpdate() {
    for (let i = 0; i < this.animations.length; i++) {
      this.game.scheduler.postTask(
        this.runAnimation.bind(this, this.animations[i]),
        { priority: "user-visible" }
      );
    }
  }

  private runAnimation(animation: Animation) {
    if (animation.action === "move") {
      this.animateMove(animation as MoveAnimation);
    }
  }

  public addMoveAnimation(
    actor: Actor,
    tileKey: string,
    oldPos: [number, number],
    newPos: [number, number]
  ) {
    const animation: MoveAnimation = {
      id: RNG.getUniformInt(0, 100000),
      actor: actor,
      tileKey: tileKey,
      oldPos: oldPos,
      newPos: newPos,
      action: "move",
      turnDuration: 1,
    };
    this.animations.push(animation);
  }

  private animateMove(animation: MoveAnimation) {
    const newPos = animation.newPos;
    const oldPos = animation.oldPos;
    if (oldPos && newPos) {
      // let percent = (timeElapsed / timeTotal) * this.game.timeManager.timeScale;
      let percent = this.game.timeManager.turnAnimTimePercent;

      if (percent >= 0.9) {
        // percent = 1;
        this.animations = this.animations.filter((a) => a.id !== animation.id);
      }

      let x, y;
      if (this.options.lerpStyle === "linear") {
        x = lerp(percent, oldPos[0], newPos[0]);
        y = lerp(percent, oldPos[1], newPos[1]);
      } else if (this.options.lerpStyle === "easeIn") {
        x = lerpEaseIn(percent, oldPos[0], newPos[0]);
        y = lerpEaseIn(percent, oldPos[1], newPos[1]);
      } else if (this.options.lerpStyle === "easeOut") {
        x = lerpEaseOut(percent, oldPos[0], newPos[0]);
        y = lerpEaseOut(percent, oldPos[1], newPos[1]);
      } else if (this.options.lerpStyle === "easeInOut") {
        x = lerpEaseInOut(percent, oldPos[0], newPos[0]);
        y = lerpEaseInOut(percent, oldPos[1], newPos[1]);
      }

      this.game.renderer.moveCachedSpriteTransform(
        animation.tileKey,
        Layer.ENTITY,
        x,
        y
      );
    }
  }
}
