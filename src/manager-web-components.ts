import { Game } from "./game";
import { TimeControl } from "./web-components/time-control";
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
import { getCachedTile } from "./assets";
import OverlayIcon from "./shoelace/assets/icons/layers-half.svg";

export class ManagerWebComponents {
  private timeControl: TimeControl;
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
    if (this.overlay) {
      this.overlay.refresh(this.game.map);
    }
    if (this.tileInfo?.isVisible) {
      this.game.userInterface.camera.setPointerTarget(
        this.game.userInterface.camera.pointerTarget.position,
        this.game.userInterface.camera.pointerTarget.target
      );
    }
  }

  private initWebComponents() {
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

  public updateSideBarContent(tabName: TopLevelMenu, content: any[]): void {
    if (tabName === "Entities") {
      const entityMenuItems = content.map((entity) => {
        return this.mapEntityToMenuItem(entity);
      });
      this.sideMenu.setTabContent(tabName, entityMenuItems);
    }
  }

  public mapEntityToMenuItem(entity: Actor): MenuItem {
    return {
      id: `${entity.id}`,
      icon: getCachedTile(entity.tile.spritePath),
      clickHandler: () => {
        console.log(`clicked on ${entity.id}`);
        this.ui.camera.setPointerTarget(entity.position, entity, true);
      },
      label: entity.name,
      tooltip: `Entity: ${entity.id}`,
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
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Terrain",
      () => this.game.map.terrainMap
    );

    this.overlay.generateOverlay(
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Magnetism",
      () => this.game.map.polesMap.magnetismMap
    );

    this.overlay.generateOverlay(
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Temperature",
      () => this.game.map.tempMap.tempMap
    );

    this.overlay.generateGradientOverlay(
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Temperature (blue <---> red)",
      { min: "blue", max: "red" },
      () => this.game.map.tempMap.tempMap
    );

    this.overlay.generateOverlay(
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Moisture",
      () => this.game.map.moistureMap.moistureMap
    );

    this.overlay.generateOverlay(
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Height",
      () => this.game.map.heightMap
    );

    this.overlay.generateOverlay(
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Sunlight",
      () => this.game.map.shadowMap.shadowMap
    );

    this.overlay.generateBiomeOverlay(
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Biomes",
      () => this.game.map.biomeMap
    );

    this.overlay.generateOverlay(
      this.game.options.gameSize.width,
      this.game.options.gameSize.height,
      "Clouds",
      () => this.game.map.cloudMap.targetCloudMap
    );
  }
}
