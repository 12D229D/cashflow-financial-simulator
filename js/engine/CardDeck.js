import { SMALL_DEALS, BIG_DEALS, MARKET_CARDS, DOODADS } from '../data/cards101.js';
import { CARDS_202 } from '../data/cards202.js';

export class CardDeck {
  constructor(mode202 = false) {
    this.mode202 = mode202;
    this.reset();
  }

  reset() {
    this.smallDeals = this.shuffle([...SMALL_DEALS]);
    this.bigDeals = this.shuffle([...BIG_DEALS]);
    this.market = this.shuffle([...MARKET_CARDS]);
    this.doodads = this.shuffle([...DOODADS]);

    if (this.mode202) {
      // Integrar derivados y oportunidades avanzadas 202
      this.optionsDeals = this.shuffle([...CARDS_202.options]);
      this.advancedDeals = this.shuffle([...CARDS_202.advancedDeals]);
    }
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  drawSmallDeal() {
    if (this.smallDeals.length === 0) this.smallDeals = this.shuffle([...SMALL_DEALS]);
    return this.smallDeals.pop();
  }

  drawBigDeal() {
    if (this.bigDeals.length === 0) this.bigDeals = this.shuffle([...BIG_DEALS]);
    return this.bigDeals.pop();
  }

  drawMarket() {
    if (this.market.length === 0) this.market = this.shuffle([...MARKET_CARDS]);
    return this.market.pop();
  }

  drawDoodad() {
    if (this.doodads.length === 0) this.doodads = this.shuffle([...DOODADS]);
    return this.doodads.pop();
  }

  drawOptionDeal() {
    if (!this.mode202 || !this.optionsDeals || this.optionsDeals.length === 0) {
      this.optionsDeals = this.shuffle([...CARDS_202.options]);
    }
    return this.optionsDeals.pop();
  }
}
