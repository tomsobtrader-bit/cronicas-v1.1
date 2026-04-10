import { Game } from "./game.js"

const game = new Game()

window.game = game

document.getElementById("start").onclick = ()=>{

game.start()

}