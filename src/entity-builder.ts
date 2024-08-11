import { generateId } from "./misc-utility";
import { ComponentType, EntityBase } from "./entities/entity";
import { World } from "miniplex";
import { Point } from "./point";

export class EntityBuilder {
  private entity: EntityBase;

  constructor(private world: World<EntityBase>, entity?: EntityBase) {
    if (entity) {
      this.entity = entity;
    } else {
      this.entity = world.add({ id: generateId() });
    }
  }

  public addPosition(x: number = 0, y: number = 0): this {
    this.world.addComponent(
      this.entity,
      ComponentType.position,
      new Point(x, y)
    );
    return this;
  }

  public addName(name: string = "Unnamed Entity"): this {
    this.world.addComponent(this.entity, ComponentType.name, name);
    return this;
  }

  public build(): EntityBase {
    return this.entity;
  }
}
