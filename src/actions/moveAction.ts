import { Game } from "../game";
import { Point } from "../point";
import { Action } from "./action";
import { Actor } from "../entities/actor";
import { Layer } from "../renderer";
import { MapWorld } from "../map-world";

export class MoveAction implements Action {
  readonly name: string;
  durationInTurns: number; // how long the action lasts

  constructor(
    private game: Game,
    private actor: Actor,
    public targetPos: Point
  ) {
    this.name = "Move To Point";
    this.durationInTurns = 1;
  }

  run(): Promise<any> {
    console.log("---------------------------------- run move action");
    // Animated based on the sprites screen position
    const oldPos = this.game.renderer.getSpriteTransformPosition(
      this.actor.position,
      Layer.ENTITY
    );
    // get the direction of movement
    const movementVector = this.targetPos.movementVector(this.actor.position);
    // only move if there is a change in position
    // const shouldAnimate = movementVector[0] != 0 || movementVector[1] != 0;
    const shouldAnimate = true;
    if (oldPos) {
      // calculate the tile position of the movement vector
      // and get the screen position of that tile
      // use the terrain layer because it's guaranteed to have a tile at that position
      const newPos = this.game.renderer.getSpriteTransformPosition(
        this.actor.position.add(
          new Point(movementVector[0], movementVector[1])
        ),
        Layer.TERRAIN
      );
      if (shouldAnimate) {
        // add the animation to the managers queue
        this.game.animManager.addMoveAnimation(
          this.actor,
          MapWorld.coordsToKey(this.targetPos.x, this.targetPos.y),
          oldPos,
          newPos
        );
      }

      // update the position of the sprite in the renderer's cache
      // keeps the renderer's representation of the map in sync with the game
      // otherwise, renderer will think sprite is still at old position
      this.game.renderer.updateSpriteCachePosition(
        this.actor.position,
        this.targetPos,
        Layer.ENTITY
      );
    }
    this.actor.position = new Point(this.targetPos.x, this.targetPos.y);

    return Promise.resolve();
  }
}
