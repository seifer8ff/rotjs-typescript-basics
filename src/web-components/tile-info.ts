import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import "@shoelace-style/shoelace/dist/components/avatar/avatar.js";
import { SlCard, SlIconButton, SlRange } from "@shoelace-style/shoelace";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import CloseIcon from "../shoelace/assets/icons/x.svg";
import FocusIcon from "../shoelace/assets/icons/fullscreen.svg";
import { PointerTarget } from "../camera";
import { isActor } from "../entities/actor";
import { Tile } from "../tile";
import { CachedSprite, getCachedTile } from "../assets";
import PinIcon from "../shoelace/assets/icons/pin-map.svg";
import TextIcon from "../shoelace/assets/icons/card-text.svg";
import { Biome, Biomes } from "../biomes";

export interface TileStats {
  height: number;
  magnetism: number;
  temperaturePercent: number;
  moisture: number;
  sunlight: number;
  biome: Biome;
}

export class TileInfo extends HTMLElement {
  public container: HTMLDivElement;
  public label: HTMLSpanElement;
  // public avatar: SlAvatar;
  public avatar: HTMLDivElement;
  public body: HTMLDivElement;
  public infoCard: SlCard;
  public target: PointerTarget;

  public timeText: HTMLSpanElement;
  public timeSlider: SlRange;

  public pauseBtn: SlIconButton;

  private _isVisible: boolean;

  public get isVisible(): boolean {
    return this._isVisible;
  }

  private set isVisible(value: boolean) {
    this._isVisible = value;
  }

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    this.isVisible = false;
    this.target = null;

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.bottom = "0";
    this.container.style.right = "0";
    this.container.style.display = "flex";
    this.container.style.flexDirection = "column";
    this.container.style.alignItems = "center";
    this.container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.container.style["backdropFilter"] = "blur(15px)";
    this.container.style.paddingTop = "var(--sl-spacing-x-small)";
    this.container.style.paddingLeft = "var(--sl-spacing-x-small)";
    this.container.style.borderTopLeftRadius = "10px";
    this.container.style.borderTopRightRadius = "10px";
    this.container.style.pointerEvents = "auto";
    this.container.style.height = "120px";
    this.container.style.width = "200px";
    this.container.style.transition = "transform 0.3s ease-in-out";

    const header = document.createElement("div");
    header.style.width = "100%";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "start";
    header.style.paddingBottom = "var(--sl-spacing-small)";
    header.style.fontSize = "var(--sl-font-size-small)";
    this.avatar = document.createElement("div");
    this.avatar.style.height = "32px";
    this.avatar.style.width = "32px";
    this.avatar.style.borderRadius = "10%";

    header.appendChild(this.avatar);
    this.label = document.createElement("span");
    this.label.textContent = "Tile Info";
    this.label.style.fontWeight = "var(--sl-font-weight-semibold)";
    this.label.style.fontSize = "var(--sl-font-size-small)";
    this.label.style.marginLeft = "var(--sl-spacing-small)";
    this.label.style.whiteSpace = "nowrap";
    this.label.style.overflow = "hidden";
    this.label.style.textOverflow = "ellipsis";
    this.label.style.width = "70%";
    header.appendChild(this.label);

    const buttonGroup = document.createElement("div");
    buttonGroup.style.position = "absolute";
    buttonGroup.style.right = "var(--sl-spacing-3x-small)";
    buttonGroup.style.top = "var(--sl-spacing-3x-small)";
    buttonGroup.style.display = "flex";
    buttonGroup.style.alignItems = "start";
    buttonGroup.style.justifyContent = "flex-end";

    const closeBtn = document.createElement("sl-icon-button");
    closeBtn.setAttribute("size", "small");
    closeBtn.setAttribute("src", CloseIcon);
    closeBtn.style.fontSize = "12px";
    closeBtn.style.transform = "scale(1.75)";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", () => {
      this.setContent(null);
    });
    buttonGroup.appendChild(closeBtn);

    header.appendChild(buttonGroup);

    this.container.appendChild(header);

    this.body = document.createElement("div");
    this.body.style.overflow = "auto";
    this.body.style.paddingLeft = "var(--sl-spacing-2x-small)";
    this.body.style.paddingRight = "var(--sl-spacing-2x-small)";
    this.body.style.fontSize = "var(--sl-font-size-x-small)";
    this.body.style.width = "100%";
    this.body.textContent = `Grassland.
    Gentle hills able to support a variety of wild grass and plant life.
    Depleted. The soil is in need of nutrients to support healthy plant life.
    Clear skies with a gentle breeze.
    72°F.
    `;

    this.container.appendChild(this.body);
    this.setVisible(false);

    shadow.appendChild(this.container);
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      if (!this.target) {
        return;
      }
    }

    this.isVisible = visible;
    this.container.style.transform = this.isVisible
      ? "translateY(0)"
      : "translateY(100%)";
  }

  public setContent(target: PointerTarget): void {
    // console.log("set content to", target);
    this.target = target;
    if (target == null) {
      this.setVisible(false);
      return;
    }

    this.container.style.display = "flex";

    let cachedSprite: CachedSprite;

    if (isActor(target.target)) {
      this.label.textContent = `${target.target.name}`;
      cachedSprite = getCachedTile(target.target.tile.sprite);
      this.avatar.style.transform =
        "translateX(25%) translateY(25%) scale(1.5)";
    }

    if (target.target instanceof Tile) {
      const biome = Biomes.Biomes[target.target.biomeId];
      this.label.textContent = `${biome.name}`;
      cachedSprite = getCachedTile(target.target.sprite);
      this.avatar.style.transform = "translateX(0%) translateY(0%) scale(1)";
    }

    this.avatar.style.backgroundImage = `url(${cachedSprite.url})`;
    this.avatar.style.backgroundRepeat = "no-repeat";
    this.avatar.style.width = "16px";
    this.avatar.style.height = "16px";

    this.avatar.style.imageRendering = "pixelated";
    this.avatar.style.backgroundPositionX = `-${cachedSprite.xOffset}px`;
    this.avatar.style.backgroundPositionY = `-${cachedSprite.yOffset}px`;
    this.setBodyContent(target);
    this.setVisible(true);
  }

  public setBodyContent(target: PointerTarget) {
    this.body.removeChild(this.body.firstChild);
    this.body.textContent = "";
    const bodyContainer = document.createElement("div");
    bodyContainer.style.display = "flex";
    bodyContainer.style.flexDirection = "column";
    bodyContainer.style.alignItems = "start";
    bodyContainer.style.justifyContent = "start";
    bodyContainer.style.padding = "0 0 0 0";
    bodyContainer.style.margin = "0 0 0 0";
    bodyContainer.style.width = "100%";

    if (isActor(target.target)) {
      const dBlocks = target.target.getDescription();
      dBlocks.forEach((block) => {
        const blockContainer = this.generateDescriptionBlock(
          block.icon,
          block.text
        );
        bodyContainer.appendChild(blockContainer);
      });
    }

    if (target.target instanceof Tile) {
      const dBlocks = Tile.getDescription(target);
      dBlocks.forEach((block) => {
        const blockContainer = this.generateDescriptionBlock(
          block.icon,
          block.text
        );
        bodyContainer.appendChild(blockContainer);
      });
      // const biome = Biomes.Biomes[target.target.biomeId];
      // const posBlock = this.generateDescriptionBlock(
      //   PinIcon,
      //   `${target.position.x}, ${target.position.y}`
      // );
      // const descBlock = this.generateDescriptionBlock(
      //   TextIcon,
      //   `${biome.description}`
      // );

      // bodyContainer.appendChild(posBlock);
      // bodyContainer.appendChild(descBlock);
    }

    this.body.appendChild(bodyContainer);
  }

  private generateDescriptionBlock(icon: string, text: string): HTMLDivElement {
    const block = document.createElement("div");
    block.style.display = "flex";
    // block.style.alignItems = "center";
    block.style.justifyContent = "start";
    block.style.padding = "0 0 0 0";
    block.style.margin = "2px 0 0 0";
    block.style.width = "100%";
    const iconEl = document.createElement("sl-icon");
    iconEl.src = icon;
    iconEl.style.flexShrink = "0";
    const textEl = document.createElement("span");
    textEl.textContent = text;
    textEl.style.marginLeft = "var(--sl-spacing-x-small)";
    textEl.style.overflow = "hidden";
    textEl.style.textOverflow = "ellipsis";
    textEl.style.whiteSpace = "nowrap";

    block.appendChild(iconEl);
    block.appendChild(textEl);
    return block;
  }
}
