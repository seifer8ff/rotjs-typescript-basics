import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import { SlDropdown, SlMenu, SlMenuItem } from "@shoelace-style/shoelace";
import "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";
import "@shoelace-style/shoelace/dist/components/menu/menu.js";
import "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import UtilityMenuIcon from "../shoelace/assets/icons/list.svg";

export class UtilityActions extends HTMLElement {
  public dropdown: SlDropdown;
  public dropdownMenu: SlMenu;
  public options: {
    label: string;
    icon: string;
    btn: SlMenuItem;
    handler: () => void;
  }[];

  public container: HTMLDivElement;
  public label: HTMLHeadingElement;

  constructor() {
    super();

    this.options = [];

    const shadow = this.attachShadow({ mode: "open" });
    this.container = document.createElement("div");
    this.dropdown = document.createElement("sl-dropdown");
    this.dropdown.hoist = true;
    const dropdownTrigger = document.createElement("sl-icon-button");
    dropdownTrigger.src = UtilityMenuIcon;
    dropdownTrigger.style.fontSize = "var(--sl-font-size-large)";
    dropdownTrigger.slot = "trigger";

    this.dropdown.appendChild(dropdownTrigger);
    this.dropdownMenu = document.createElement("sl-menu");
    this.dropdown.appendChild(this.dropdownMenu);

    this.dropdown.addEventListener("sl-select", (e) => {
      const selected = e.detail.item;
      const option = this.options.find((o) => o.label === selected.value);
      if (option) {
        option.handler();
      }
    });

    // this.container.style.top = "120px";
    // this.container.style.left = "0";
    // this.container.style.bottom = "20px";
    // this.container.style.width = "120px";
    // this.container.style.padding = "10px";
    // this.container.style.paddingRight = "0px";
    // this.container.style.paddingLeft = "0px";
    // this.container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    // this.container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    // this.container.style["backdropFilter"] = "blur(15px)";
    // this.container.style.borderBottomRightRadius = "10px";
    // this.container.style.transition = "transform 0.3s ease-in-out";

    this.container.appendChild(this.dropdown);

    shadow.appendChild(this.container);
  }

  public setOptions(
    options: { label: string; icon: string; handler: () => void }[]
  ) {
    this.options = options.map((option) => {
      const btn = document.createElement("sl-menu-item");
      btn.setAttribute("value", option.label);
      btn.textContent = option.label;
      this.dropdownMenu.appendChild(btn);
      return { ...option, btn };
    });
  }
}
