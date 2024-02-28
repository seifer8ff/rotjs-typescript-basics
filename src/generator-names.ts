import { KEYS, DIRS, Path, RNG, StringGenerator } from "rot-js";
import { Game } from "./game";
import { Actor } from "./entities/actor";
import { Point } from "./point";
import { InputUtility } from "./input-utility";
import { Tile, TileType } from "./tile";
import { WaitAction } from "./actions/waitAction";
import { Action } from "./actions/action";

export class GeneratorNames {
  private nameGenerator: StringGenerator;
  public generate = () => this.nameGenerator.generate();

  constructor(private game: Game) {
    this.nameGenerator = new StringGenerator({ words: true });
    const exampleNames = [
      "Brady",
      "Mario",
      "Luigi",
      "Jen",
      "Cassie",
      "Tyler",
      "Dave",
      "Judy",
      "Jude",
      "Juan",
      "Jermaine",
      "Kylie",
      "Adam",
      "Patrick",
      "Matt",
      "Celeste",
      "Arthur",
      "Jimmy",
      "Jill",
      "Jainie",
      "Brodie",
      "Guadaloupe",
      "Jasmine",
      "Jasper",
      "Jared",
      "Jesse",
      "Jenny",
      "Jill",
      "Jillian",
      "Amy",
      "Bill",
      "Zane",
      "Zack",
      "Zach",
      "Zachary",
      "Zara",
      "Zelda",
      "Zoe",
      "Homer",
    ];
    exampleNames.forEach((name) => this.nameGenerator.observe(name));
  }
}
