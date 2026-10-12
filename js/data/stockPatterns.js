// Patrones de fluctuación técnica y catálogo de activos extraídos de stocks202.txt
export const STOCK_TICKERS = [
  { symbol: "OK4U", name: "OK4U Drug Co.", basePrice: 20, minPrice: 5, maxPrice: 40, dividend: 0 },
  { symbol: "MYT4U", name: "MYT4U Electronics", basePrice: 20, minPrice: 5, maxPrice: 40, dividend: 0 },
  { symbol: "ON2U", name: "ON2U Entertainment", basePrice: 20, minPrice: 10, maxPrice: 30, dividend: 0 },
  { symbol: "WINR", name: "WINR Software Co.", basePrice: 25, minPrice: 5, maxPrice: 50, dividend: 0 },
  { symbol: "GO4IT", name: "GO4IT Biotech", basePrice: 15, minPrice: 2, maxPrice: 35, dividend: 0 },
  { symbol: "DIV2U", name: "DIV2U Utilities", basePrice: 50, minPrice: 40, maxPrice: 65, dividend: 1 } // Produce dividendo mensual
];

export const TECHNICAL_PATTERNS = [
  {
    name: "Triángulo Simétrico Alcista",
    type: "multiplicative",
    noise: 0.05,
    multipliers: [1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 0.9, 0.9, 0.9, 0.9, 0.9, 1.1, 1.1, 1.1, 0.9, 0.9, 1.1, 1.1, 1.1, 1.1, 1.1]
  },
  {
    name: "Triángulo Simétrico Bajista",
    type: "multiplicative",
    noise: 0.05,
    multipliers: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1.1, 1.1, 1.1, 1.1, 1.1, 0.9, 0.9, 0.9, 1.1, 1.1, 0.9, 0.9, 0.9, 0.9, 0.9]
  },
  {
    name: "Rectángulo Lateral Alcista",
    type: "multiplicative",
    noise: 0.04,
    multipliers: [1.1, 1.1, 1.1, 1.1, 1.1, 0.9, 0.9, 0.9, 1.1, 1.1, 1.1, 0.9, 0.9, 0.9, 1.1, 1.1, 1.1, 0.9, 0.9, 0.9, 1.1, 1.1, 1.1, 1.1, 1.1]
  },
  {
    name: "Hombro-Cabeza-Hombro (Reversión Bajista)",
    type: "multiplicative",
    noise: 0.03,
    multipliers: [1.1, 1.1, 1.09, 1.07, 1.07, 0.94, 0.94, 0.97, 1.07, 1.07, 1.07, 1.1, 0.93, 0.93, 0.93, 0.93, 1.07, 1.07, 1.04, 0.93, 0.9, 0.85, 0.8, 0.75]
  },
  {
    name: "Taza con Asa (Cup & Handle - Fuerte Alcista)",
    type: "multiplicative",
    noise: 0.02,
    multipliers: [1.1, 1.1, 1.1, 1.0, 0.95, 0.95, 0.95, 0.95, 0.97, 1.0, 1.0, 1.03, 1.04, 1.05, 1.05, 1.04, 1.03, 1.0, 0.99, 1.01, 1.03, 1.05, 1.07, 1.15]
  },
  {
    name: "Riesgo de Quiebra (Bankruptcy Event)",
    type: "multiplicative",
    noise: 0.05,
    multipliers: [0.9, 0.9, 0.9, 0.9, 1.0, 1.1, 1.1, 0.85, 0.85, 0.85, 0.7, 1.0, 1.1, 1.1, 0.7, 0.6, 0.6, 1.1, 1.1, 0.4, 0.4, 0.3, 0.2]
  }
];
