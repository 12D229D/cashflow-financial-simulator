// Barajas avanzadas y derivados financieros extraídos de cards202.txt

export const CARDS_202 = {
  options: [
    {
      id: "opt_call_01",
      title: "Contrato de Opción CALL en OK4U",
      category: "Derivative",
      symbol: "OK4U",
      strikePrice: 20,
      premium: 2, // Prima por acción ($200 por contrato de 100)
      contractSize: 100,
      durationTurns: 4,
      type: "CALL",
      description: "Derecho a comprar 100 acciones de OK4U a $20 durante 4 turnos. Excelente si el gráfico técnico muestra patrón alcista."
    },
    {
      id: "opt_put_01",
      title: "Contrato de Opción PUT en WINR",
      category: "Derivative",
      symbol: "WINR",
      strikePrice: 30,
      premium: 3, // Prima por acción ($300 por contrato)
      contractSize: 100,
      durationTurns: 4,
      type: "PUT",
      description: "Derecho a vender 100 acciones de WINR a $30. Te protege o genera ganancias masivas si el mercado se derrumba."
    },
    {
      id: "opt_re_01",
      title: "Opción de Compra Inmobiliaria (Control sin Deuda)",
      category: "RealEstateOption",
      propertyTitle: "Complejo de 4 Unidades en Subasta",
      optionCost: 3000,
      lockInPrice: 95000,
      marketValue: 130000,
      durationTurns: 5,
      description: "Pagas una prima de opción de $3,000 para amarrar la propiedad a $95,000 durante 5 turnos. Puedes ceder el contrato a un inversor por $25,000 netos o adquirirla tú mismo."
    }
  ],
  advancedDeals: [
    {
      id: "adv_deal_01",
      title: "Negocio de Telefonía & Máquinas Expendedoras",
      category: "AutomatedBusiness",
      cost: 100000,
      downPayment: 20000,
      liability: 80000,
      cashflow: 1600,
      rule: "Flujo de caja del 96% anual sobre el anticipo."
    },
    {
      id: "adv_deal_02",
      title: "Socio Comanditario en Franquicia Gastronómica",
      category: "LimitedPartner",
      cost: 30000,
      downPayment: 30000,
      liability: 0,
      cashflow: 1500,
      rule: "Sin responsabilidad civil ni hipoteca. Retorno puro mensual."
    }
  ],
  macroEvents: [
    {
      id: "macro_crash",
      title: "¡Pánico en el Sector Tecnológico!",
      impact: "crash",
      affectedTickers: ["WINR", "MYT4U"],
      multiplier: 0.5,
      description: "Ventas masivas hunden las tecnológicas un 50%. Quienes tengan PUTs multiplican su capital; los largos sufren pérdidas no realizadas."
    },
    {
      id: "macro_short_squeeze",
      title: "¡Short Squeeze Histórico!",
      impact: "squeeze",
      affectedTickers: ["OK4U", "GO4IT"],
      multiplier: 2.2,
      description: "Fondos bajistas se ven forzados a recomprar acciones. Los precios se disparan un 120%."
    }
  ]
};
