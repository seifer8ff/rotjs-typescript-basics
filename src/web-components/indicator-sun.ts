import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/range/range.js";
import { SlIconButton, SlRange } from "@shoelace-style/shoelace";
import PauseIcon from "../shoelace/assets/icons/pause-fill.svg";
import PlayIcon from "../shoelace/assets/icons/play-fill.svg";
import { UtilityActions } from "./utility-actions";

export class IndicatorSun extends HTMLElement {
  public container: HTMLDivElement;
  public pauseBtn: SlIconButton;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.top = "-20px";
    this.container.style.left = "50%";
    this.container.style.width = "70px";
    this.container.style.height = "70px";
    this.container.style.display = "flex";
    this.container.style.alignItems = "center";
    this.container.style.justifyContent = "center";
    this.container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.container.style["backdropFilter"] = "blur(15px)";
    this.container.style.fontFamily = "Arial";
    this.container.style.fontSize = "18px";
    this.container.style.borderRadius = "50%";
    this.container.style.pointerEvents = "auto";

    this.pauseBtn = document.createElement("sl-icon-button");
    this.pauseBtn.setAttribute("size", "large");
    this.pauseBtn.setAttribute("src", PauseIcon);
    this.pauseBtn.style.fontSize = "32px";

    this.container.appendChild(this.pauseBtn);

    shadow.appendChild(this.container);
  }

  // public updateTime(timeForDisplay: string): void {
  //   this.timeText.textContent = timeForDisplay;
  // }

  public updatePauseBtn(pause: boolean): void {
    this.pauseBtn.setAttribute("src", pause ? PlayIcon : PauseIcon);
  }

  // public toggleTooltip(): void {
  //   // this.timeSlider.shadowRoot.querySelector("div[part=base]").setAttribute("open", "true");
  //   const tooltip = this.timeSlider.shadowRoot.querySelector("sl-tooltip");
  //   console.log("-------- got tooltip?: ", tooltip);
  //   // if (tooltip) {
  //   //   tooltip.setAttribute("open", "true");
  //   // }
  // }

  public setVisible(visible: boolean): void {
    this.style.display = visible ? "block" : "none";
  }
}
