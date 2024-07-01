import "@shoelace-style/shoelace/dist/components/button/button.js";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/select/select";
import "@shoelace-style/shoelace/dist/components/option/option";
import "@shoelace-style/shoelace/dist/components/switch/switch";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.js";
import SlSwitch from "@shoelace-style/shoelace/dist/components/switch/switch.js";
import HandleIcon from "../shoelace/assets/icons/grip-vertical.svg";
import { SlIconButton } from "@shoelace-style/shoelace";
import { GameSettings } from "../game-settings";

export interface GameSettingsToggleOption {
  key: string;
  label: string;
  defaultValue: boolean;
  desc?: string;
}

export class TitleMenu extends HTMLElement {
  public container: HTMLDivElement;
  public handle: SlIconButton;
  public startBtn: SlButton;
  public form: HTMLFormElement;
  public worldSizeInput: SlSelect;
  private settingsLbl: HTMLHeadingElement;
  public isVisible: boolean;
  public isCollapsed: boolean;
  private formId: string = "game-settings-form";

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    this.isVisible = true;

    this.container = document.createElement("div");
    this.container.style.pointerEvents = "auto";
    this.container.style.position = "absolute";
    this.container.style.top = "120px";
    this.container.style.left = "0";
    this.container.style.bottom = "20px";
    this.container.style.width = "200px";
    this.container.style.padding = "10px 20px";
    // this.container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.container.style.backgroundColor = "rgba(45, 45, 45, .8)";
    this.container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.container.style["backdropFilter"] = "blur(15px)";
    this.container.style.borderBottomRightRadius = "10px";
    this.container.style.transition = "transform 0.3s ease-in-out";

    this.handle = document.createElement("sl-icon-button");
    this.handle.setAttribute("src", HandleIcon);
    this.handle.style.fontSize = "28px";
    // this.handle.style.backgroundColor = "rgba(0, 0, 0, .8)";
    this.handle.style.backgroundColor = "rgba(45, 45, 45, .8)";
    this.handle.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    this.handle.style["backdropFilter"] = "blur(15px)";
    this.handle.style.padding = "0";
    this.handle.style.borderTopRightRadius = "10px";
    this.handle.style.borderBottomRightRadius = "10px";
    this.handle.style.position = "absolute";
    this.handle.style.top = "0";
    this.handle.style.right = "-44px";
    this.handle.style.cursor = "pointer";
    this.container.appendChild(this.handle);

    this.startBtn = document.createElement("sl-button");
    this.startBtn.setAttribute("form", this.formId);
    this.startBtn.setAttribute("type", "submit"); // updates GameSettings with form data, and starts game
    this.startBtn.setAttribute("variant", "primary");
    this.startBtn.style.fontSize = "20px";
    this.startBtn.style.width = "100%";
    this.startBtn.textContent = "START GAME";
    this.container.appendChild(this.startBtn);
    const info = document.createElement("p");
    info.style.color = "var(--sl-color-neutral-600)";
    info.style.marginTop = "var(--sl-spacing-medium)";
    info.style.marginLeft = "var(--sl-spacing-2x-small)";
    info.style.fontSize = "var(--sl-font-size-small)";
    info.textContent =
      "Generate a new world with the settings specified below:";
    const info2 = document.createElement("p");
    info2.style.color = "var(--sl-color-neutral-500)";
    info2.style.marginTop = "var(--sl-spacing-2x-small)";
    info2.style.marginLeft = "var(--sl-spacing-2x-small)";
    info2.style.fontSize = "var(--sl-font-size-small)";
    info2.textContent = "Warning: may take some time to generate.";
    this.container.appendChild(info2);
    this.container.appendChild(info);

    this.settingsLbl = document.createElement("h1");
    this.settingsLbl.style.width = "100%";

    this.settingsLbl.textContent = "Settings";
    this.settingsLbl.style.color = "var(--sl-color-neutral-700)";
    this.settingsLbl.style.marginTop = "var(--sl-spacing-large)";
    this.settingsLbl.style.marginLeft = "var(--sl-spacing-2x-small)";
    this.settingsLbl.style.fontSize = "var(--sl-font-size-large)";
    this.settingsLbl.style.fontWeight = "var(--sl-font-weight-light)";
    this.settingsLbl.style.letterSpacing = "var(--sl-letter-spacing-normal)";
    this.container.appendChild(this.settingsLbl);

    this.initForm();

    shadow.appendChild(this.container);
  }

  private initForm(): void {
    this.form = document.createElement("form");
    this.form.setAttribute("id", this.formId);
    this.form.style.marginTop = "var(--sl-spacing-medium)";
    this.form.style.marginLeft = "var(--sl-spacing-2x-small)";
    this.form.style.width = "100%";
    this.form.style.display = "flex";
    this.form.style.flexDirection = "column";
    this.form.style.gap = "var(--sl-spacing-medium)";
    this.container.appendChild(this.form);

    this.worldSizeInput = document.createElement("sl-select");
    this.worldSizeInput.setAttribute("label", "World Size");
    this.worldSizeInput.setAttribute("placeholder", "Select world size");
    this.worldSizeInput.setAttribute(
      "value",
      JSON.stringify(GameSettings.options.gameSize)
    );
    this.worldSizeInput.style.width = "100%";
    this.worldSizeInput.style.maxWidth = "100%";

    GameSettings.worldSizeOptions.forEach((option) => {
      const newOption = document.createElement("sl-option");
      newOption.setAttribute("value", JSON.stringify(option.value));
      newOption.textContent = option.label;
      this.worldSizeInput.appendChild(newOption);
    });
    this.form.appendChild(this.worldSizeInput);
  }

  public setVisible(visible: boolean, includeToggle = false): void {
    console.log("set visible start menu");
    if (includeToggle) {
      this.handle.style.display = visible ? "block" : "none";
    }
    if (this.isCollapsed) {
      if (!visible) {
        this.container.style.transform = "translateX(-100%)";
        this.isVisible = false;
      }
      return;
    }
    this.isVisible = visible;
    this.container.style.transform = this.isVisible
      ? "translateX(0)"
      : "translateX(-100%)";
  }

  public setCollapsed(collapsed: boolean): void {
    this.isCollapsed = collapsed;
    this.setVisible(!this.isCollapsed);
  }

  public generateGameOptions(options: GameSettingsToggleOption[]): void {
    const toggles = options.map((option) => {
      const toggle: SlSwitch = document.createElement("sl-switch");
      toggle.setAttribute("name", option.key);
      toggle.textContent = option.label;
      if (option.defaultValue) {
        toggle.setAttribute("checked", "true");
        toggle.value = "true";
      } else {
        toggle.value = "false";
      }
      if (option.desc) {
        toggle.setAttribute("help-text", option.desc);
      }
      toggle.addEventListener("sl-change", (e) => {
        toggle.value = e.target["checked"];
      });

      return toggle;
    });
    toggles.forEach((toggle) => {
      this.form.appendChild(toggle);
    });
  }
}
