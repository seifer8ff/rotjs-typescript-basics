import { Display, KEYS } from "rot-js/lib/index";
import { Point } from "./point";
import { Glyph } from "./glyph";
import { Game } from "./game";
import { StatusLine } from "./status-line";
import { MessageLog } from "./message-log";
import { InputUtility } from "./input-utility";
import * as PIXI from 'pixi.js';

// import * as testTileset from './images/colored_tilemap_packed.png';
// import * as tileSet from './images/oryx_16bit_fantasy_world.png';
import * as tileSet from './images/tilemap-desert.png';
import { DisplayOptions } from "rot-js/lib/display/types";
import { Tile, TileMap } from "./tile";
import { Pedro } from "./pedro";

export class UserInterface {
    public gameDisplay: Display;
    public textDisplay: Display;
    public statusLine: StatusLine;
    public messageLog: MessageLog;

    private gameCanvasContainer: HTMLElement;
    private textCanvasContainer: HTMLElement;
    private gameCanvas: HTMLCanvasElement;
    private textCanvas: HTMLCanvasElement;
    private gameDisplayOptions: Partial<DisplayOptions>;

    private statusLinePosition: Point;
    private actionLogPosition: Point;

    private foregroundColor = "transparent";
    // private backgroundColor = "purple";
    private backgroundColor = "transparent";
    private maximumBoxes = 10;

    private scale = 4;
    private fontSize = 20;

    constructor(private game: Game)  {
        const tileSetElement: HTMLImageElement = document.createElement("img");
        tileSetElement.src = tileSet as unknown as string;

        const scaleMobile = 4; // scale mobile screens by this much
        const scaleMonitor = 6; // scale computer screens by this much

        this.scale = (window.innerWidth < 600 ? scaleMobile : scaleMonitor);

        this.statusLinePosition = new Point(0, 0);
        this.actionLogPosition = new Point(0, 3);

        this.gameDisplayOptions = {
            layout: "tile-gl",
            bg: "transparent",
            tileWidth: 16,
            tileHeight: 16,
            tileSet: tileSetElement,
            tileMap: TileMap,
            tileColorize: true,
            width: this.game.gameSize.width,
            height: this.game.gameSize.height,
          };

        this.gameDisplay = new Display(this.gameDisplayOptions);

          this.textDisplay = new Display({
            width: this.game.gameSize.width * 2,
            height: 10,
            fontSize: this.fontSize
        });

        this.gameCanvasContainer = document.getElementById("canvasContainer");
        this.textCanvasContainer = document.getElementById("textContainer");

        this.gameCanvasContainer.appendChild(this.gameDisplay.getContainer());
        this.gameCanvas = this.gameDisplay.getContainer().querySelector("canvas");
        this.textCanvasContainer.appendChild(this.textDisplay.getContainer());
        this.textCanvas = this.textDisplay.getContainer().querySelector("canvas");

        this.statusLine = new StatusLine(this, this.statusLinePosition, this.game.gameSize.width * 3, { maxBoxes: this.maximumBoxes });
        this.messageLog = new MessageLog(this, this.actionLogPosition, this.game.gameSize.width * 3, 6);

        this.gameCanvasContainer.addEventListener("wheel", this.zoom.bind(this), { passive: false });
    }

    public initialize() {
        this.gameDisplay.clear();
        this.textDisplay.clear();
        this.messageLog.clear();

        if (!this.game.gameState.isGameOver() || this.game.gameState.doRestartGame()) {
            this.resetStatusLine();
            this.writeHelpMessage();
        } else {
            this.statusLine.boxes = 0;
        }
        
    }

    private writeHelpMessage(): void {
        let helpMessage = [
            `Find the pineapple in one of the boxes.`,
            `Move with numpad, search box with 'spacebar' or 'return'.`,
            `Watch out for %c{${Pedro.glyphColor.foregroundColor}}Pedro%c{}!`
        ];

        for (let index = helpMessage.length - 1; index >= 0; --index) {
            this.messageLog.appendText(helpMessage[index]);
        }
    }

    draw(position: Point, glyphs: Glyph[], fgColors?: string[], bgColors?: string[] ): void {
        this.gameDisplay.draw(position.x, position.y,
            glyphs.map(g => g.character),
            (fgColors || glyphs.map(g => this.foregroundColor)) as any as string,
            (bgColors || glyphs.map(g => this.backgroundColor)) as any as string);
    }

    drawText(position: Point, text: string, maxWidth?: number): void {
        this.textDisplay.drawText(position.x, position.y, text, maxWidth);
    }

    HandleInputConfirm(event: KeyboardEvent): boolean {
        let code = event.keyCode;
        return code === KEYS.VK_SPACE || code === KEYS.VK_RETURN;
    }

    refreshPanel(): void {
        this.gameDisplay.clear();
        this.textDisplay.clear();
        this.game.map.draw();
        this.statusLine.draw();
        this.messageLog.draw();
        let pos = this.game.getPlayerPosition();
        let bgTile = this.game.map.getTile(pos.x, pos.y);
        this.draw(pos, [bgTile.glyph, this.game.player.glyph]);
        this.rescale(pos.x, pos.y);
        for (let enemy of this.game.enemies) {
            pos = enemy.position;
            bgTile = this.game.map.getTile(pos.x, pos.y);
            this.draw(enemy.position, [bgTile.glyph, enemy.glyph]);
        }

        ////////////////////////////////////////////////////////////
        //
        // change this function to draw layer by layer
        // draw terrain
        // draw structures
        // draw objs
        // draw actors
        //
        ///////////////////////////////////////////////////////////
    }

     resetStatusLine(): void {
        this.statusLine.reset();
        this.statusLine.maxBoxes = this.game.maximumBoxes;
    }

    rescale(x: number, y: number) {
        // const offset = (game.touchScreen ? touchOffsetY : 0);
        // const offset = 0;
        // const tw = ((x * -this.gameDisplay.getOptions().tileWidth) +
        //             (this.gameDisplayOptions.width * this.gameDisplayOptions.tileWidth / 2) + -4);
        // const th = ((y * -this.gameDisplayOptions.tileHeight) +
        //             (this.gameDisplayOptions.height * this.gameDisplayOptions.tileHeight / 2) + offset);
        // if (this.gameCanvasContainer) {
        //   // this applies the animation effect
        //   this.gameCanvasContainer.style.transition = "transform 0.5s ease-out 0s";
        //   if (this.gameCanvas) {
        //     this.gameCanvas.getContext('2d').imageSmoothingEnabled = false;
        //   }
        //   // this sets the scale and position to focus on the player
        //   this.gameCanvasContainer.style.transform =
        //     "scale(" + this.scale + ") " + "translate3d(" + Math.floor(tw) +
        //     "px," + Math.floor(th) + "px,0px)";
        // }
      }

      private zoom(event: WheelEvent) {
        event.preventDefault();

        // this.scale += event.deltaY * -0.01;

        // // Restrict scale
        // this.scale = Math.min(Math.max(1, this.scale), 20);

        // // Apply scale transform
        // this.rescale(this.game.getPlayerPosition().x, this.game.getPlayerPosition().y);
      }
}