import { DeckSystem } from "../Systems/decksystem.js"
import { cardsData } from "../Data/cardsdata.js"
import { Troop } from "./troop.js"

export class Player {

constructor(){

this.health = 30
this.gold = 0

this.energy = 3

this.deck = new DeckSystem()

this.board = [null, null, null]

this.createStarterDeck()

}

createStarterDeck(){

this.deck.addCard(cardsData.arqueroEspectral)
this.deck.addCard(cardsData.berserkerMaldito)

}

playCard(index){

const card = this.deck.hand[index]

if(!card) return

if(card.cost > this.energy){
console.log("No tienes energía suficiente")
return
}

if(card.type === "troop"){

for(let i = 0; i < this.board.length; i++){

if(this.board[i] === null){

this.board[i] = new Troop(card)

this.energy -= card.cost

this.deck.hand.splice(index,1)

console.log(card.name + " invocado en posición " + i)

return

}

}

console.log("No hay espacio en el tablero")

}

}

}