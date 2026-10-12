import { FinancialEngine } from './FinancialEngine.js';

export const AI_PROFILES = {
  cautious: {
    name: "IA Cauta (Warren)",
    minCashReserve: 2500,
    minROI: 0.20,
    preferBigDealsAfter: 20000,
    allowBankLoan: false,
    color: "#3b82f6"
  },
  risky: {
    name: "IA Audaz (Jordan)",
    minCashReserve: 500,
    minROI: 0.10,
    preferBigDealsAfter: 6000,
    allowBankLoan: true,
    color: "#f43f5e"
  },
  scared: {
    name: "IA Aversa al Riesgo (Dave)",
    minCashReserve: 4000,
    minROI: 0.25,
    preferBigDealsAfter: 35000,
    allowBankLoan: false,
    color: "#a855f7"
  },
  smarter: {
    name: "IA Estratega (Ray)",
    minCashReserve: 1500,
    minROI: 0.15,
    preferBigDealsAfter: 12000,
    allowBankLoan: true,
    color: "#10b981"
  },
  default: {
    name: "IA Equilibrada (Robert)",
    minCashReserve: 1200,
    minROI: 0.12,
    preferBigDealsAfter: 10000,
    allowBankLoan: true,
    color: "#eab308"
  }
};

export class AIPlayer {
  constructor(name, profileKey = "default", profession) {
    this.name = name;
    this.profileKey = profileKey;
    this.profile = AI_PROFILES[profileKey] || AI_PROFILES.default;
    this.color = this.profile.color;
    this.position = 0;
    this.state = FinancialEngine.createInitialStatement(profession);
    this.isAI = true;
  }

  decideOpportunityType() {
    // Si tiene suficiente efectivo según su perfil, toma Big Deal; sino Small Deal
    if (this.state.cash >= this.profile.preferBigDealsAfter) {
      return "BIG";
    }
    return "SMALL";
  }

  evaluateDeal(card) {
    if (card.category === "RealEstate" || card.category === "Business" || card.category === "AutomatedBusiness") {
      const downPayment = card.downPayment || card.cost;
      const annualCashflow = (card.cashflow || 0) * 12;
      const roi = downPayment > 0 ? annualCashflow / downPayment : 0;

      // Si cumple el ROI mínimo
      if (roi >= this.profile.minROI) {
        // ¿Tiene suficiente efectivo?
        if (this.state.cash - downPayment >= this.profile.minCashReserve) {
          return { action: "BUY", neededLoan: 0 };
        }

        // Si su perfil permite apalancamiento bancario
        if (this.profile.allowBankLoan) {
          const deficit = downPayment - (this.state.cash - this.profile.minCashReserve);
          const loanNeeded = Math.ceil(deficit / 1000) * 1000;
          const monthlyInterest = loanNeeded * 0.10;
          // Solo si el flujo del activo supera el interés bancario
          if (card.cashflow > monthlyInterest) {
            return { action: "BUY_WITH_LOAN", neededLoan: loanNeeded };
          }
        }
      }
      return { action: "PASS" };
    }

    if (card.category === "Stock") {
      // Compra acciones si están en el tercio inferior de su rango
      if (card.price <= 10 && this.state.cash > this.profile.minCashReserve + 1000) {
        const investAmount = Math.min(3000, this.state.cash - this.profile.minCashReserve);
        const shares = Math.floor(investAmount / card.price);
        if (shares > 0) return { action: "BUY_STOCK", shares, price: card.price, symbol: card.symbol };
      }
      return { action: "PASS" };
    }

    if (card.category === "Land" || card.category === "PreciousMetal") {
      if (this.state.cash - card.cost >= this.profile.minCashReserve + 2000) {
        return { action: "BUY", neededLoan: 0 };
      }
      return { action: "PASS" };
    }

    return { action: "PASS" };
  }

  evaluateMarketSale(marketCard) {
    const decisions = [];

    if (marketCard.category === "RealEstateMarket") {
      // Vender propiedades compatibles si la ganancia de capital es atractiva
      this.state.assets.realEstate.forEach(prop => {
        if (prop.type === marketCard.targetType) {
          const totalOffer = marketCard.offerPricePerUnit * prop.units;
          const capitalGain = totalOffer - prop.mortgage - prop.downPayment;
          if (capitalGain > 15000 || this.profileKey === "risky" || this.profileKey === "smarter") {
            decisions.push({ type: "SELL_RE", propertyId: prop.id, offer: marketCard.offerPricePerUnit });
          }
        }
      });
    }

    if (marketCard.category === "StockMarket") {
      const stock = this.state.assets.stocks.find(s => s.symbol === marketCard.symbol);
      if (stock && marketCard.newPrice >= 30) {
        decisions.push({ type: "SELL_STOCK", symbol: stock.symbol, shares: stock.shares, price: marketCard.newPrice });
      }
    }

    return decisions;
  }

  evaluateDebtPayoff() {
    // Si tiene excedente de liquidez, liquida tarjetas de crédito o préstamos bancarios
    if (this.state.cash > this.profile.minCashReserve + 2000) {
      if (this.state.liabilities.creditCards > 0 && this.state.cash >= this.state.liabilities.creditCards + this.profile.minCashReserve) {
        return { type: "creditCards", amount: this.state.liabilities.creditCards };
      }
      if (this.state.liabilities.bankLoan > 0 && this.state.cash >= 1000 + this.profile.minCashReserve) {
        return { type: "bankLoan", amount: Math.min(this.state.liabilities.bankLoan, 2000) };
      }
    }
    return null;
  }
}
