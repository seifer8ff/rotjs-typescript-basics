import { Game } from "./game";
import "./style.css";

document.body.onload = async () => {
  var game = new Game();
  await game.Init();
  game.start();
};
