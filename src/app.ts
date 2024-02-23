import { Game } from "./game";
// import "./shoelace/themes/dark.styles";
import "./shoelace/themes/dark.css";
import "./style.css";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";

// Set shoelace base path
// this path works on both prod and dev
// during build process, assets are copied from node module into root and dist folder
// setBasePath("shoelace");

document.body.onload = async () => {
  var game = new Game();
  await game.Init();
  game.start();
};
