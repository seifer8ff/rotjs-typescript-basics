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

  private isVisible: boolean;

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
    this.container.style.width = "160px";
    this.container.style.transition = "transform 0.3s ease-in-out";

    const header = document.createElement("div");
    header.style.width = "100%";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "start";
    header.style.paddingBottom = "var(--sl-spacing-small)";
    header.style.fontSize = "var(--sl-font-size-medium)";
    this.avatar = document.createElement("div");
    this.avatar.style.height = "32px";
    this.avatar.style.width = "32px";
    this.avatar.style.borderRadius = "10%";

    header.appendChild(this.avatar);
    this.label = document.createElement("span");
    this.label.textContent = "Tile Info";
    this.label.style.fontWeight = "var(--sl-font-weight-semibold)";
    this.label.style.fontSize = "var(--sl-font-size-medium)";
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
    this.body.style.fontSize = "var(--sl-font-size-small)";
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
    console.log("set content to", target);
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
      const biome = Tile.Biomes[target.target.biomeType];
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
    if (isActor(target.target)) {
      const dBlocks = target.target.getDescription();
      const dContainer = document.createElement("div");
      dContainer.style.display = "flex";
      dContainer.style.flexDirection = "column";
      dContainer.style.alignItems = "start";
      dContainer.style.justifyContent = "start";
      dContainer.style.padding = "0 0 0 0";
      dContainer.style.margin = "0 0 0 0";
      dContainer.style.width = "100%";
      dBlocks.forEach((block) => {
        const blockContainer = document.createElement("div");
        blockContainer.style.display = "flex";
        blockContainer.style.alignItems = "center";
        blockContainer.style.justifyContent = "start";
        blockContainer.style.padding = "0 0 0 0";
        blockContainer.style.margin = "0 0 0 0";
        blockContainer.style.width = "100%";
        const icon = document.createElement("sl-icon");
        icon.src = block.icon;
        const text = document.createElement("span");
        text.textContent = block.text;
        text.style.marginLeft = "var(--sl-spacing-x-small)";

        blockContainer.appendChild(icon);
        blockContainer.appendChild(text);
        dContainer.appendChild(blockContainer);

        this.body.appendChild(dContainer);
      });
    }

    if (target.target instanceof Tile) {
      const biome = Tile.Biomes[target.target.biomeType];
      this.body.textContent = `${biome.description}`;
    }
  }
}
