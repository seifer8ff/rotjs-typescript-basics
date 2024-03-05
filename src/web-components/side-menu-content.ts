import "@shoelace-style/shoelace/dist/components/button/button.js";
import { MenuItem, MenuTab } from "./side-menu";

export class SideMenuContent extends HTMLElement {
  public optionLabels?: HTMLSpanElement[];

  constructor(private tab: MenuTab, private options: MenuItem[]) {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    const container = document.createElement("div");
    container.style.pointerEvents = "auto";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "end";
    container.style.justifyContent = "start";
    container.style.overflowY = "auto";

    this.optionLabels = this.options.map((option) => {
      const optionBtn = document.createElement("sl-button");
      optionBtn.classList.add("menu-option");
      optionBtn.setAttribute("variant", "text");
      const labelWrapper = document.createElement("div");
      labelWrapper.style.display = "inline-flex";
      labelWrapper.style.width = "60px";
      labelWrapper.style.overflow = "hidden";
      const label = document.createElement("span");
      label.id = option.id;
      label.textContent = option.label;
      label.style.overflow = "hidden";
      label.style.width = "100%";
      label.style.textOverflow = "ellipsis";
      label.style.whiteSpace = "nowrap";
      label.style.direction = "rtl";
      label.style.textAlign = "right";
      labelWrapper.appendChild(label);
      optionBtn.appendChild(labelWrapper);

      const avatar = document.createElement("div");
      avatar.style.display = "inline-block";
      avatar.style.marginLeft = "var(--sl-spacing-x-small)";
      avatar.style.transform = "translate(3px, 5px)";
      avatar.style.height = "16px";
      avatar.style.width = "16px";
      avatar.style.borderRadius = "10%";
      avatar.style.backgroundRepeat = "no-repeat";
      avatar.style.imageRendering = "pixelated";
      avatar.style.backgroundImage = `url(${option.icon.url})`;
      avatar.style.backgroundPositionX = `-${option.icon.xOffset}px`;
      avatar.style.backgroundPositionY = `-${option.icon.yOffset}px`;

      optionBtn.appendChild(avatar);
      optionBtn.style.pointerEvents = "auto";
      optionBtn.addEventListener("click", option.clickHandler);
      container.appendChild(optionBtn);
      return label;
    });

    shadow.appendChild(container);
  }

  private selectOption(label: HTMLSpanElement) {
    label.style.textDecoration = "underline";
    label.style.fontWeight = "var(--sl-font-weight-bold)";
    label.style.color = "var(--sl-color-primary-500)";
  }

  public setOptionSelected(optionId: number) {
    let label: HTMLSpanElement;
    this.optionLabels.forEach((option) => {
      option.style.textDecoration = "none";
      option.style.fontWeight = "var(--sl-font-weight-semi-bold)";
      option.style.color = "var(--sl-color-primary-600)";
      if (option.id === optionId?.toString()) {
        label = option;
      }
    });
    if (label) {
      this.selectOption(label);
    }
  }
}
