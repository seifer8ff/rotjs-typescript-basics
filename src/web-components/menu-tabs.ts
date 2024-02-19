import "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";
import "@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js";
import "@shoelace-style/shoelace/dist/components/tab/tab.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
import SlTabGroup from "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";
import SlTabPanel from "@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js";
import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.js";

export class MenuTabs extends HTMLElement {
  public pauseBtn: SlButton;
  public pauseIcon: SlIcon;
  public tabGroup: SlTabGroup;
  public tabPanels: SlTabPanel[];

  constructor() {
    super();

    const tabIds = ["Game", "Inventory", "Settings"];

    const shadow = this.attachShadow({ mode: "open" });

    const container = document.createElement("div");
    container.style.pointerEvents = "auto";
    container.style.position = "absolute";
    container.style.top = "120px";
    container.style.left = "0";
    container.style.bottom = "20px";
    container.style.padding = "10px";
    container.style.paddingLeft = "20px";
    container.style.maxWidth = "calc(100% - 20px)";
    container.style.maxHeight = "calc(100% - 20px)";
    container.style.overflow = "hidden";
    container.style.backgroundColor = "rgba(25, 25, 25, .55)";
    container.style.boxShadow = "0 0 10px 1px rgba(0, 0, 0, 0.25)";
    container.style.backdropFilter = "blur(15px)";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.style.borderTopRightRadius = "10px";
    container.style.borderBottomRightRadius = "10px";

    const topControls = document.createElement("div");
    topControls.style.flexGrow = "1";
    topControls.style.flexBasis = "0";

    this.pauseBtn = document.createElement("sl-button");
    this.pauseBtn.setAttribute("variant", "text");
    this.pauseBtn.setAttribute("size", "large");
    container.style.pointerEvents = "auto";
    // pauseButton.style.margin = "15px";
    this.pauseIcon = document.createElement("sl-icon");
    this.pauseIcon.style.fontSize = "32px";
    this.pauseIcon.setAttribute("name", "pause-fill");

    this.pauseBtn.appendChild(this.pauseIcon);
    this.pauseBtn.addEventListener("click", () => {
      console.log("Pause button clicked");
    });

    topControls.appendChild(this.pauseBtn);

    const midControls = document.createElement("div");
    midControls.style.flexGrow = "1";
    midControls.style.flexBasis = "0";
    midControls.style.display = "flex";
    midControls.style.flexDirection = "column";
    midControls.style.justifyContent = "center";

    const tabGroup = document.createElement("sl-tab-group");
    tabGroup.setAttribute("placement", "start");
    tabGroup.addEventListener("sl-tab-hide", (e: any) => {
      const hideTab = e.detail.name;
      if (hideTab === "game") {
        topControls.style.display = "none";
        bottomControls.style.display = "none";
        // topControls.style.height = "0";
        // bottomControls.style.height = "0";
      } else {
        // topControls.style.height = "auto";
        // bottomControls.style.height = "auto";
        topControls.style.display = "flex";
        bottomControls.style.display = "flex";
        return;
      }
    });
    tabGroup.addEventListener("sl-tab-show", (e: any) => {
      const showTab = e.detail.name;
      if (showTab === "game") {
        // topControls.style.height = "0";
        // bottomControls.style.height = "0";
        topControls.style.display = "flex";
        bottomControls.style.display = "flex";
        return;
      } else {
        // topControls.style.height = "0";
        // bottomControls.style.height = "0";
        topControls.style.display = "none";
        bottomControls.style.display = "none";
        return;
      }
    });

    tabIds.forEach((tabId) => {
      const navTab = document.createElement("sl-tab");
      const navIcon = document.createElement("sl-icon");
      switch (tabId) {
        case "Game":
          navIcon.setAttribute("name", "globe-americas");
          break;
        case "Inventory":
          navIcon.setAttribute("name", "backpack4");
          break;
        case "Settings":
          navIcon.setAttribute("name", "gear");
          break;
        default:
          navIcon.setAttribute("name", "exclamation-triangle");
      }
      navTab.appendChild(navIcon);
      navTab.style.margin = "15px";
      navTab.style.pointerEvents = "auto";

      navTab.setAttribute("slot", "nav");
      navTab.setAttribute("panel", tabId.toLowerCase());

      tabGroup.appendChild(navTab);
    });

    tabIds.forEach((tabId) => {
      if (tabId === "Game") {
        return;
      }
      const panelTab = document.createElement("sl-tab-panel");
      panelTab.textContent = `This is the ${tabId} panel...`;
      panelTab.setAttribute("name", tabId.toLowerCase());
      panelTab.style.padding = "10px";

      panelTab.style.pointerEvents = "auto";
      tabGroup.appendChild(panelTab);
    });
    midControls.appendChild(tabGroup);

    const bottomControls = document.createElement("div");
    bottomControls.style.flexGrow = "1";
    bottomControls.style.flexBasis = "0";
    bottomControls.style.display = "flex";
    bottomControls.style.flexDirection = "column";

    const testResources = [
      "currency-dollar",
      "piggy-bank",
      "capsule",
      "flower2",
    ];

    testResources.forEach((resource) => {
      const resourceBtn = document.createElement("sl-button");
      const resourceIcon = document.createElement("sl-icon");
      resourceBtn.setAttribute("variant", "text");
      resourceBtn.style.pointerEvents = "auto";
      resourceIcon.style.padding = "15px";
      resourceIcon.style.fontSize = "16px";
      resourceIcon.setAttribute("name", resource);
      resourceBtn.appendChild(resourceIcon);
      bottomControls.appendChild(resourceBtn);
    });

    container.appendChild(topControls);
    container.appendChild(midControls);
    container.appendChild(bottomControls);

    // container.appendChild(tabGroup);

    shadow.appendChild(container);
  }
}
