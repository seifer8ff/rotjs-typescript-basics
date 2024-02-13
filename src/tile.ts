export const enum TileType {
  Player,
  Person,
  Animal,
  Floor,
  Water,
  Shrub,
  CutTree,
  TreeStump,
}

export class Tile {
  static readonly size = 16;
  static readonly player = new Tile(TileType.Player, "player_01", "#D2D2D2");
  static readonly person = new Tile(TileType.Player, "player_01", "#E7E6AC");
  static readonly animal = new Tile(
    TileType.Animal,
    "entity-mushroom",
    "#C1BF69"
  );
  static readonly floor = new Tile(
    TileType.Floor,
    "grassland_spring_578",
    "#C19A6B"
  );
  static readonly water = new Tile(
    TileType.Water,
    "grassland_spring_577",
    "#95C9F6"
  );
  static readonly shrub = new Tile(
    TileType.Shrub,
    "grassland_spring_075",
    "#95C577"
  );
  static readonly cutTree = new Tile(
    TileType.CutTree,
    "TODO cut tree",
    "#FF4AE7"
  );
  static readonly treeStump = new Tile(
    TileType.TreeStump,
    "TODO tree stump",
    "#FF4AE7"
  );

  constructor(
    public readonly type: TileType,
    public readonly sprite: string,
    public readonly color: string
  ) {}
}
