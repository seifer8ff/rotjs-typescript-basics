import { Scheduler, KEYS, RNG } from "rot-js/lib/index";
import Simple from "rot-js/lib/scheduler/simple";

import { Player } from "./player";
import { Point } from "./point";
import { Actor, ActorType } from "./actor";
import { Pedro } from "./pedro";
import { GameState } from "./game-state";
import { InputUtility } from "./input-utility";
import { Tile, TileType } from "./tile";
import { MapDungeon } from "./map-dungeon";
import { MapWorld } from "./map-world";
import { UserInterface } from "./user-interface";
import { TinyPedro } from "./tiny-pedro";


export class Game {
    public userInterface: UserInterface;
    public maximumBoxes = 10;
    public gameSize: { width: number, height: number };
    public mapSize: { width: number, height: number };
    public map: MapWorld;
    public player: Player;
    public enemies: Actor[];
    public gameState: GameState;

    private scheduler: Simple;
    private pineapplePoint: Point;
    

    constructor() {
        // sensible default
        let width = 40
        let height = 40;
        let fontSize = 20;

        // Maximize to document size, using magic numbers for 1920x1080 screen size
        // width = (170 / 1920) * document.body.offsetWidth;
        // height = (52 / 1080) * document.defaultView.innerHeight;

        // how/why should this change?
        fontSize = 20;

        this.gameSize = { width: width, height: height };
        this.mapSize = { width: this.gameSize.width, height: this.gameSize.height };

        this.userInterface = new UserInterface(this);
        this.gameState = new GameState();
        this.map = new MapWorld(this);

        this.initializeGame();
        this.mainLoop();
    }

    mapIsPassable(x: number, y: number): boolean {
        return this.map.isPassable(x, y);
    }

    occupiedByEnemy(x: number, y: number): boolean {
        for (let enemy of this.enemies) {
            if (enemy.position.x == x && enemy.position.y == y) {
                return true;
            }
        }
        return false;
    }

    getPlayerPosition(): Point {
        return this.player.position;
    }

    checkBox(x: number, y: number): void {
        switch (this.map.getTileType(x, y)) {
            case Tile.box.type:
                this.map.setTile(x, y, Tile.searchedBox);
                this.userInterface.statusLine.boxes += 1;
                if (this.pineapplePoint.x == x && this.pineapplePoint.y == y) {
                    this.userInterface.messageLog.appendText("Continue with 'spacebar' or 'return'.");
                    this.userInterface.messageLog.appendText("Hooray! You found a pineapple.");
                    this.gameState.foundPineapple = true;
                } else {
                    this.userInterface.messageLog.appendText("This box is empty.");
                }
                break;
            case Tile.searchedBox.type:
                this.map.setTile(x, y, Tile.destroyedBox);
                this.userInterface.messageLog.appendText("You destroy this box!");
                break;
            case Tile.destroyedBox.type:
                this.userInterface.messageLog.appendText("This box is already destroyed.");
                break;
            default:
                this.userInterface.messageLog.appendText("There is no box here!");
                break;
        }
    }

    destroyBox(actor: Actor, x: number, y: number): void {
        switch (this.map.getTileType(x, y)) {
            case TileType.Box:
            case TileType.SearchedBox:
                this.map.setTile(x, y, Tile.destroyedBox);
                if (this.pineapplePoint.x == x && this.pineapplePoint.y == y) {
                    this.userInterface.messageLog.appendText("Continue with 'spacebar' or 'return'.");
                    this.userInterface.messageLog.appendText(`Game over - ${this.getActorName(actor)} detroyed the box with the pineapple.`);
                    this.gameState.pineappleWasDestroyed = true;
                } else {
                    this.userInterface.messageLog.appendText(`${this.getActorName(actor)} detroyed a box.`);
                }
                break;
            case TileType.DestroyedBox:
                this.userInterface.messageLog.appendText("This box is already destroyed.");
                break;
            default:
                this.userInterface.messageLog.appendText("There is no box here!");
                break;
        }
    }

    catchPlayer(actor: Actor): void {
        this.userInterface.messageLog.appendText("Continue with 'spacebar' or 'return'.");
        this.userInterface.messageLog.appendText(`Game over - you were captured by ${this.getActorName(actor)}!`);
        this.gameState.playerWasCaught = true;
    }

    getTileType(x: number, y: number): TileType {
        return this.map.getTileType(x, y);
    }

    getRandomTilePositions(type: TileType, quantity: number = 1): Point[] {
        return this.map.getRandomTilePositions(type, quantity);
    }

    private initializeGame(): void {
        console.log("init game");
        this.userInterface.initialize();
        this.gameState.reset();
        

        this.map.generateMap(this.mapSize.width, this.mapSize.height);
        this.generateBoxes();

        this.createBeings();
        this.scheduler = new Scheduler.Simple();
        this.scheduler.add(this.player, true);
        for (let enemy of this.enemies) {
            this.scheduler.add(enemy, true);
        }

        this.userInterface.refreshPanel();
    }

    private async mainLoop(): Promise<any> {
        let actor: Actor;
        while (true) {
            actor = this.scheduler.next();
            if (!actor) {
                break;
            }

            await actor.act();
            if (actor.type === ActorType.Player) {
                this.userInterface.statusLine.turns += 1;
            }
            if (this.gameState.foundPineapple) {
                this.userInterface.statusLine.pineapples += 1;
            }

            // this.drawUserInterface();
            this.userInterface.refreshPanel();

            this.map.UpdateFOV(this.player);

            if (this.gameState.isGameOver()) {
                await InputUtility.waitForInput(this.userInterface.HandleInputConfirm.bind(this));
                this.initializeGame();
            }
        }
    }

    private getActorName(actor: Actor): string {
        switch (actor.type) {
            case ActorType.Player:
                return `Player`;
            case ActorType.Pedro:
                return `%c{${actor.glyph.glyphColor.foregroundColor}}Pedro%c{}`;
            case ActorType.TinyPedro:
                return `%c{${actor.glyph.glyphColor.foregroundColor}}Pedros son%c{}`;
            default:
                return "unknown actor";
        }
    }

    private generateBoxes(): void {
        let positions = this.map.getRandomTilePositions(TileType.Floor, this.maximumBoxes);
        for (let position of positions) {
            this.map.setTile(position.x, position.y, Tile.box);
        }
        this.pineapplePoint = positions[0];
    }

    private createBeings(): void {
        let numberOfEnemies = 1 + Math.floor(this.userInterface.statusLine.pineapples / 3.0);
        this.enemies = [];
        let positions = this.map.getRandomTilePositions(TileType.Floor, 1 + numberOfEnemies);
        this.player = new Player(this, positions.splice(0, 1)[0]);
        for (let position of positions) {
            if (this.userInterface.statusLine.pineapples < 1 || RNG.getUniform() < 0.5) {
                this.enemies.push(new Pedro(this, position));
            } else {
                this.enemies.push(new TinyPedro(this, position));
            }
        }
    }

}