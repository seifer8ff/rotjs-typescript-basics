import { Game } from "../game";
import { AnimatedSprite, Assets, Texture } from "pixi.js";
import { Actor } from "../entities/actor";

export class Animator {
  public animSpeed: number = 1;
  private currentAnimation: string;
  private animationFrames: { [key: string]: string[] }; // frames by key name

  constructor(private game: Game, private actor: Actor) {
    if (this.actor.tile.animationKeys) {
      const frames: { [key: string]: any } = Assets.cache.get(
        this.actor.tile.spritePath
      ).data.frames;

      this.animationFrames = {};

      for (let animationKey of this.actor.tile.animationKeys) {
        this.animationFrames[animationKey] = [];
        for (let key in frames) {
          if (key.includes(animationKey)) {
            this.animationFrames[animationKey].push(key);
          }
        }
        this.animationFrames[animationKey].sort();
      }
      this.setAnimation(this.actor.tile.animationKeys[0]);
    }
  }

  public setAnimation(animation: string): void {
    if (this.currentAnimation === animation) return;

    this.currentAnimation = animation;
    if (this.actor.sprite) {
      const animatedSprite = this.actor.sprite as AnimatedSprite;
      animatedSprite.textures = this.animationFrames[this.currentAnimation].map(
        (frame) => Texture.from(frame)
      );
      animatedSprite.animationSpeed =
        this.animSpeed *
        this.game.options.animationSpeed *
        this.game.timeManager.timeScale;
      animatedSprite.loop = true;
      animatedSprite.play();
    } else {
      this.actor.sprite = AnimatedSprite.fromFrames(
        this.animationFrames[this.currentAnimation]
      );
      (this.actor.sprite as AnimatedSprite).animationSpeed =
        this.animSpeed *
        this.game.options.animationSpeed *
        this.game.timeManager.timeScale;
      (this.actor.sprite as AnimatedSprite).loop = true;
      (this.actor.sprite as AnimatedSprite).play();
    }
  }
}
