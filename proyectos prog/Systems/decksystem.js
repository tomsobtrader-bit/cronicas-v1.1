export class DeckSystem {

constructor(){

this.cards = []
this.discard = []
this.hand = []

}

addCard(card){

this.cards.push(card)

}

draw(){

if(this.cards.length === 0){

this.cards = this.discard
this.discard = []

}

const card = this.cards.shift()

if(card){

this.hand.push(card)

}

return card

}

drawStartingHand(){

for(let i=0;i<5;i++){

this.draw()

}

}

}