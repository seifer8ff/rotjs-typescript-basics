import { Path, RNG } from "rot-js";
import { Game } from "../game";
import { Actor, DescriptionBlock } from "./actor";
import { Point } from "../point";
import { Tile, TileSubType, TileType } from "../tile";
import { WaitAction } from "../actions/waitAction";
import { Action } from "../actions/action";
import { MoveAction } from "../actions/moveAction";
import TypeIcon from "../shoelace/assets/icons/person-vcard.svg";
import GoalIcon from "../shoelace/assets/icons/geo-alt.svg";
import ActionIcon from "../shoelace/assets/icons/sign-turn-slight-right.svg";
import { HarvestAction } from "../actions/harvestAction";
import { WanderAction } from "../actions/wanderAction";
import PinIcon from "../shoelace/assets/icons/pin-map.svg";
import { Layer, Renderable } from "../renderer";
import { Sprite, AnimatedSprite, Graphics, Assets } from "pixi.js";
import { PointerTarget } from "../camera";
import { generateId } from "../misc-utility";
import { GameSettings } from "../game-settings";

export class Person implements Actor {
  id: number;
  name?: string;
  tile: Tile;
  type: TileType;
  subType: TileSubType;
  goal: Action;
  action: Action;
  sprite: Renderable;
  private path: Point[];
  private range: number;

  constructor(private game: Game, public position: Point) {
    this.id = generateId();
    this.subType = TileSubType.Human;
    this.name = this.game.nameGenerator.generate(this.subType);
    this.tile = Tile.person;
    this.type = this.tile.type;
    this.path = [];
    this.range = 8;

    if (this.tile.animationKeys) {
      const animations = Assets.cache.get(this.tile.spritePath).data.frames;
      const animKeys = Object.keys(animations).sort();
      this.sprite = AnimatedSprite.fromFrames(animKeys);
      (this.sprite as AnimatedSprite).animationSpeed =
        GameSettings.options.animationSpeed * this.game.timeManager.timeScale;
      (this.sprite as AnimatedSprite).loop = true;
      (this.sprite as AnimatedSprite).play();
    } else {
      this.sprite = Sprite.from(this.tile.spritePath);
    }
  }

  draw(): void {
    this.game.renderer.addToScene(this.position, Layer.ENTITY, this.sprite);
  }

  private planGoal(): Action {
    const plantTarget = this.game.actorManager.getRandomActorPositions(
      TileSubType.Tree,
      1
    )[0];
    if (plantTarget) {
      // check if reachable
      return new HarvestAction(this.game, this, plantTarget);
    }
    return new WaitAction(this.game, this, this.position);
  }

  private planWanderGoal(): Action {
    let attempts = 5;
    while (attempts > 0) {
      const wanderPoint = this.getRandomPointWithinRange(this.range);
      const wanderGoal = new WanderAction(this.game, this, wanderPoint);
      if (this.isGoalReachable(wanderGoal)) {
        return new WanderAction(this.game, this, wanderPoint);
      }
      attempts--;
    }
    return null;
  }

  private getRandomPointWithinRange(range: number): Point {
    const posX = RNG.getUniformInt(
      this.position.x - range,
      this.position.x + range
    );
    const posY = RNG.getUniformInt(
      this.position.y - range,
      this.position.y + range
    );
    return new Point(posX, posY);
  }

  private isGoalReachable(goal: Action): boolean {
    const isSelfBlocked = this.game.isOccupiedBySelf(
      goal.targetPos.x,
      goal.targetPos.y,
      this
    );
    return (
      isSelfBlocked || !this.game.isBlocked(goal.targetPos.x, goal.targetPos.y)
    );
  }

  public plan(): void {
    let hasGoal = this.goal != null;
    const atGoalPosition = this.goal
      ? this.position?.equals(this.goal?.targetPos)
      : false;
    let hasPath = this.path?.length > 0;
    const isOccupied = hasPath
      ? this.game.isOccupiedByActor(this.path[0].x, this.path[0].y)
      : false;

    if (!hasGoal) {
      // find new goal
      this.goal = this.planGoal();
      hasGoal = this.goal != null;
    }

    if (hasGoal) {
      if (atGoalPosition) {
        // run the action if at the goal position
        this.action = this.goal;
        return;
      }

      if (!this.action) {
        // !!!!! MUST check if target is reachable before this point
        if (hasGoal && !hasPath) {
          // calculate new path if no path exists
          this.pathTo(this.goal.targetPos);
          if (this.path.length === 0) {
            // no path found
            this.goal = this.planWanderGoal();
            hasGoal = this.goal != null;
            this.pathTo(this.goal?.targetPos);
          }
          hasPath = this.path?.length > 0;
        }
        if (hasGoal && hasPath) {
          // console.log("has goal, has path, set action moveAction");
          this.action = new MoveAction(
            this.game,
            this,
            this.path.shift() // make sure to remove the point
          );
          return;
        }
      }
    }
  }

  private canPathTo(x: number, y: number): boolean {
    const distanceFromTarget = this.position.manhattanDistance(new Point(x, y));
    const inRange = distanceFromTarget <= this.range;
    return (
      inRange &&
      (!this.game.isBlocked(x, y) || this.game.isOccupiedBySelf(x, y, this))
    );
  }

  private pathTo(target: Point) {
    if (!target) {
      return;
    }
    let astar = new Path.AStar(target.x, target.y, this.canPathTo.bind(this), {
      topology: 4,
    });

    this.path = [];
    astar.compute(
      this.position.x,
      this.position.y,
      this.pathCallback.bind(this)
    );
    this.path.shift(); // remove actor's position
  }

  act(): Promise<any> {
    return this.action.run().then((res) => {
      if (this.goal === this.action) {
        this.goal = null;
      }
      this.action = null;
      return res;
    });
  }

  public getDescription(): DescriptionBlock[] {
    const descriptionBlocks: DescriptionBlock[] = [];
    descriptionBlocks.push({
      icon: PinIcon,
      getDescription: () => `${this.position.x}, ${this.position.y}`,
    });
    descriptionBlocks.push({
      icon: TypeIcon,
      getDescription: (pointerTarget: PointerTarget) => this.subType,
    });
    if (this.goal) {
      descriptionBlocks.push({
        icon: GoalIcon,
        getDescription: (pointerTarget: PointerTarget) => this.goal.name,
      });
    }
    if (this.action) {
      descriptionBlocks.push({
        icon: ActionIcon,
        getDescription: (pointerTarget: PointerTarget) => this.action.name,
      });
    }
    return descriptionBlocks;
  }

  private pathCallback(x: number, y: number): void {
    this.path.push(new Point(x, y));
  }
}
