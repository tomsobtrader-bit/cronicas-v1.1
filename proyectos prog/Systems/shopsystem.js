export class ShopSystem {

    constructor(player){

        this.player = player
    }

    openShop(){

        console.log("Tienda abierta")

        console.log("Oro del jugador:", this.player.gold)

    }

}