import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";

export class TimeControl extends HTMLElement {
  public timeDisplay: HTMLDivElement;
  public timeText: HTMLSpanElement;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.backgroundColor = "rgba(25, 25, 25, .55)";
    container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    container.style.backdropFilter = "blur(15px)";
    container.style.padding = "20px";
    container.style.fontFamily = "Arial";
    container.style.fontSize = "18px";
    container.style.borderBottomRightRadius = "10px";

    this.timeText = document.createElement("span");
    this.timeText.textContent = "CURRENT TIME";

    container.appendChild(this.timeText);
    shadow.appendChild(container);
  }

  public updateTime(timeForDisplay: string): void {
    this.timeText.textContent = timeForDisplay;
  }
}
