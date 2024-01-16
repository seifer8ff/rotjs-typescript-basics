import { Path } from "rot-js";
import { Game } from "./game";
import { Actor, ActorType } from "./actor";
import { Point } from "./point";
import { Glyph, GlyphColor } from "./glyph";

export class Pedro implements Actor {
    static glyphColor: GlyphColor = {
        foregroundColor: "#f00"
    }
    glyph: Glyph;
    type: ActorType;
    private path: Point[];

    constructor(private game: Game, public position: Point) {
        this.glyph = new Glyph("P", Pedro.glyphColor);
        this.type = ActorType.Pedro;
    }

    act(): Promise<any> {
        let playerPosition = this.game.getPlayerPosition();
        let astar = new Path.AStar(playerPosition.x, playerPosition.y, this.game.mapIsPassable.bind(this.game), { topology: 4 });

        this.path = [];
        astar.compute(this.position.x, this.position.y, this.pathCallback.bind(this));
        this.path.shift(); // remove Pedros position

        if (this.path.length > 0) {
            if (!this.game.occupiedByEnemy(this.path[0].x, this.path[0].y)) {
                this.position = new Point(this.path[0].x, this.path[0].y);
            }
        }

        if (this.position.equals(playerPosition)) {
            this.game.catchPlayer(this);
        }

        return Promise.resolve();
    }

    private pathCallback(x: number, y: number): void {
        this.path.push(new Point(x, y));
    }
}