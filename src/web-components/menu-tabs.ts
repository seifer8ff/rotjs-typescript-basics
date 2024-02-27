import "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";
import "@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js";
import "@shoelace-style/shoelace/dist/components/tab/tab.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
import SlTabGroup from "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";
import SlTabPanel from "@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js";
import "@shoelace-style/shoelace/dist/components/menu/menu.js";
import "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";
import "@shoelace-style/shoelace/dist/components/popup/popup.js";
import "@shoelace-style/shoelace/dist/components/menu-label/menu-label.js";
import "@shoelace-style/shoelace/dist/components/divider/divider.js";
import { MenuTabContent } from "./menu-tab-content";
import SlMenu from "@shoelace-style/shoelace/dist/components/menu/menu.js";
import SlDropdown from "@shoelace-style/shoelace/dist/components/dropdown/dropdown.js";
import SlMenuItem from "@shoelace-style/shoelace/dist/components/menu-item/menu-item.js";
import EntityIcon from "../shoelace/assets/icons/person-bounding-box.svg";
import WrenchIcon from "../shoelace/assets/icons/wrench.svg";
import HouseIcon from "../shoelace/assets/icons/house-door.svg";
import BackpackIcon from "../shoelace/assets/icons/backpack4.svg";
import PersonIcon from "../shoelace/assets/icons/person.svg";
import HouseWithGearIcon from "../shoelace/assets/icons/house-gear.svg";
import HouseDownIcon from "../shoelace/assets/icons/house-down-fill.svg";
import GeoIcon from "../shoelace/assets/icons/geo-alt.svg";
import ShopWindowIcon from "../shoelace/assets/icons/shop-window.svg";
import CurrencyIcon from "../shoelace/assets/icons/currency-dollar.svg";
import PiggyBankIcon from "../shoelace/assets/icons/piggy-bank.svg";
import CapsuleIcon from "../shoelace/assets/icons/capsule.svg";
import FlowerIcon from "../shoelace/assets/icons/flower2.svg";
import PencilIcon from "../shoelace/assets/icons/pencil.svg";

export interface MenuTab {
  name: string;
  icon: string;
}

export const Tabs: MenuTab[] = [
  { name: "Entities", icon: PersonIcon },
  { name: "Cities", icon: HouseIcon },
  { name: "Resources", icon: BackpackIcon },
  { name: "Build", icon: WrenchIcon },
];

export class MenuTabs extends HTMLElement {
  public tabGroup: SlTabGroup;
  public tabPanels: SlTabPanel[];
  private dropdownBtn: SlButton;
  private dropdown: SlDropdown;
  public dropdownMenu: SlMenu;
  public selectedTab: MenuTab;
  public menuTabContent: MenuTabContent;
  private topControls: HTMLDivElement;
  private midControls: HTMLDivElement;
  private dropdownMenuOptions: SlMenuItem[];

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    const container = document.createElement("div");
    container.style.pointerEvents = "auto";
    container.style.position = "absolute";
    container.style.top = "120px";
    container.style.left = "0";
    container.style.bottom = "20px";
    container.style.padding = "10px";
    container.style.paddingRight = "0px";
    container.style.paddingLeft = "0px";
    container.style.backgroundColor = "rgba(0, 0, 0, .8)";
    container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    container.style["backdropFilter"] = "blur(15px)";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "stretch";
    container.style.justifyContent = "start";
    container.style.borderTopRightRadius = "10px";
    container.style.borderBottomRightRadius = "10px";
    const innerContainer = document.createElement("div");
    innerContainer.style.position = "relative";
    innerContainer.style.display = "flex";
    innerContainer.style.flexDirection = "column";
    innerContainer.style.alignItems = "stretch";
    innerContainer.style.justifyContent = "start";
    innerContainer.style.overflow = "hidden";
    container.appendChild(innerContainer);

    this.topControls = document.createElement("div");
    this.topControls.style.display = "flex";
    this.topControls.style.flexDirection = "column";
    this.dropdown = document.createElement("sl-dropdown");
    this.dropdown.setAttribute("hoist", "true");
    this.dropdown.setAttribute("placement", "bottom-end");
    this.dropdown.style.pointerEvents = "auto";
    this.dropdown.style.marginTop = "5px";

    this.dropdownMenu = document.createElement("sl-menu");
    this.dropdownMenu.style.pointerEvents = "auto";
    this.dropdown.appendChild(this.dropdownMenu);

    const divider = document.createElement("sl-divider");
    this.topControls.appendChild(this.dropdown);
    this.topControls.appendChild(divider);

    this.midControls = document.createElement("div");
    this.midControls.style.display = "flex";
    this.midControls.style.flexDirection = "column";
    this.midControls.style.justifyContent = "start";
    this.midControls.style.overflowY = "auto";

    this.setSelectedTab(Tabs[0]);

    innerContainer.appendChild(this.topControls);
    innerContainer.appendChild(this.midControls);

    shadow.appendChild(container);
  }

  public getTab(tabName: string): MenuTab {
    return Tabs.find((tab) => tab.name === tabName);
  }

  public setSelectedTab(tab: MenuTab): void {
    this.selectedTab = tab;
    this.buildTabDropdown();
    this.buildTabContent();
  }

  private buildTabDropdown(): void {
    if (this.dropdownBtn) {
      this.dropdown.removeChild(this.dropdownBtn);
    }
    this.dropdownBtn = document.createElement("sl-button");
    this.dropdownBtn.setAttribute("variant", "text");
    this.dropdownBtn.setAttribute("slot", "trigger");
    this.dropdownBtn.setAttribute("caret", "");
    const dropdownIcon = document.createElement("sl-icon");
    // dropdownIcon.setAttribute("name", this.selectedTab.icon);
    dropdownIcon.setAttribute("src", this.selectedTab.icon);
    dropdownIcon.style.fontSize = "20px";
    this.dropdownBtn.appendChild(dropdownIcon);
    this.dropdown.appendChild(this.dropdownBtn);

    if (this.dropdownMenuOptions) {
      for (let option of this.dropdownMenuOptions) {
        this.dropdownMenu.removeChild(option);
      }
    }
    this.dropdownMenuOptions = [];

    for (let tab of Tabs) {
      if (tab === this.selectedTab) {
        continue;
      }

      const dropdownItem = document.createElement("sl-menu-item");
      const dropdownIcon = document.createElement("sl-icon");
      dropdownIcon.style.marginRight = "15px";
      dropdownItem.textContent = tab.name;
      dropdownItem.id = tab.name;
      dropdownItem.style.paddingTop = "15px";
      dropdownItem.style.paddingBottom = "15px";
      dropdownIcon.setAttribute("slot", "prefix");
      dropdownIcon.setAttribute("src", tab.icon);
      dropdownItem.appendChild(dropdownIcon);
      this.dropdownMenu.appendChild(dropdownItem);
      this.dropdownMenuOptions.push(dropdownItem);
    }
  }

  private buildTabContent(): void {
    let placeholderResources: MenuTab[];

    switch (this.selectedTab.name) {
      case "Entities":
        placeholderResources = [
          { name: "Mario", icon: EntityIcon },
          { name: "Cassie", icon: EntityIcon },
          { name: "Judy", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
          { name: "Jermaine", icon: EntityIcon },
        ];
        break;
      case "Cities":
        placeholderResources = [
          { name: "Boom Town", icon: HouseWithGearIcon },
          { name: "Declining City", icon: HouseDownIcon },
          { name: "Potential Site", icon: GeoIcon },
          { name: "Commercial District", icon: ShopWindowIcon },
        ];
        break;
      case "Resources":
        placeholderResources = [
          { name: "Currency", icon: CurrencyIcon },
          { name: "Animals", icon: PiggyBankIcon },
          { name: "Medicine", icon: CapsuleIcon },
          { name: "Plant Material", icon: FlowerIcon },
        ];
        break;
      case "Build":
        placeholderResources = [
          { name: "Planning", icon: PencilIcon },
          { name: "Housing", icon: HouseIcon },
        ];
        break;
    }
    if (this.menuTabContent) {
      this.midControls.removeChild(this.menuTabContent);
    }

    this.menuTabContent = new MenuTabContent(
      this.selectedTab,
      placeholderResources
    );
    this.midControls.appendChild(this.menuTabContent);
  }
}
