import { Biome } from "../tile";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import CloseIcon from "../shoelace/assets/icons/x.svg";
import { SlIconButton } from "@shoelace-style/shoelace";

export class Overlay extends HTMLElement {
  public container: HTMLDivElement;
  public label: HTMLHeadingElement;
  public closeBtn: SlIconButton;
  public overlays: {
    label: string;
    canvas: HTMLCanvasElement;
  }[];
  public displayOverlays: {
    label: string;
    canvas: HTMLCanvasElement;
  }[];
  public isVisible: boolean;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    this.overlays = [];
    this.displayOverlays = [];
    this.isVisible = false;

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.top = "0";
    this.container.style.bottom = "0";
    this.container.style.left = "0";
    this.container.style.right = "0";
    this.container.style.display = "flex";
    this.container.style.flexFlow = "column nowrap";
    this.container.style.alignItems = "center";
    this.container.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
    this.container.style.pointerEvents = "auto";

    this.closeBtn = document.createElement("sl-icon-button");
    this.closeBtn.setAttribute("size", "large");
    this.closeBtn.setAttribute("src", CloseIcon);
    this.closeBtn.style.position = "absolute";
    this.closeBtn.style.top = "15px";
    this.closeBtn.style.right = "15px";
    this.closeBtn.style.zIndex = "100";
    this.closeBtn.style.pointerEvents = "auto";
    this.closeBtn.style.fontSize = "40px";

    this.container.appendChild(this.closeBtn);

    this.label = document.createElement("h1");
    this.label.textContent = "Overlay";
    this.label.style.display = "none";

    this.container.appendChild(this.label);

    this.container.addEventListener("click", this.handleClick.bind(this));

    this.setVisible(false);
    shadow.appendChild(this.container);
  }

  public generateOverlay(
    greyscaleMap: { [key: string]: number },
    width: number,
    height: number,
    label: string = "Greyscale Overlay"
  ) {
    const overlay = this.generateOverlayContainer(label, width, height);
    const canvas = overlay.canvas;

    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return;
    }
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % canvas.width;
      const y = Math.floor(i / 4 / canvas.width);
      const key = `${x},${y}`;
      const value = greyscaleMap[key] * 255;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  public generateBiomeOverlay(
    biomeMap: { [key: string]: Biome },
    width: number,
    height: number,
    label: string = "Color Overlay"
  ) {
    const overlay = this.generateOverlayContainer(label, width, height);
    const canvas = overlay.canvas;
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return;
    }
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    // set the color of each pixel to biome.color
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % canvas.width;
      const y = Math.floor(i / 4 / canvas.width);
      const key = `${x},${y}`;
      const biome = biomeMap[key];
      if (biome) {
        const color = biome.color;
        data[i] = parseInt(color.substr(1, 2), 16);
        data[i + 1] = parseInt(color.substr(3, 2), 16);
        data[i + 2] = parseInt(color.substr(5, 2), 16);
        data[i + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private generateOverlayContainer(
    label: string,
    width: number,
    height: number
  ): { label: string; canvas: HTMLCanvasElement } {
    const overlayContainer = document.createElement("div");
    overlayContainer.style.position = "absolute";
    overlayContainer.style.top = "0";
    overlayContainer.style.bottom = "0";
    overlayContainer.style.left = "0";
    overlayContainer.style.right = "0";
    overlayContainer.style.pointerEvents = "none";
    overlayContainer.style.display = "flex";
    overlayContainer.style.justifyContent = "center";
    overlayContainer.style.alignItems = "center";

    this.label.textContent = label;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const scale = (window.innerWidth / width) * 0.7;
    canvas.style.transform = `scale(${scale})`;
    canvas.style.imageRendering = "pixelated";
    canvas.style.display = "none";
    this.overlays.push({ label, canvas });
    this.displayOverlays.push({ label, canvas });
    overlayContainer.appendChild(canvas);
    this.container.appendChild(overlayContainer);
    return { label, canvas };
  }

  private handleClick(e: MouseEvent) {
    if (this.isVisible) {
      const forward = e.clientX > window.innerWidth / 2;
      this.nextOverlay(forward);
    }
  }

  public nextOverlay(forward = true) {
    let currentOverlay;
    let nextOverlay;
    if (forward) {
      currentOverlay = this.overlays.shift();
      this.overlays.push(currentOverlay);
      nextOverlay = this.overlays[0];
    } else {
      currentOverlay = this.overlays[0];
      nextOverlay = this.overlays.pop();
      this.overlays.unshift(nextOverlay);
    }
    if (currentOverlay) {
      currentOverlay.canvas.style.display = "none";
    }
    this.label.textContent = nextOverlay.label;
    this.label.style.display = "block";
    nextOverlay.canvas.style.display = "block";
  }

  public setVisible(visible: boolean) {
    if (visible) {
      this.overlays[0].canvas.style.display = "block";
      this.label.style.display = "block";
    } else {
      this.overlays.forEach((overlay) => {
        overlay.canvas.style.display = "none";
      });
      this.label.style.display = "none";
    }
    this.isVisible = visible;
    this.container.style.display = visible ? "flex" : "none";
  }

  public toggleVisible() {
    this.setVisible(!this.isVisible);
  }
}
