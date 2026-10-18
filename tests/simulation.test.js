import { FinancialEngine } from '../js/engine/FinancialEngine.js';
import { MarketEngine } from '../js/engine/MarketEngine.js';
import { AIPlayer, AI_PROFILES } from '../js/engine/AIPlayer.js';
import { PROFESSIONS } from '../js/data/professions.js';
import { pad3, generaCodigoSala, generaSufijoPartida, generaCodigoPartida, esIdPartidaValido, salaDePartida, LETRAS_PARTIDA } from '../js/engine/SalasDB.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
  }
}

console.log("=================================================");
console.log("🧪 INICIANDO TEST SUITE: FLUJO MAESTRO — SIMULADOR DE LIBERTAD FINANCIERA");
console.log("=================================================\n");

// 1. Tests de FinancialEngine
console.log("🔹 1. Verificación de Contabilidad Financiera (FinancialEngine)");

const janitor = PROFESSIONS.find(p => p.title.includes("Conserje"));
let janitorState = FinancialEngine.createInitialStatement(janitor);

assert(janitorState.salary === 1600, "Salario inicial del Conserje es $1,600");
assert(janitorState.cash === 560, "Ahorros iniciales del Conserje son $560");
assert(janitorState.passiveIncome === 0, "Ingreso pasivo inicial es $0");
assert(janitorState.monthlyCashflow === (janitorState.totalIncome - janitorState.totalExpenses), "Cashflow mensual = Total Ingresos - Total Gastos");
assert(janitorState.canExitRatRace === false, "Inicialmente no puede salir de la Carrera de la Rata");

// Probar Préstamo Bancario al 10%
const beforeLoanExpenses = janitorState.totalExpenses;
janitorState = FinancialEngine.takeBankLoan(janitorState, 2000);
assert(janitorState.cash === 2560, "Efectivo aumenta a $2,560 tras préstamo de $2,000");
assert(janitorState.liabilities.bankLoan === 2000, "Pasivo bancario refleja $2,000");
assert(janitorState.totalExpenses === beforeLoanExpenses + 200, "Gastos mensuales aumentan $200 (10% mensual del préstamo)");

// Probar Compra Inmobiliaria con Apalancamiento
const condo = {
  id: "test_re_1",
  title: "Condominio 2BR/1BA",
  cost: 45000,
  downPayment: 2000,
  mortgage: 43000,
  cashflow: 250,
  units: 1,
  type: "residential"
};

janitorState = FinancialEngine.addRealEstate(janitorState, condo);
assert(janitorState.cash === 560, "Efectivo se reduce por el anticipo ($2,000)");
assert(janitorState.passiveIncome === 250, "Flujo de caja pasivo aumenta en $250/mes");
assert(janitorState.assets.realEstate.length === 1, "Activo inmobiliario registrado en el Balance");

// Probar Venta de Inmueble en el Mercado
janitorState = FinancialEngine.sellRealEstate(janitorState, "test_re_1", 70000);
// Venta $70,000 - Hipoteca $43,000 = $27,000 neto + $560 previo = $27,560
assert(janitorState.cash === 27560, "Venta genera ganancia de capital neta ($27,560 en mano)");
assert(janitorState.passiveIncome === 0, "Ingreso pasivo regresa a 0 tras liquidar el activo");

// Probar Condición de Escape de la Carrera de la Rata
const megaApartment = {
  id: "test_re_mega",
  title: "Complejo Multifamiliar",
  cost: 500000,
  downPayment: 20000,
  mortgage: 480000,
  cashflow: 5000,
  units: 24
};
janitorState = FinancialEngine.addRealEstate(janitorState, megaApartment);
assert(janitorState.passiveIncome > janitorState.totalExpenses, "Flujo pasivo ($5,000) > Gastos Totales");
assert(janitorState.canExitRatRace === true, "Se activa bandera de escape canExitRatRace");

// Probar Transición a la Vía Rápida
const ftState = FinancialEngine.transitionToFastTrack(janitorState);
assert(ftState.inFastTrack === true, "Jugador se encuentra en la Vía Rápida");
assert(ftState.cash === janitorState.passiveIncome * 100, "Capital de entrada a la Vía Rápida = Flujo Pasivo x 100 ($500,000)");

// 2. Tests de MarketEngine (Modo 202)
console.log("\n🔹 2. Verificación de Mercados Bursátiles y Opciones (MarketEngine 202)");

const market = new MarketEngine();
const ok4u = market.getStock("OK4U");
assert(ok4u !== undefined, "Acción OK4U encontrada en el catálogo");
assert(ok4u.currentPrice >= ok4u.minPrice && ok4u.currentPrice <= ok4u.maxPrice, "Precio dentro de los rangos de seguridad");

// Simular 3 turnos de mercado
market.nextTurn();
market.nextTurn();
market.nextTurn();
assert(ok4u.history.length === 4, "Historial de precios registra 4 puntos para graficación");

// Probar Opción CALL
const playerSim = { cash: 10000 };
const callContract = market.buyOption(playerSim, "CALL", "OK4U", 15, 2, 100, 4);
assert(playerSim.cash === 9800, "Prima de la opción debitada ($200 por 100 acciones)");
assert(market.optionsContracts.length === 1, "Contrato activo en el libro de opciones");

// Forzar precio para ejercicio
ok4u.currentPrice = 30;
const exerciseResult = market.exerciseOption(playerSim, callContract.id);
// Payoff = (30 - 15) * 100 = 1500
assert(exerciseResult.payoff === 1500, "Beneficio neto de la opción CALL calculado correctamente ($1,500)");
assert(playerSim.cash === 9800 + 1500, "Efectivo del jugador actualizado con el cobro");

// 3. Tests de AIPlayer
console.log("\n🔹 3. Verificación de Comportamiento Heurístico de IA");

const aiCautious = new AIPlayer("Warren Bot", "cautious", janitor);
const badDeal = { category: "RealEstate", downPayment: 5000, cashflow: 10, cost: 50000 }; // ROI = (120)/5000 = 2.4% < 20%
const decision1 = aiCautious.evaluateDeal(badDeal);
assert(decision1.action === "PASS", "IA Cauta rechaza acuerdos con ROI por debajo de su umbral (20%)");

// Con suficiente efectivo por encima de su reserva mínima de emergencia ($2,500)
aiCautious.state.cash = 4000;
const goodDeal = { category: "RealEstate", downPayment: 500, cashflow: 50, cost: 5000 }; // ROI = (600)/500 = 120%
const decision2 = aiCautious.evaluateDeal(goodDeal);
assert(decision2.action === "BUY", "IA Cauta aprueba acuerdos con alto ROI y reserva protegida");

// 4. Tests de Posiciones Cortas y Reacción de la IA al Mercado
console.log("\n🔹 4. Verificación de Posiciones Cortas (Shorts) y Ventas de Mercado IA");

// Abrir posición corta: se acredita el producto de la venta prestada
const shortSim = { cash: 5000 };
const winr = market.getStock("WINR");
const shortEntryPrice = winr.currentPrice;
const shortPos = market.openShort(shortSim, "WINR", 100);
assert(shortSim.cash === 5000 + (shortEntryPrice * 100), "Venta en corto acredita el producto de la venta prestada");
assert(market.shortPositions.length === 1, "Posición corta registrada en el libro de shorts");

// Cubrir el corto tras una caída del precio genera beneficio
winr.currentPrice = Math.max(winr.minPrice, Math.floor(shortEntryPrice * 0.5));
const coverResult = market.coverShort(shortSim, shortPos.id);
assert(coverResult.profit === (shortEntryPrice - winr.currentPrice) * 100, "Beneficio del corto = (precio apertura - precio actual) x acciones");
assert(market.shortPositions.length === 0, "Posición corta eliminada del libro al cubrirla");

// IA Audaz vende propiedad residencial ante oferta de mercado
const aiRisky = new AIPlayer("Jordan Bot", "risky", janitor);
aiRisky.state.cash = 20000;
aiRisky.state = FinancialEngine.addRealEstate(aiRisky.state, {
  id: "ai_test_re",
  title: "Casa 3/2",
  cost: 65000,
  downPayment: 15000,
  mortgage: 50000,
  cashflow: 200,
  units: 1,
  type: "residential"
});
const reMarketEvent = { category: "RealEstateMarket", targetType: "residential", offerPricePerUnit: 60000 };
const riskySales = aiRisky.evaluateMarketSale(reMarketEvent);
assert(riskySales.length === 1 && riskySales[0].type === "SELL_RE", "IA Audaz decide vender su propiedad ante la oferta del mercado");

// IA Cauta rechaza la misma oferta porque la ganancia de capital es negativa
aiCautious.state.cash = 20000;
aiCautious.state = FinancialEngine.addRealEstate(aiCautious.state, {
  id: "ai_cautious_re",
  title: "Casa 3/2",
  cost: 65000,
  downPayment: 15000,
  mortgage: 50000,
  cashflow: 200,
  units: 1,
  type: "residential"
});
const cautiousSales = aiCautious.evaluateMarketSale(reMarketEvent);
assert(cautiousSales.length === 0, "IA Cauta retiene su propiedad cuando la oferta no supera su umbral de ganancia");

// IA vende acciones en un rally bursátil (precio >= $30)
aiRisky.state = FinancialEngine.buyStocks(aiRisky.state, "OK4U", 100, 5, 0);
const stockRallyEvent = { category: "StockMarket", symbol: "OK4U", newPrice: 30 };
const stockSales = aiRisky.evaluateMarketSale(stockRallyEvent);
assert(stockSales.length === 1 && stockSales[0].type === "SELL_STOCK" && stockSales[0].shares === 100, "IA liquida sus acciones cuando el rally alcanza el precio objetivo ($30)");

// 5. Tests de la Base de Datos de Salas y Partidas (generación de códigos)
console.log("\n🔹 5. Generación y Validación de Códigos de Salas y Partidas (SalasDB)");

assert(pad3(7) === "007" && pad3(42) === "042" && pad3(123) === "123", "pad3 rellena los códigos de sala a exactamente 3 dígitos");
assert([...LETRAS_PARTIDA].every(l => /[A-Z]/.test(l) && l !== "I" && l !== "O") && LETRAS_PARTIDA.length === 24, "El alfabeto de partidas tiene 24 letras mayúsculas y excluye I y O (confundibles con 1 y 0)");

// Códigos de sala de 3 dígitos, aleatorios entre los libres y nunca ocupados
const salasGeneradas = new Set();
for (let i = 0; i < 60; i++) {
  salasGeneradas.add(generaCodigoSala(["001", "500", "999"]));
}
assert([...salasGeneradas].every(c => /^\d{3}$/.test(c) && c !== "000" && !["001", "500", "999"].includes(c)), "Los códigos de sala son de 3 dígitos (001–999), evitan los ocupados y nunca son '000'");
assert(salasGeneradas.size > 1, "La generación de salas elige aleatoriamente entre los códigos libres (variedad en 60 tiradas)");

let salasLlenasLanza = false;
try {
  const todasLasSalas = [];
  for (let i = 1; i <= 999; i++) todasLasSalas.push(pad3(i));
  generaCodigoSala(todasLasSalas);
} catch (e) {
  salasLlenasLanza = true;
}
assert(salasLlenasLanza, "Con las 999 salas ocupadas, la generación falla con un error controlado en lugar de duplicar códigos");

// Identificadores de partida "NNN-AAA": 3 dígitos de la sala + guion + 3 letras
assert(esIdPartidaValido("123-ABC") === true, "El validador acepta el formato canónico 'NNN-AAA' (123-ABC)");
assert(esIdPartidaValido("12-ABC") === false, "El validador rechaza códigos con menos de 3 dígitos (12-ABC)");
assert(esIdPartidaValido("1234-ABC") === false, "El validador rechaza códigos con más de 3 dígitos (1234-ABC)");
assert(esIdPartidaValido("123-abc") === false, "El validador rechaza sufijos en minúsculas (123-abc)");
assert(esIdPartidaValido("123_ABX") === false, "El validador rechaza separadores distintos al guion medio (123_ABX)");
assert(salaDePartida("042-KLM") === "042", "salaDePartida extrae los 3 dígitos de la sala desde un identificador de partida");
assert(salaDePartida("42-KLM") === null, "salaDePartida devuelve null ante identificadores malformados");

// El código de partida hereda el código de su sala y evita sufijos ocupados
const idNuevo = generaCodigoPartida("042", ["AAA", "BBB"]);
assert(esIdPartidaValido(idNuevo) && idNuevo.startsWith("042-"), "El código de partida combina los 3 dígitos de su sala, un guion y 3 letras mayúsculas");
assert(idNuevo.slice(4) !== "AAA" && idNuevo.slice(4) !== "BBB", "La generación de partidas evita los sufijos ya ocupados dentro de la sala");
assert(generaSufijoPartida([], () => 0) === "AAA", "La generación de sufijos es determinista con un generador aleatorio inyectado (rand=0 → AAA)");

// Unicidad sostenida: 200 partidas consecutivas en la misma sala sin colisiones
const enSala042 = new Set(["042-AAA", "042-BBB", "042-ZZZ"]);
let todosUnicos = true;
let todosValidos = true;
for (let i = 0; i < 200; i++) {
  const id = generaCodigoPartida("042", [...enSala042].map(x => x.slice(4)));
  if (enSala042.has(id)) todosUnicos = false;
  if (!esIdPartidaValido(id) || !id.startsWith("042-")) todosValidos = false;
  enSala042.add(id);
}
assert(todosUnicos && todosValidos, "200 códigos de partida consecutivos: todos únicos, válidos y sin colisiones dentro de la sala");

let sufijosAgotadosLanza = false;
try {
  const alfabeto = LETRAS_PARTIDA;
  const todosLosSufijos = [];
  for (const a of alfabeto) for (const b of alfabeto) for (const c of alfabeto) todosLosSufijos.push(a + b + c);
  generaSufijoPartida(todosLosSufijos);
} catch (e) {
  sufijosAgotadosLanza = true;
}
assert(sufijosAgotadosLanza, "Con los 13.824 sufijos de una sala agotados, la generación falla con un error controlado");

console.log("\n=================================================");
console.log(`📊 RESULTADO FINAL: ${passed} pasados, ${failed} fallidos.`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
}
