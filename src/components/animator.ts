import { Game } from "../game";
import { AnimatedSprite, Assets, Texture } from "pixi.js";
import { Actor } from "../entities/actor";
import { GameSettings } from "../game-settings";

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
    let animatedSprite: AnimatedSprite = this.actor.sprite as AnimatedSprite;
    if (this.actor.sprite) {
      animatedSprite.textures = this.animationFrames[this.currentAnimation].map(
        (frame) => Texture.from(frame)
      );
    } else {
      this.actor.sprite = AnimatedSprite.fromFrames(
        this.animationFrames[this.currentAnimation]
      );
      animatedSprite = this.actor.sprite as AnimatedSprite;
    }
    if (GameSettings.options.toggles.enableAnimations) {
      animatedSprite.animationSpeed =
        this.animSpeed *
        GameSettings.options.animationSpeed *
        this.game.timeManager.timeScale;
      animatedSprite.loop = true;
      animatedSprite.play();
    }
  }
}
