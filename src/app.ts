import { Game } from "./game";

document.body.onload = async () => {
  var game = new Game();
  await game.Init();
  game.start();
};
