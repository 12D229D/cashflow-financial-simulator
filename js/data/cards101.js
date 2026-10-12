// Barajas de cartas del modo Esencial (Fundamental)

export const SMALL_DEALS = [
  {
    id: "sd_01",
    title: "Condominio 2 Hab / 1 Baño",
    category: "RealEstate",
    description: "Un anciano se muda a una residencia y vende con urgencia por debajo del mercado.",
    cost: 45000,
    downPayment: 4000,
    mortgage: 41000,
    cashflow: 220,
    type: "residential",
    units: 1,
    rule: "Rentable de bajo mantenimiento. Gran flujo para principiantes."
  },
  {
    id: "sd_02",
    title: "Casa 3 Hab / 2 Baños en Remate",
    category: "RealEstate",
    description: "Embargo bancario en excelente vecindario. Requiere pintura ligera.",
    cost: 55000,
    downPayment: 5000,
    mortgage: 50000,
    cashflow: 300,
    type: "residential",
    units: 1,
    rule: "Propiedad clásica para construir patrimonio y apalancamiento."
  },
  {
    id: "sd_03",
    title: "Terreno de 10 Acres en Expansión",
    category: "Land",
    description: "Zona agrícola cerca de una futura autopista planificada.",
    cost: 5000,
    downPayment: 5000,
    mortgage: 0,
    cashflow: 0,
    type: "land",
    units: 0,
    rule: "Sin flujo mensual. Potencial de plusvalía del 400% si el mercado compra."
  },
  {
    id: "sd_04",
    title: "Acciones OK4U a Precio de Ganga",
    category: "Stock",
    description: "La farmacéutica OK4U sufre litigio menor. Precio cae a $10 (rango $5-$40).",
    symbol: "OK4U",
    price: 10,
    dividend: 0,
    rule: "Puedes comprar tantas acciones como tu liquidez permita."
  },
  {
    id: "sd_05",
    title: "Acciones MYT4U en Corrección",
    category: "Stock",
    description: "MYT4U Electronics cotiza a solo $5 por acción tras resultados trimestrales.",
    symbol: "MYT4U",
    price: 5,
    dividend: 0,
    rule: "Rango histórico $5-$40. Excelente para venta masiva cuando rebote."
  },
  {
    id: "sd_06",
    title: "Certificado de Depósito de Alto Rendimiento",
    category: "PaperAsset",
    description: "Inversión en pagaré garantizado de empresa local.",
    cost: 2000,
    downPayment: 2000,
    mortgage: 0,
    cashflow: 60,
    type: "fixed_income",
    rule: "Genera 36% de ROI anualizado."
  },
  {
    id: "sd_07",
    title: "Monedas de Oro Krugerrand",
    category: "PreciousMetal",
    description: "Lote de 10 monedas de oro compradas en subasta judicial.",
    cost: 3000,
    downPayment: 3000,
    mortgage: 0,
    cashflow: 0,
    type: "metal",
    rule: "Reserva de valor. Puede duplicarse o triplicarse en El Mercado."
  }
];

export const BIG_DEALS = [
  {
    id: "bd_01",
    title: "Edificio de 4 Unidades (4-Plex)",
    category: "RealEstate",
    description: "Excelente propiedad multifamiliar totalmente alquilada cerca a universidad.",
    cost: 120000,
    downPayment: 20000,
    mortgage: 100000,
    cashflow: 1200,
    type: "multifamily",
    units: 4,
    rule: "Flujo sólido y alta demanda por compradores institucionales."
  },
  {
    id: "bd_02",
    title: "Edificio de 8 Unidades (8-Plex)",
    category: "RealEstate",
    description: "Propietario retirado busca liquidar activos rápidamente.",
    cost: 240000,
    downPayment: 40000,
    mortgage: 200000,
    cashflow: 2200,
    type: "multifamily",
    units: 8,
    rule: "El trampolín definitivo para superar los gastos y salir de la rata."
  },
  {
    id: "bd_03",
    title: "Complejo Residencial de 24 Apartamentos",
    category: "RealEstate",
    description: "Gran edificio residencial con administración tercerizada.",
    cost: 650000,
    downPayment: 100000,
    mortgage: 550000,
    cashflow: 5500,
    type: "apartments",
    units: 24,
    rule: "Requiere sólida posición financiera o sindicación de capital."
  },
  {
    id: "bd_04",
    title: "Lavado de Autos Automatizado (Car Wash)",
    category: "Business",
    description: "Negocio automático con flujo de caja continuo y mínimo personal.",
    cost: 150000,
    downPayment: 30000,
    mortgage: 120000,
    cashflow: 2400,
    type: "business",
    rule: "Excelente activo con depreciación acelerada."
  },
  {
    id: "bd_05",
    title: "Lavandería Monedero (Laundromat)",
    category: "Business",
    description: "Cadena de máquinas lavadoras y secadoras de alto volumen en centro urbano.",
    cost: 110000,
    downPayment: 25000,
    mortgage: 85000,
    cashflow: 1800,
    type: "business",
    rule: "Negocio a prueba de recesión con clientes recurrentes."
  },
  {
    id: "bd_06",
    title: "Franquicia de Pizzería Exitosa",
    category: "Business",
    description: "Socio capitalista busca inversor pasivo para nueva sucursal.",
    cost: 200000,
    downPayment: 50000,
    mortgage: 150000,
    cashflow: 3500,
    type: "business",
    rule: "Flujo pasivo neto asegurado bajo contrato de franquicia."
  }
];

export const MARKET_CARDS = [
  {
    id: "mkt_01",
    title: "¡Comprador para Casas y Condominios!",
    category: "RealEstateMarket",
    description: "Un fondo inmobiliario busca viviendas residenciales individuales y ofrece $85,000 por unidad.",
    targetType: "residential",
    offerPricePerUnit: 85000,
    rule: "Todos los jugadores pueden vender sus casas/condominios por $85,000 c/u, cancelando la hipoteca restante y quedándose la plusvalía."
  },
  {
    id: "mkt_02",
    title: "¡Inversionista Institucional Busca 4-Plex y 8-Plex!",
    category: "RealEstateMarket",
    description: "Consorcio compra multifamiliares pagando $40,000 por cada puerta/unidad.",
    targetType: "multifamily",
    offerPricePerUnit: 40000,
    rule: "Vende tu 4-plex por $160,000 o tu 8-plex por $320,000. Liquida la deuda y cobra el excedente."
  },
  {
    id: "mkt_03",
    title: "Reclasificación Urbana: Terrenos Multiplican su Valor",
    category: "LandMarket",
    description: "La ciudad aprueba construcción de centro comercial en terrenos agrícolas.",
    targetType: "land",
    offerPriceFixed: 30000,
    rule: "Cualquier terreno de 10 acres comprado a $5,000 puede venderse hoy por $30,000 netos."
  },
  {
    id: "mkt_04",
    title: "¡Rally Alcista en OK4U!",
    category: "StockMarket",
    description: "Aprobación de patente médica dispara las acciones de OK4U a $40.",
    symbol: "OK4U",
    newPrice: 40,
    rule: "Todos los tenedores de OK4U pueden vender la cantidad de acciones que deseen a $40."
  },
  {
    id: "mkt_05",
    title: "¡Split de Acciones 2x1 en MYT4U!",
    category: "StockSplit",
    description: "MYT4U Electronics duplica las acciones de todos los inversionistas.",
    symbol: "MYT4U",
    ratio: 2,
    rule: "Si tienes 500 acciones, ahora tienes 1,000 acciones. El precio base se divide a la mitad."
  },
  {
    id: "mkt_06",
    title: "¡Demanda Fuerte por Oro y Metales!",
    category: "MetalMarket",
    description: "Tensiones macroeconómicas disparan el valor de los metales preciosos.",
    targetType: "metal",
    offerPriceMultiplier: 2.5,
    rule: "Vende tus monedas de oro por 2.5 veces el precio de compra."
  }
];

export const DOODADS = [
  {
    id: "doo_01",
    title: "Cena de Gala y Restaurante de Lujo",
    cost: 350,
    description: "Invitas a toda la mesa a una noche inolvidable de champaña y alta cocina."
  },
  {
    id: "doo_02",
    title: "Televisor OLED 4K Gigante",
    cost: 1500,
    description: "Oferta imperdible en fin de semana de rebajas... cargado a la tarjeta de crédito."
  },
  {
    id: "doo_03",
    title: "Reparación Mecánica Inesperada del Auto",
    cost: 800,
    description: "La transmisión automática falla justo camino al trabajo."
  },
  {
    id: "doo_04",
    title: "Vacaciones Familiares al Caribe",
    cost: 2400,
    description: "Un crucero de una semana que la familia no podía dejar pasar."
  },
  {
    id: "doo_05",
    title: "Colección Nueva de Palos de Golf",
    cost: 1200,
    description: "Equipamiento profesional para mejorar el swing los fines de semana."
  },
  {
    id: "doo_06",
    title: "Compras Compulsivas en el Centro Comercial",
    cost: 450,
    description: "Zapatos, accesorios y ropa que se usarán un par de veces."
  }
];

export const FAST_TRACK_DREAMS = [
  { id: "dream_1", title: "Fundación de Investigación contra el Cáncer", cost: 250000, icon: "🎗️" },
  { id: "dream_2", title: "Yate de Lujo de 100 Pies con Tripulación", cost: 350000, icon: "🛥️" },
  { id: "dream_3", title: "Reserva Natural y Safari Privado en África", cost: 400000, icon: "🦁" },
  { id: "dream_4", title: "Vuelo Espacial Comercial & Turismo Orbital", cost: 300000, icon: "🚀" },
  { id: "dream_5", title: "Colección Privada de Superdeportivos Clásicos", cost: 200000, icon: "🏎️" },
  { id: "dream_6", title: "Isla Tropical Privada con Helipuerto", cost: 500000, icon: "🏝️" }
];
