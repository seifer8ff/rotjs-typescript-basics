import "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";
import "@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js";
import "@shoelace-style/shoelace/dist/components/tab/tab.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/menu/menu.js";
import "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";
import "@shoelace-style/shoelace/dist/components/popup/popup.js";
import "@shoelace-style/shoelace/dist/components/menu-label/menu-label.js";
import "@shoelace-style/shoelace/dist/components/divider/divider.js";
import { MenuItem, MenuTab } from "./menu-tabs";
import "@shoelace-style/shoelace/dist/components/tooltip/tooltip.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import { SlIconButton } from "@shoelace-style/shoelace";

export class MenuTabContent extends HTMLElement {
  public optionControls?: SlIconButton[];

  constructor(private tab: MenuTab, private options: MenuItem[]) {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    const container = document.createElement("div");
    container.style.pointerEvents = "auto";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.style.justifyContent = "start";
    container.style.overflowY = "auto";

    this.optionControls = this.options.map((option) => {
      // const optionTooltip = document.createElement("sl-tooltip");
      // optionTooltip.setAttribute("content", option.tooltip);
      // optionTooltip.setAttribute("hoist", "true");
      const optionBtn = document.createElement("sl-icon-button");
      optionBtn.classList.add("menu-option");
      optionBtn.setAttribute("src", option.icon);
      optionBtn.style.pointerEvents = "auto";
      optionBtn.addEventListener("click", option.clickHandler);
      // optionTooltip.appendChild(optionBtn);
      container.appendChild(optionBtn);
      return optionBtn;
    });

    shadow.appendChild(container);
  }
}
