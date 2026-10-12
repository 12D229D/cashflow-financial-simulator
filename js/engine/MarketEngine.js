import { STOCK_TICKERS, TECHNICAL_PATTERNS } from '../data/stockPatterns.js';

export class MarketEngine {
  constructor() {
    this.stocks = STOCK_TICKERS.map(s => ({
      ...s,
      currentPrice: s.basePrice,
      history: [s.basePrice],
      activePattern: null,
      patternIndex: 0
    }));

    this.optionsContracts = []; // { id, type: 'CALL'|'PUT', symbol, strike, contractSize, premiumPaid, turnsLeft }
    this.shortPositions = [];   // { id, symbol, shares, shortPrice }
    this.turn = 1;

    // Inicializar patrones aleatorios para cada acción
    this.stocks.forEach(stock => this.assignNewPattern(stock));
  }

  assignNewPattern(stock) {
    const randomPattern = TECHNICAL_PATTERNS[Math.floor(Math.random() * TECHNICAL_PATTERNS.length)];
    stock.activePattern = randomPattern;
    stock.patternIndex = 0;
  }

  nextTurn() {
    this.turn += 1;

    // Actualizar precios según el patrón técnico activo con ruido estocástico
    this.stocks.forEach(stock => {
      if (!stock.activePattern) {
        this.assignNewPattern(stock);
      }

      const mult = stock.activePattern.multipliers[stock.patternIndex];
      const noise = (Math.random() * 2 - 1) * stock.activePattern.noise;
      let newPrice = Math.round(stock.currentPrice * (mult + noise));

      // Limitar a los márgenes históricos de seguridad
      if (newPrice < stock.minPrice) newPrice = stock.minPrice;
      if (newPrice > stock.maxPrice) newPrice = stock.maxPrice;

      stock.currentPrice = newPrice;
      stock.history.push(newPrice);
      if (stock.history.length > 20) stock.history.shift();

      stock.patternIndex += 1;
      if (stock.patternIndex >= stock.activePattern.multipliers.length) {
        this.assignNewPattern(stock);
      }
    });

    // Actualizar caducidad de contratos de opciones (202)
    const expiredOptions = [];
    this.optionsContracts.forEach(opt => {
      opt.turnsLeft -= 1;
      if (opt.turnsLeft <= 0) {
        expiredOptions.push(opt);
      }
    });

    this.optionsContracts = this.optionsContracts.filter(opt => opt.turnsLeft > 0);
    return {
      stocks: this.stocks,
      expiredOptions
    };
  }

  getStock(symbol) {
    return this.stocks.find(s => s.symbol === symbol);
  }

  buyOption(playerState, type, symbol, strike, premium, contractSize = 100, durationTurns = 4) {
    const totalCost = premium * contractSize;
    if (playerState.cash < totalCost) {
      throw new Error(`Efectivo insuficiente ($${playerState.cash}) para pagar la prima total ($${totalCost}).`);
    }

    playerState.cash -= totalCost;
    const contract = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      symbol,
      strike,
      contractSize,
      premiumPaid: totalCost,
      durationTurns,
      turnsLeft: durationTurns
    };
    this.optionsContracts.push(contract);
    return contract;
  }

  exerciseOption(playerState, optionId) {
    const optIndex = this.optionsContracts.findIndex(o => o.id === optionId);
    if (optIndex === -1) throw new Error("Contrato de opción no encontrado o ya expirado.");

    const opt = this.optionsContracts[optIndex];
    const stock = this.getStock(opt.symbol);
    if (!stock) throw new Error("Acción subyacente no encontrada.");

    let payoff = 0;
    if (opt.type === "CALL") {
      // Ganancia de Call: (Precio Actual - Strike) * 100
      const diff = stock.currentPrice - opt.strike;
      if (diff <= 0) throw new Error("La opción CALL está fuera de dinero (Out of the Money). No conviene ejercerla.");
      payoff = diff * opt.contractSize;
    } else if (opt.type === "PUT") {
      // Ganancia de Put: (Strike - Precio Actual) * 100
      const diff = opt.strike - stock.currentPrice;
      if (diff <= 0) throw new Error("La opción PUT está fuera de dinero (Out of the Money).");
      payoff = diff * opt.contractSize;
    }

    playerState.cash += payoff;
    this.optionsContracts.splice(optIndex, 1);
    return { payoff, option: opt, stockPrice: stock.currentPrice };
  }

  openShort(playerState, symbol, shares) {
    const stock = this.getStock(symbol);
    if (!stock) throw new Error("Acción no válida.");
    const proceeds = shares * stock.currentPrice;
    playerState.cash += proceeds;

    const shortPos = {
      id: `short_${Date.now()}`,
      symbol,
      shares,
      shortPrice: stock.currentPrice
    };
    this.shortPositions.push(shortPos);
    return shortPos;
  }

  coverShort(playerState, shortId) {
    const index = this.shortPositions.findIndex(s => s.id === shortId);
    if (index === -1) throw new Error("Posición corta no encontrada.");

    const pos = this.shortPositions[index];
    const stock = this.getStock(pos.symbol);
    const buybackCost = pos.shares * stock.currentPrice;

    if (playerState.cash < buybackCost) {
      throw new Error(`No tienes suficiente efectivo ($${playerState.cash}) para recomprar las acciones prestadas ($${buybackCost}). ¡Short squeeze!`);
    }

    playerState.cash -= buybackCost;
    const profit = (pos.shortPrice - stock.currentPrice) * pos.shares;
    this.shortPositions.splice(index, 1);
    return { profit, buybackCost, position: pos };
  }
}
