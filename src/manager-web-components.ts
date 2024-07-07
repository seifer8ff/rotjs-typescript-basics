import { Game } from "./game";
import { TimeControl } from "./web-components/time-control";
import {
  GameSettingsToggleOption,
  TitleMenu,
} from "./web-components/title-menu";
import { MenuItem, SideMenu, TopLevelMenu } from "./web-components/side-menu";
import { SideMenuContent } from "./web-components/side-menu-content";
import { TileInfo } from "./web-components/tile-info";
import { SkyMask } from "./web-components/sky-mask";
import { Overlay } from "./web-components/overlay";
import { UtilityActions } from "./web-components/utility-actions";
import { IndicatorSun } from "./web-components/indicator-sun";
import { IndicatorTileSelection } from "./web-components/indicator-tile-selection";
import { Actor, isActor } from "./entities/actor";
import { UserInterface } from "./user-interface";
import { getCachedTileTexture } from "./assets";
import OverlayIcon from "./shoelace/assets/icons/layers-half.svg";
import { Sprite } from "pixi.js";
import { BaseTileKey, Tile } from "./tile";
import { BiomeId, Biomes } from "./biomes";
import { Stages } from "./game-state";
import { GameSettings } from "./game-settings";
import { serialize } from "@shoelace-style/shoelace";

export class ManagerWebComponents {
  private timeControl: TimeControl;
  public titleMenu: TitleMenu;
  public sideMenu: SideMenu;
  public tileInfo: TileInfo;
  public skyMask: SkyMask;
  public overlay: Overlay;
  public tileSelectionIndicator: IndicatorTileSelection;
  public utilityActions: UtilityActions;

  constructor(private game: Game, private ui: UserInterface) {
    this.initWebComponents();
    this.initControls();
  }

  public refreshComponents() {
    // for components that display data that changes dynamically, like light or temps
    if (this.overlay && this.overlay.isVisible) {
      this.overlay.refresh(this.game.map);
    }
    if (this.game.gameState.stage === Stages.Play) {
      if (this.ui.camera.pointerTarget) {
        // refresh the target info data obj
        this.game.userInterface.camera.refreshPointerTargetInfo();
        // refresh the tile info UI with the new data
        this.tileInfo.refreshContent(
          this.game.userInterface.camera.pointerTarget
        );
      }
    }
  }

  private initWebComponents() {
    customElements.define("title-menu", TitleMenu);
    customElements.define("time-control", TimeControl);
    customElements.define("side-menu-content", SideMenuContent);
    customElements.define("side-menu", SideMenu);
    customElements.define("tile-info", TileInfo);
    customElements.define("sky-mask", SkyMask);
    customElements.define("screen-overlay", Overlay);
    customElements.define("utility-actions", UtilityActions);
    customElements.define("indicator-sun", IndicatorSun);
    customElements.define("indicator-tile-selection", IndicatorTileSelection);
  }

  private initControls() {
    this.titleMenu = document.querySelector("title-menu");
    if (this.titleMenu) {
      this.titleMenu.handle.addEventListener("click", () => {
        this.titleMenu.setCollapsed(!this.titleMenu.isCollapsed);
      });

      let optionToggles: GameSettingsToggleOption[] = [];
      for (let toggle in GameSettings.options.toggles) {
        optionToggles.push({
          key: toggle,
          label: toggle,
          defaultValue: GameSettings.options.toggles[toggle],
        });
      }
      this.titleMenu.generateGameOptions(optionToggles);
      this.titleMenu.worldSizeInput.addEventListener(
        "sl-change",
        (e: CustomEvent) => {
          let updatedSize;
          try {
            updatedSize = JSON.parse(
              this.titleMenu.worldSizeInput.value as string
            );
            GameSettings.options.gameSize = updatedSize;
          } catch (error) {
            console.log("Error: parsing world size. Invalid input?", e, error);
          }
        }
      );
      this.titleMenu.form.addEventListener("submit", (e: CustomEvent) => {
        e.preventDefault();
        this.titleMenu.setVisible(false, true);
        setTimeout(() => {
          try {
            const serializedData: Record<string, string> = serialize(
              this.titleMenu.form
            ) as any;
            for (let toggle in GameSettings.options.toggles) {
              GameSettings.options.toggles[toggle] =
                serializedData[toggle] === "true";
            }
            this.game.settings.loadSettings();
            this.game.gameState.changeStage(Stages.Play);
            this.game.generateWorld();
          } catch (error) {
            console.log("error on form submit", e, error);
          }
        }, 100);
        return false;
      });
    }
    this.timeControl = document.querySelector("time-control");
    if (this.timeControl) {
      // this.timeControl.toggleTooltip();
      this.timeControl.updateTime(
        this.game.timeManager.getCurrentTimeForDisplay()
      );
      this.timeControl.pauseBtn.addEventListener("click", () => {
        this.game.timeManager.togglePause();
      });
      this.timeControl.timeSlider.addEventListener("sl-input", (e: any) => {
        this.game.timeManager.setTimescale(e.target.value);
        console.log("time scale: ", this.game.timeManager.timeScale);
      });
    }

    this.sideMenu = document.querySelector("side-menu");
    if (this.sideMenu) {
      this.sideMenu.dropdownMenu.addEventListener(
        "sl-select",
        (e: CustomEvent) => {
          console.log(e.detail);
          this.sideMenu.setSelectedTab(this.sideMenu.getTab(e.detail.item.id));
        }
      );

      this.sideMenu.handle.addEventListener("click", () => {
        this.sideMenu.setCollapsed(!this.sideMenu.isCollapsed);
      });
    }
    this.tileInfo = document.querySelector("tile-info");
    this.tileInfo.game = this.game;
    this.skyMask = document.querySelector("sky-mask");
    this.overlay = document.querySelector("screen-overlay");
    if (this.overlay) {
      this.overlay.closeBtn.addEventListener("click", () => {
        this.overlay.setVisible(false);
        this.setUIVisible(true, true);
      });
      this.registerOverlays();
    }
    this.tileSelectionIndicator = document.querySelector(
      "indicator-tile-selection"
    );
    if (this.tileSelectionIndicator) {
      this.tileSelectionIndicator.init(this.game);
      this.tileSelectionIndicator.closeBtn.addEventListener("click", () => {
        this.tileSelectionIndicator.setVisible(false);
        this.setUIVisible(true, true);
      });
    }
    if (this.timeControl) {
      this.utilityActions = this.timeControl.utilityActions;
      this.setUtilityActionsOptions();
    }
  }

  public updateTimeControl(): void {
    if (this.timeControl) {
      this.timeControl.updateTime(
        this.game.timeManager.getCurrentTimeForDisplay()
      );
      this.timeControl.updatePauseBtn(this.game.timeManager.isPaused);
    }
  }

  public renderUpdate() {
    if (this.game.gameState.isLoading()) {
      if (this.game.gameState.stage === Stages.Title) {
        this.titleMenu.setCollapsed(false);
        this.sideMenu.setVisible(false, true);
        this.timeControl.setVisible(false);
      } else if (this.game.gameState.stage === Stages.Play) {
        this.titleMenu.setCollapsed(true);
        this.sideMenu.setVisible(true, true);
        this.timeControl.setVisible(true);
      }
      this.game.gameState.loading = false;
    }
    if (this.game.gameState.stage === Stages.Title) {
      if (this.tileSelectionIndicator) {
        this.tileSelectionIndicator.renderUpdate();
      }
    }
  }

  public updateSideBarContent(tabName: TopLevelMenu, content: any[]): void {
    if (tabName === "Entities") {
      const entityMenuItems = content.map((entity) => {
        return this.mapEntityToMenuItem(entity);
      });
      this.sideMenu.setTabContent(tabName, entityMenuItems);
    } else if (tabName === "Build") {
      const buildMenuItems = content.map(
        (buildOption: { name: string; iconPath: string; id: BiomeId }) => {
          return this.mapBuildMenuItem(buildOption);
        }
      );
      this.sideMenu.setTabContent(tabName, buildMenuItems);
    }
  }

  public mapEntityToMenuItem(entity: Actor): MenuItem {
    const isAnimated = entity.tile.animationKeys != null;
    // use regex to select "mushroom_00_walk_14x18",
    // out of "sprites/mushroom_00_walk_14x18/mushroom_00_walk_14x18.json",
    let spritePath;
    if (isAnimated) {
      // spritePath = animatedTilePathToStatic(entity.tile.spritePath);
      spritePath = entity.tile.iconPath;
    } else {
      spritePath = entity.tile.spritePath;
    }
    return {
      id: `${entity.id}`,
      icon: getCachedTileTexture(spritePath),
      clickHandler: () => {
        console.log(`clicked on ${entity.id}`);
        this.ui.camera.setPointerTarget(entity.position, entity, true);
      },
      label: entity.name,
      tooltip: `Entity: ${entity.id}`,
    };
  }

  public mapBuildMenuItem(option: {
    name: string;
    iconPath: string;
    id: string;
  }): MenuItem {
    return {
      id: `${option.name}`,
      icon: getCachedTileTexture(option.iconPath),
      clickHandler: () => {
        const tile =
          Tile.Tilesets[option.id as BiomeId][this.game.timeManager.season][
            BaseTileKey
          ];

        this.game.map.setTile(
          this.ui.camera.pointerTarget.position.x,
          this.ui.camera.pointerTarget.position.y,
          tile
        );
      },
      label: option.name,
      tooltip: `Set: ${option.name} Tile`,
    };
  }

  public setUtilityActionsOptions(): void {
    this.utilityActions.setOptions([
      {
        label: "Overlays",
        icon: OverlayIcon,
        handler: () => {
          console.log("overlays selected");
          this.setUIVisible(false, true);
          // this.game.timeManager.setIsPaused(true);
          this.overlay.setVisible(true);
        },
      },
      {
        label: "Grid Indicator",
        icon: OverlayIcon,
        handler: () => {
          console.log("Grid Indicator selected");
          this.setUIVisible(false, true);
          this.tileSelectionIndicator.setVisible(true);
        },
      },
    ]);
  }

  public setSideMenuVisible(
    visible: boolean,
    includeToggle: boolean = false
  ): void {
    if (this.sideMenu) {
      this.sideMenu.setVisible(visible, includeToggle);
    }
  }

  public setTimeControlVisible(visible: boolean): void {
    if (this.timeControl) {
      this.timeControl.setVisible(visible);
    }
  }

  public setUIVisible(visible: boolean, hideIndicators: boolean = true): void {
    this.setSideMenuVisible(visible, hideIndicators);
    this.setTimeControlVisible(visible);
    this.tileInfo.setVisible(visible);
  }

  public registerOverlays() {
    this.overlay.generateBiomeOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Terrain",
      () => this.game.map.terrainMap
    );

    this.overlay.generateOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Magnetism",
      () => this.game.map.polesMap.magnetismMap
    );

    this.overlay.generateOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Temperature",
      () => this.game.map.tempMap.tempMap
    );

    this.overlay.generateGradientOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Temperature (blue <---> red)",
      { min: "blue", max: "red" },
      () => this.game.map.tempMap.tempMap
    );

    this.overlay.generateOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Moisture",
      () => this.game.map.moistureMap.moistureMap
    );

    this.overlay.generateOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Height",
      () => this.game.map.heightMap
    );

    // this.overlay.generateOverlay(
    //   GameSettings.options.gameSize.width,
    //   GameSettings.options.gameSize.height,
    //   "Sunlight",
    //   () => this.game.map.shadowMap.shadowMap
    // );

    this.overlay.generateBiomeOverlay(
      GameSettings.options.gameSize.width,
      GameSettings.options.gameSize.height,
      "Biomes",
      () => this.game.map.biomeMap
    );

    // this.overlay.generateOverlay(
    //   GameSettings.options.gameSize.width,
    //   GameSettings.options.gameSize.height,
    //   "Clouds",
    //   () => this.game.map.cloudMap.targetCloudMap
    // );
  }
}
