// Motor de Contabilidad Financiera Inmutable y Determinista
export class FinancialEngine {
  static createInitialStatement(profession) {
    const p = { ...profession };
    const bankLoan = 0;
    const bankLoanPayment = 0;
    const childrenCount = 0;

    const assets = {
      realEstate: [], // { id, title, cost, downPayment, mortgage, cashflow, units }
      stocks: [],     // { symbol, shares, costBasis, dividend }
      businesses: [], // { id, title, cost, downPayment, liability, cashflow }
      metals: []      // { id, title, cost, units }
    };

    const liabilities = {
      mortgage: p.mortgage,
      schoolLoan: p.schoolLoan,
      carLoan: p.carLoan,
      creditCards: p.creditCards,
      retailDebt: p.retailDebt,
      bankLoan: bankLoan
    };

    const statement = {
      profession: p.title,
      icon: p.icon,
      cash: p.savings,
      salary: p.salary,
      taxes: p.taxes,
      mortgagePay: p.mortgagePay,
      schoolLoanPay: p.schoolLoanPay,
      carLoanPay: p.carLoanPay,
      creditCardsPay: p.creditCardsPay,
      retailDebtPay: p.retailDebtPay,
      otherExpenses: p.otherExpenses,
      perChildExpense: p.perChildExpense,
      childrenCount: childrenCount,
      liabilities: liabilities,
      assets: assets,
      inFastTrack: false,
      fastTrackCashflow: 0,
      selectedDream: null,
      charityTurns: 0,
      downsizedTurns: 0
    };

    return this.calculateTotals(statement);
  }

  static calculateTotals(state) {
    const s = { ...state };

    // 1. Ingresos pasivos
    const reCashflow = s.assets.realEstate.reduce((sum, item) => sum + (item.cashflow || 0), 0);
    const bizCashflow = s.assets.businesses.reduce((sum, item) => sum + (item.cashflow || 0), 0);
    const stockDividends = s.assets.stocks.reduce((sum, item) => sum + ((item.dividend || 0) * (item.shares || 0)), 0);
    
    s.passiveIncome = reCashflow + bizCashflow + stockDividends;
    s.totalIncome = s.salary + s.passiveIncome;

    // 2. Gastos
    const childExpenses = s.childrenCount * s.perChildExpense;
    const bankLoanPay = Math.round(s.liabilities.bankLoan * 0.10); // 10% mensual por préstamo bancario

    s.totalExpenses = 
      s.taxes + 
      s.mortgagePay + 
      s.schoolLoanPay + 
      s.carLoanPay + 
      s.creditCardsPay + 
      s.retailDebtPay + 
      s.otherExpenses + 
      childExpenses + 
      bankLoanPay;

    // 3. Flujo de Caja Mensual (Paycheck)
    s.monthlyCashflow = s.totalIncome - s.totalExpenses;

    // 4. Verificación de Condición de Salida de la Carrera de la Rata
    s.canExitRatRace = s.passiveIncome > s.totalExpenses;
    s.exitProgress = Math.min(100, Math.round((s.passiveIncome / (s.totalExpenses || 1)) * 100));

    return s;
  }

  static takeBankLoan(state, amount) {
    if (amount <= 0 || amount % 1000 !== 0) {
      throw new Error("Los préstamos bancarios deben ser en múltiplos de $1,000.");
    }
    const next = JSON.parse(JSON.stringify(state));
    next.cash += amount;
    next.liabilities.bankLoan += amount;
    return this.calculateTotals(next);
  }

  static payOffDebt(state, debtType, amount) {
    const next = JSON.parse(JSON.stringify(state));
    if (next.cash < amount) {
      throw new Error("Efectivo insuficiente para liquidar esta deuda.");
    }

    if (debtType === "creditCards") {
      if (amount >= next.liabilities.creditCards) {
        next.cash -= next.liabilities.creditCards;
        next.liabilities.creditCards = 0;
        next.creditCardsPay = 0;
      }
    } else if (debtType === "carLoan") {
      if (amount >= next.liabilities.carLoan) {
        next.cash -= next.liabilities.carLoan;
        next.liabilities.carLoan = 0;
        next.carLoanPay = 0;
      }
    } else if (debtType === "retailDebt") {
      if (amount >= next.liabilities.retailDebt) {
        next.cash -= next.liabilities.retailDebt;
        next.liabilities.retailDebt = 0;
        next.retailDebtPay = 0;
      }
    } else if (debtType === "schoolLoan") {
      if (amount >= next.liabilities.schoolLoan) {
        next.cash -= next.liabilities.schoolLoan;
        next.liabilities.schoolLoan = 0;
        next.schoolLoanPay = 0;
      }
    } else if (debtType === "mortgage") {
      if (amount >= next.liabilities.mortgage) {
        next.cash -= next.liabilities.mortgage;
        next.liabilities.mortgage = 0;
        next.mortgagePay = 0;
      }
    } else if (debtType === "bankLoan") {
      const pay = Math.min(amount, next.liabilities.bankLoan);
      next.cash -= pay;
      next.liabilities.bankLoan -= pay;
    }

    return this.calculateTotals(next);
  }

  static addRealEstate(state, property) {
    const next = JSON.parse(JSON.stringify(state));
    if (next.cash < property.downPayment) {
      throw new Error("No tienes suficiente efectivo para el anticipo (down payment).");
    }
    next.cash -= property.downPayment;
    next.assets.realEstate.push({
      id: property.id || `re_${Date.now()}`,
      title: property.title,
      cost: property.cost,
      downPayment: property.downPayment,
      mortgage: property.mortgage,
      cashflow: property.cashflow,
      units: property.units || 1,
      type: property.type || "residential"
    });
    return this.calculateTotals(next);
  }

  static sellRealEstate(state, propertyId, offerPerUnit) {
    const next = JSON.parse(JSON.stringify(state));
    const index = next.assets.realEstate.findIndex(r => r.id === propertyId);
    if (index === -1) return next;

    const prop = next.assets.realEstate[index];
    const totalSale = offerPerUnit * prop.units;
    const netProfit = totalSale - prop.mortgage;

    next.cash += netProfit;
    next.assets.realEstate.splice(index, 1);
    return this.calculateTotals(next);
  }

  static buyStocks(state, symbol, shares, price, dividend = 0) {
    const next = JSON.parse(JSON.stringify(state));
    const totalCost = shares * price;
    if (next.cash < totalCost) {
      throw new Error("Efectivo insuficiente para comprar las acciones.");
    }
    next.cash -= totalCost;
    const existing = next.assets.stocks.find(s => s.symbol === symbol);
    if (existing) {
      const totalShares = existing.shares + shares;
      existing.costBasis = Math.round(((existing.shares * existing.costBasis) + totalCost) / totalShares);
      existing.shares = totalShares;
      existing.dividend = dividend;
    } else {
      next.assets.stocks.push({ symbol, shares, costBasis: price, dividend });
    }
    return this.calculateTotals(next);
  }

  static sellStocks(state, symbol, shares, currentPrice) {
    const next = JSON.parse(JSON.stringify(state));
    const existing = next.assets.stocks.find(s => s.symbol === symbol);
    if (!existing || existing.shares < shares) {
      throw new Error("No posees suficientes acciones para vender.");
    }
    next.cash += shares * currentPrice;
    existing.shares -= shares;
    if (existing.shares <= 0) {
      next.assets.stocks = next.assets.stocks.filter(s => s.symbol !== symbol);
    }
    return this.calculateTotals(next);
  }

  static addChild(state) {
    const next = JSON.parse(JSON.stringify(state));
    if (next.childrenCount >= 3) return next; // Máximo 3 hijos según reglas oficiales
    next.childrenCount += 1;
    return this.calculateTotals(next);
  }

  static collectPaycheck(state) {
    const next = JSON.parse(JSON.stringify(state));
    next.cash += next.monthlyCashflow;
    return next;
  }

  static transitionToFastTrack(state) {
    const next = JSON.parse(JSON.stringify(state));
    if (!next.canExitRatRace) {
      throw new Error("Aún no tienes suficiente flujo pasivo para salir de la Carrera de la Rata.");
    }
    next.inFastTrack = true;
    // En la Vía Rápida se entra con un capital = Flujo Pasivo x 100
    next.cash = next.passiveIncome * 100;
    next.fastTrackCashflow = next.passiveIncome;
    return next;
  }
}
