import { PROFESSIONS } from './data/professions.js';
import { FinancialEngine } from './engine/FinancialEngine.js';
import { Board } from './engine/Board.js';
import { CardDeck } from './engine/CardDeck.js';
import { MarketEngine } from './engine/MarketEngine.js';
import { AIPlayer, AI_PROFILES } from './engine/AIPlayer.js';
import { StorageEngine } from './engine/StorageEngine.js';
import { SalasDB } from './engine/SalasDB.js';
import { NubeSalasDB } from './engine/NubeSalasDB.js';
import { resolverApiBase } from './config.js';

// Paleta de colores de fichas para los asientos de la mesa (humanos o IA)
const PLAYER_COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#fb7185"];
const MAX_PLAYERS = 6;

class CashflowApp {
  constructor() {
    this.canvas = document.getElementById("boardCanvas");
    this.board = new Board(this.canvas);
    this.market = new MarketEngine();
    this.mode202 = false;
    this.cardDeck = new CardDeck(this.mode202);

    // Base de datos local de salas y partidas (IndexedDB) y seguimiento de la
    // partida registrada asociada a la sesión en curso (null = sin guardar aún)
    // Si hay API Worker configurada (js/config.js) y responde, `this.db` pasa a
    // NubeSalasDB (Cloudflare D1); si no, se queda en la base local.
    this.dbLocal = new SalasDB();
    this.dbNube = null;
    this.db = this.dbLocal;
    this.currentSalaCodigo = null;
    this.currentPartidaId = null;

    this.players = [];
    this.activePlayerIndex = 0;
    this.turn = 1;
    this.currentPendingCard = null;

    this.initDOM();
    this.initWelcomeScreen();
    this.initSalasModal();

    // Importa una sola vez la partida del sistema legado de localStorage a la
    // base de datos de salas (si existe); el resultado se consulta al abrir el
    // panel de salas, no bloquea el arranque
    this.dbLocal.migrarGuardadoLegado();
    this.iniciarAlmacen();

    // Vista previa: la mesa por defecto se dibuja tras el cristal de la
    // pantalla de bienvenida; la sesión real de juego arranca al confirmar
    // la configuración (🚀 Iniciar Partida / 🎲 Mesa Rápida)
    this.setupPlayers(this.buildDefaultRoster());
    this.refreshUI();
    document.getElementById("btnRollDice").disabled = true;
    document.getElementById("turnLabel").textContent = "🎉 ¡Bienvenido! Configura tu partida para comenzar";
  }

  get activePlayer() {
    return this.players[this.activePlayerIndex];
  }

  get isHumanTurn() {
    return !this.activePlayer.isAI;
  }

  initDOM() {
    // Botones de Cabecera
    document.getElementById("btnNewGame").addEventListener("click", () => this.showWelcomeScreen());
    document.getElementById("btnSaveGame").addEventListener("click", () => this.saveCurrentGame());
    document.getElementById("btnLoadGame").addEventListener("click", () => this.loadSavedGame());
    document.getElementById("btnToggleMode").addEventListener("click", () => this.toggle202Mode());

    // Botones del Tablero
    document.getElementById("btnRollDice").addEventListener("click", () => this.handleHumanRollDice());
    document.getElementById("btnCharity").addEventListener("click", () => this.handleHumanCharity());
    document.getElementById("btnExitRatRace").addEventListener("click", () => this.handleHumanExitRatRace());

    // Banco y Deudas
    document.getElementById("btnTakeLoan").addEventListener("click", () => this.handleTakeBankLoan());

    // Modal de Cartas
    document.getElementById("btnModalBuy").addEventListener("click", () => this.handleModalBuy());
    document.getElementById("btnModalPass").addEventListener("click", () => this.handleModalPass());
    document.getElementById("inputStockShares").addEventListener("input", (e) => this.updateStockCostPreview(e.target.value));
    document.getElementById("btnStockMax").addEventListener("click", () => this.setStockSharesMax());

    // Tabs del Balance Sheet
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        const targetId = btn.getAttribute("data-tab");
        document.getElementById(targetId)?.classList.add("active");
      });
    });

    document.getElementById("btnClearLog").addEventListener("click", () => {
      document.getElementById("gameLog").innerHTML = "";
    });

    // Resize del Canvas
    window.addEventListener("resize", () => {
      this.resizeCanvas();
      this.board.render(this.players, this.activePlayerIndex);
    });
    this.resizeCanvas();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const size = Math.min(rect.width, 600);
    this.canvas.width = size;
    this.canvas.height = size;
  }

  initWelcomeScreen() {
    document.getElementById("btnWelcomeAddPlayer").addEventListener("click", () => this.addSetupPlayerSlot());

    document.getElementById("btnWelcomeStart").addEventListener("click", () => {
      const modeRadio = document.querySelector('input[name="welcomeMode"]:checked');
      this.startConfiguredGame(this.collectSetupRoster(), modeRadio ? modeRadio.value === "202" : false);
    });

    document.getElementById("btnWelcomeQuickStart").addEventListener("click", () => {
      const modeRadio = document.querySelector('input[name="welcomeMode"]:checked');
      this.startConfiguredGame(this.buildDefaultRoster(), modeRadio ? modeRadio.value === "202" : false);
    });

    // Solo visible al reabrir la pantalla en caliente (🎮 Nueva Partida):
    // permite volver a la partida en curso sin reiniciar nada. No se agenda
    // ningún temporizador aquí — si un bot estaba pensando, su hilo continúa.
    document.getElementById("btnWelcomeCancel").addEventListener("click", () => {
      document.getElementById("welcomeScreen").classList.add("hidden");
      document.getElementById("btnWelcomeCancel").classList.add("hidden");
      const active = this.activePlayer;
      if (!active) return;
      document.getElementById("btnRollDice").disabled = active.isAI;
      document.getElementById("turnLabel").textContent = active.isAI
        ? `Turno ${this.turn}: Pensando ${active.name}...`
        : `Turno ${this.turn}: Tu Turno (${active.name})`;
    });

    // Mesa inicial sugerida en la pantalla de bienvenida: 1 humano + 2 bots clásicos
    this.buildDefaultRoster().forEach(cfg => this.addSetupPlayerSlot(cfg));

    // Entrada desde la bienvenida: retomar una partida guardada en la base de
    // datos local de salas sin pasar por la configuración de mesa
    document.getElementById("btnWelcomeLoad").addEventListener("click", () => this.loadSavedGame());
  }

  // Arranca la sesión de juego a partir de la configuración elegida en la
  // pantalla de bienvenida (roster de asientos + reglamento seleccionado)
  startConfiguredGame(roster, mode202) {
    this.mode202 = mode202;
    this.cardDeck = new CardDeck(this.mode202);

    // Sesión nueva: se desasocia de cualquier partida registrada en la base
    // de datos (el próximo 💾 Guardar ofrecerá elegir o crear sala otra vez)
    this.currentSalaCodigo = null;
    this.currentPartidaId = null;

    this.setupPlayers(roster);
    document.getElementById("welcomeScreen").classList.add("hidden");
    document.getElementById("btnWelcomeCancel").classList.add("hidden");
    this.updateModePill();
    this.refreshUI();
    this.kickOffTurn();
    const humans = this.players.filter(p => !p.isAI).length;
    const bots = this.players.length - humans;
    this.log(`Partida iniciada en Modo ${this.mode202 ? 'Avanzado (Opciones & Patrones)' : 'Esencial (Fundamental)'}: ${humans} humano(s) y ${bots} IA en la mesa.`, "log-info");
  }

  // Mesa rápida por defecto (plantilla de la pantalla de bienvenida y del botón Mesa Rápida)
  buildDefaultRoster() {
    const humanProf = PROFESSIONS.find(p => p.title.includes("Webmaster")) || PROFESSIONS[0];
    return [
      { name: "Tú (Inversor)", isAI: false, profId: humanProf.id },
      { name: "Warren (Cauta)", isAI: true, profId: PROFESSIONS[(humanProf.id + 2) % PROFESSIONS.length].id, aiProfile: "cautious" },
      { name: "Jordan (Audaz)", isAI: true, profId: PROFESSIONS[(humanProf.id + 5) % PROFESSIONS.length].id, aiProfile: "risky" }
    ];
  }

  addSetupPlayerSlot(config = {}) {
    const container = document.getElementById("welcomePlayerSlots");
    if (container.children.length >= MAX_PLAYERS) return;

    const idx = container.children.length;
    const defaults = {
      name: `Jugador ${idx + 1}`,
      isAI: false,
      profId: PROFESSIONS[idx % PROFESSIONS.length].id,
      aiProfile: "default"
    };
    const cfg = { ...defaults, ...config };

    const row = document.createElement("div");
    row.className = "player-slot";
    row.innerHTML = `
      <span class="slot-color" style="background: ${PLAYER_COLORS[idx % PLAYER_COLORS.length]}"></span>
      <input type="text" class="slot-name input-control" value="${cfg.name}" maxlength="24" aria-label="Nombre del jugador">
      <select class="slot-type input-control" aria-label="Tipo de jugador">
        <option value="human" ${cfg.isAI ? "" : "selected"}>👤 Humano</option>
        <option value="ai" ${cfg.isAI ? "selected" : ""}>🤖 IA</option>
      </select>
      <select class="slot-profession input-control" aria-label="Profesión del jugador"></select>
      <select class="slot-ai-profile input-control ${cfg.isAI ? "" : "hidden"}" aria-label="Perfil de IA"></select>
      <button type="button" class="slot-remove" title="Quitar participante">✕</button>
    `;

    const profSelect = row.querySelector(".slot-profession");
    profSelect.innerHTML = PROFESSIONS.map(p =>
      `<option value="${p.id}" ${p.id === cfg.profId ? "selected" : ""}>${p.icon} ${p.title}</option>`
    ).join("");

    // Los perfiles provienen directamente de AI_PROFILES (única fuente de verdad)
    const profileSelect = row.querySelector(".slot-ai-profile");
    profileSelect.innerHTML = Object.entries(AI_PROFILES).map(([key, prof]) =>
      `<option value="${key}" ${key === cfg.aiProfile ? "selected" : ""}>${prof.name}</option>`
    ).join("");

    // El selector de perfil solo aplica a asientos de IA
    const typeSelect = row.querySelector(".slot-type");
    typeSelect.addEventListener("change", () => {
      profileSelect.classList.toggle("hidden", typeSelect.value !== "ai");
    });

    row.querySelector(".slot-remove").addEventListener("click", () => {
      if (container.children.length <= 1) return; // la mesa requiere al menos 1 participante
      row.remove();
      this.refreshSlotColors();
    });

    container.appendChild(row);
  }

  refreshSlotColors() {
    [...document.querySelectorAll("#welcomePlayerSlots .player-slot")].forEach((slot, i) => {
      slot.querySelector(".slot-color").style.background = PLAYER_COLORS[i % PLAYER_COLORS.length];
    });
  }

  collectSetupRoster() {
    return [...document.querySelectorAll("#welcomePlayerSlots .player-slot")].map((slot, i) => ({
      name: slot.querySelector(".slot-name").value.trim() || `Jugador ${i + 1}`,
      isAI: slot.querySelector(".slot-type").value === "ai",
      profId: parseInt(slot.querySelector(".slot-profession").value),
      aiProfile: slot.querySelector(".slot-ai-profile").value
    }));
  }

  showWelcomeScreen() {
    // Reapertura en caliente (🎮 Nueva Partida): la última configuración de la
    // mesa queda como plantilla editable y el botón ↩️ permite retomar la
    // partida en curso sin tocar nada
    if (document.getElementById("welcomePlayerSlots").children.length === 0) {
      this.buildDefaultRoster().forEach(cfg => this.addSetupPlayerSlot(cfg));
    }
    document.getElementById("btnWelcomeCancel").classList.remove("hidden");
    document.getElementById("welcomeScreen").classList.remove("hidden");
  }

  setupPlayers(roster) {
    // Roster multijugador: cada entrada define nombre, tipo (humano/IA), profesión
    // y —para los asientos de IA— el perfil heurístico que guiará sus decisiones.
    this.players = roster.map((entry, i) => {
      const prof = PROFESSIONS.find(p => p.id === entry.profId) || PROFESSIONS[i % PROFESSIONS.length];

      if (entry.isAI) {
        const ai = new AIPlayer(entry.name, entry.aiProfile, prof);
        ai.id = `p${i + 1}`;
        ai.color = PLAYER_COLORS[i % PLAYER_COLORS.length];
        return ai;
      }

      return {
        id: `p${i + 1}`,
        name: entry.name,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        isAI: false,
        position: 0,
        state: FinancialEngine.createInitialStatement(prof)
      };
    });

    this.activePlayerIndex = 0;
    this.turn = 1;
    // Generación de partida: invalida los temporizadores de IA pendientes de la
    // partida anterior (p. ej. si se reinicia mientras un bot "está pensando")
    this._gameGeneration = (this._gameGeneration || 0) + 1;
  }

  toggle202Mode() {
    this.mode202 = !this.mode202;
    this.cardDeck = new CardDeck(this.mode202);
    this.updateModePill();
    this.refreshUI();
    this.log(`Modo de juego cambiado a: ${this.mode202 ? 'Avanzado (Opciones & Patrones)' : 'Esencial (Fundamental)'}`, "log-warning");
  }

  updateModePill() {
    const pill = document.getElementById("modePill");
    const btn = document.getElementById("btnToggleMode");
    const tab202 = document.getElementById("tabMarketBtn");

    if (this.mode202) {
      pill.textContent = "Modo: Avanzado (Opciones & Patrones)";
      pill.style.borderColor = "var(--color-purple)";
      pill.style.color = "var(--color-purple)";
      btn.textContent = "Cambiar a Modo Esencial";
      tab202.classList.remove("hidden");
    } else {
      pill.textContent = "Modo: Esencial (Fundamental)";
      pill.style.borderColor = "var(--color-sky)";
      pill.style.color = "var(--color-sky)";
      btn.textContent = "⚡ Activar Modo Avanzado";
      tab202.classList.add("hidden");
    }
  }

  handleHumanRollDice() {
    if (!this.isHumanTurn) return;
    const player = this.activePlayer;
    if (player.state.downsizedTurns > 0) {
      player.state.downsizedTurns -= 1;
      this.log(`${player.name} está despedido. Turnos restantes de espera: ${player.state.downsizedTurns}`, "log-warning");
      this.endTurn();
      return;
    }

    const hasCharity = player.state.charityTurns > 0;
    if (hasCharity) player.state.charityTurns -= 1;

    const { rolls, total } = this.board.rollDice(hasCharity);
    this.animateDice(rolls, total);

    const moveResult = this.board.movePlayer(player.position, total, player.state.inFastTrack);
    player.position = moveResult.newPosition;

    this.board.render(this.players, this.activePlayerIndex);

    // Si pasó por Día de Cobro
    if (moveResult.passedPaycheck) {
      player.state = FinancialEngine.collectPaycheck(player.state);
      this.log(`💰 ¡Día de Cobro! Recibiste tu nómina mensual: +$${player.state.monthlyCashflow.toLocaleString()}. Efectivo: $${player.state.cash.toLocaleString()}`, "log-success");
      this.refreshUI();
    }

    // Gestionar casilla de aterrizaje
    this.processLandSpace(player, moveResult.space);
  }

  animateDice(rolls, total) {
    const d1 = document.getElementById("die1");
    const d2 = document.getElementById("die2");
    const txt = document.getElementById("diceTotal");

    // Sacudida animada de los dados durante el lanzamiento
    const display = document.getElementById("diceDisplay");
    display.classList.remove("rolling");
    void display.offsetWidth;
    display.classList.add("rolling");
    setTimeout(() => display.classList.remove("rolling"), 600);

    const diceIcons = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    d1.textContent = diceIcons[rolls[0]] || "🎲";
    if (rolls.length > 1) {
      d2.classList.remove("hidden");
      d2.textContent = diceIcons[rolls[1]] || "🎲";
    } else {
      d2.classList.add("hidden");
    }
    txt.textContent = `Sacaste ${total}`;
  }

  processLandSpace(player, space) {
    this.log(`${player.name} cayó en: ${space.icon} ${space.label}`, "log-info");

    switch (space.type) {
      case "OPPORTUNITY":
        if (player.isAI) {
          this.handleAIOpportunity(player);
        } else {
          this.promptHumanOpportunityChoice();
        }
        break;

      case "MARKET": {
        const mktCard = this.cardDeck.drawMarket();
        this.log(`📈 MERCADO: ${mktCard.title} — ${mktCard.description}`, "log-info");
        if (player.isAI) {
          this.handleAIMarketEvent(player, mktCard);
        } else {
          this.handleMarketEvent(mktCard);
        }
        break;
      }

      case "DOODAD":
        const doodad = this.cardDeck.drawDoodad();
        player.state.cash -= doodad.cost;
        this.log(`🛍️ CAPRICHO: ${doodad.title} (-$${doodad.cost}). Efectivo: $${player.state.cash.toLocaleString()}`, "log-danger");
        this.refreshUI();
        if (!player.isAI) this.checkBankruptcyOrDebt(player);
        this.endTurn();
        break;

      case "CHARITY":
        if (!player.isAI) {
          this.log(`🤝 Casilla de Caridad. Puedes donar el 10% de tus ingresos para lanzar 2 dados los próximos 3 turnos.`, "log-info");
        }
        this.endTurn();
        break;

      case "DOWNSIZED":
        const totalExp = player.state.totalExpenses;
        player.state.cash -= totalExp;
        player.state.downsizedTurns = 2;
        this.log(`📉 ¡DESPEDIDO! Pagas tus gastos totales ($${totalExp.toLocaleString()}) y pierdes 2 turnos.`, "log-danger");
        this.refreshUI();
        if (!player.isAI) this.checkBankruptcyOrDebt(player);
        this.endTurn();
        break;

      case "BABY":
        if (player.state.childrenCount < 3) {
          player.state = FinancialEngine.addChild(player.state);
          this.log(`👶 ¡Felicidades, nació un nuevo bebé! Gastos fijos aumentan en +$${player.state.perChildExpense}/mes.`, "log-warning");
          this.refreshUI();
        } else {
          this.log(`👶 Ya tienes el máximo de 3 hijos. No hay incremento adicional.`, "log-info");
        }
        this.endTurn();
        break;

      case "PAYCHECK":
        // Si cayó exactamente en Paycheck
        this.endTurn();
        break;

      case "CASH_FLOW_DAY":
        player.state.cash += player.state.fastTrackCashflow;
        this.log(`💰 ¡Día de Flujo en Vía Rápida! Recibes +$${player.state.fastTrackCashflow.toLocaleString()}.`, "log-success");
        this.refreshUI();
        this.endTurn();
        break;

      case "FT_BUSINESS":
        if (player.state.cash >= space.cost) {
          player.state.cash -= space.cost;
          player.state.fastTrackCashflow += space.cashflow;
          this.log(`🏢 ¡Adquiriste ${space.label} por $${space.cost.toLocaleString()}! Nuevo flujo pasivo: +$${space.cashflow.toLocaleString()}/mes.`, "log-success");
          if (player.state.fastTrackCashflow >= 50000) {
            this.declareWinner(player, "¡Ganó por alcanzar más de $50,000 en flujo de la Vía Rápida!");
          }
        }
        this.refreshUI();
        this.endTurn();
        break;

      default:
        this.endTurn();
        break;
    }
  }

  promptHumanOpportunityChoice() {
    const modal = document.getElementById("cardModal");
    const badge = document.getElementById("modalBadge");
    const title = document.getElementById("modalTitle");
    const desc = document.getElementById("modalDescription");
    const metrics = document.getElementById("modalMetrics");
    const actions = document.getElementById("modalActions");
    const stockCtrls = document.getElementById("modalStockControls");

    stockCtrls.classList.add("hidden");
    badge.textContent = "OPORTUNIDAD";
    title.textContent = "¿Qué tipo de negocio deseas explorar?";
    desc.textContent = "Elige 'Negocio Pequeño' si dispones de menos de $5,000, o 'Gran Negocio' para propiedades multifamiliares o empresas de alto flujo.";

    metrics.innerHTML = `
      <div><strong>Negocio Pequeño:</strong> Costos ≤ $5,000</div>
      <div><strong>Gran Negocio:</strong> Costos ≥ $6,000 (Requiere apalancamiento)</div>
    `;

    actions.innerHTML = `
      <button id="btnChooseSmall" class="btn btn-primary">Negocio Pequeño</button>
      <button id="btnChooseBig" class="btn btn-gold">Gran Negocio</button>
      <button id="btnChoosePass" class="btn btn-outline">Pasar</button>
    `;

    modal.classList.remove("hidden");

    document.getElementById("btnChooseSmall").onclick = () => {
      const card = this.cardDeck.drawSmallDeal();
      this.displayDealCard(card);
    };

    document.getElementById("btnChooseBig").onclick = () => {
      const card = this.cardDeck.drawBigDeal();
      this.displayDealCard(card);
    };

    document.getElementById("btnChoosePass").onclick = () => {
      modal.classList.add("hidden");
      this.endTurn();
    };
  }

  displayDealCard(card) {
    this.currentPendingCard = card;
    const badge = document.getElementById("modalBadge");
    const title = document.getElementById("modalTitle");
    const desc = document.getElementById("modalDescription");
    const metrics = document.getElementById("modalMetrics");
    const actions = document.getElementById("modalActions");
    const stockCtrls = document.getElementById("modalStockControls");

    badge.textContent = card.category.toUpperCase();
    title.textContent = card.title;
    desc.textContent = card.description;

    if (card.category === "Stock") {
      stockCtrls.classList.remove("hidden");
      document.getElementById("inputStockShares").value = 100;
      this.updateStockCostPreview(100);

      metrics.innerHTML = `
        <div>Símbolo: <strong>${card.symbol}</strong></div>
        <div>Precio Actual: <strong>$${card.price}</strong></div>
        <div>Dividendo: <strong>$${card.dividend || 0}/acción</strong></div>
        <div>Rango: <strong>$5 - $40</strong></div>
      `;
    } else {
      stockCtrls.classList.add("hidden");
      const roi = card.downPayment > 0 ? Math.round(((card.cashflow * 12) / card.downPayment) * 100) : 0;
      metrics.innerHTML = `
        <div>Costo Total: <strong>$${(card.cost || 0).toLocaleString()}</strong></div>
        <div>Anticipo (Down Pay): <strong>$${(card.downPayment || 0).toLocaleString()}</strong></div>
        <div>Hipoteca/Deuda: <strong>$${(card.mortgage || card.liability || 0).toLocaleString()}</strong></div>
        <div>Flujo Mensual: <strong class="val-positive">+$${(card.cashflow || 0).toLocaleString()}/mes</strong></div>
        <div>Retorno (ROI): <strong class="val-positive">${roi}% anual</strong></div>
      `;
    }

    actions.innerHTML = `
      <button id="btnDealBuy" class="btn btn-primary">Comprar Activo</button>
      <button id="btnDealPass" class="btn btn-outline">Rechazar / Pasar</button>
    `;

    document.getElementById("btnDealBuy").onclick = () => this.handleModalBuy();
    document.getElementById("btnDealPass").onclick = () => this.handleModalPass();
  }

  updateStockCostPreview(shares) {
    if (!this.currentPendingCard) return;
    const price = this.currentPendingCard.price || 10;
    const count = parseInt(shares) || 0;
    const total = count * price;
    document.getElementById("txtStockTotalCost").textContent = `$${total.toLocaleString()}`;
  }

  setStockSharesMax() {
    if (!this.currentPendingCard) return;
    const price = this.currentPendingCard.price || 10;
    const maxShares = Math.floor(this.activePlayer.state.cash / price);
    document.getElementById("inputStockShares").value = maxShares;
    this.updateStockCostPreview(maxShares);
  }

  handleModalBuy() {
    const card = this.currentPendingCard;
    const player = this.activePlayer;
    const modal = document.getElementById("cardModal");

    try {
      if (card.category === "Stock") {
        const shares = parseInt(document.getElementById("inputStockShares").value) || 0;
        player.state = FinancialEngine.buyStocks(player.state, card.symbol, shares, card.price, card.dividend);
        this.log(`📈 Compraste ${shares.toLocaleString()} acciones de ${card.symbol} a $${card.price}.`, "log-success");
      } else if (card.category === "RealEstate" || card.category === "Business") {
        player.state = FinancialEngine.addRealEstate(player.state, card);
        this.log(`🏠 ¡Adquiriste ${card.title}! Flujo pasivo +$${card.cashflow}/mes.`, "log-success");
      } else {
        // Metales o activos directos
        if (player.state.cash < card.cost) throw new Error("Efectivo insuficiente.");
        player.state.cash -= card.cost;
        player.state.assets.metals.push(card);
        this.log(`🪙 Adquiriste ${card.title} por $${card.cost.toLocaleString()}.`, "log-success");
      }

      modal.classList.add("hidden");
      this.refreshUI();
      this.endTurn();
    } catch (err) {
      alert(err.message);
    }
  }

  handleModalPass() {
    document.getElementById("cardModal").classList.add("hidden");
    this.endTurn();
  }

  handleMarketEvent(mktCard) {
    const player = this.activePlayer;

    if (mktCard.category === "RealEstateMarket") {
      const matchProps = player.state.assets.realEstate.filter(r => r.type === mktCard.targetType);
      if (matchProps.length > 0) {
        matchProps.forEach(prop => {
          const totalOffer = mktCard.offerPricePerUnit * prop.units;
          const net = totalOffer - prop.mortgage;
          if (confirm(`El mercado ofrece $${mktCard.offerPricePerUnit.toLocaleString()} por unidad en tu propiedad '${prop.title}'. Obtendrás $${net.toLocaleString()} netos. ¿Deseas vender?`)) {
            player.state = FinancialEngine.sellRealEstate(player.state, prop.id, mktCard.offerPricePerUnit);
            this.log(`💰 Vendiste '${prop.title}' por ganancia neta de $${net.toLocaleString()}.`, "log-success");
          }
        });
      }
    }

    if (mktCard.category === "StockMarket") {
      const stock = player.state.assets.stocks.find(s => s.symbol === mktCard.symbol);
      if (stock) {
        if (confirm(`¡Rally en ${stock.symbol}! Precio subió a $${mktCard.newPrice}. Tienes ${stock.shares} acciones. ¿Deseas vender todas por $${(stock.shares * mktCard.newPrice).toLocaleString()}?`)) {
          player.state = FinancialEngine.sellStocks(player.state, stock.symbol, stock.shares, mktCard.newPrice);
          this.log(`📈 Liquidaste ${stock.shares} acciones de ${stock.symbol} a $${mktCard.newPrice}.`, "log-success");
        }
      }
    }

    this.refreshUI();
    this.endTurn();
  }

  handleAIMarketEvent(aiPlayer, mktCard) {
    // Los bots deciden con su heurística de mercado; nunca se les muestra un confirm()
    const decisions = aiPlayer.evaluateMarketSale(mktCard);

    if (decisions.length === 0) {
      this.log(`🤖 ${aiPlayer.name} analiza el mercado y decide no vender.`, "log-info");
    }

    decisions.forEach(d => {
      if (d.type === "SELL_RE") {
        aiPlayer.state = FinancialEngine.sellRealEstate(aiPlayer.state, d.propertyId, d.offer);
        this.log(`🤖 ${aiPlayer.name} vendió una propiedad aprovechando el pico del mercado.`, "log-info");
      } else if (d.type === "SELL_STOCK") {
        aiPlayer.state = FinancialEngine.sellStocks(aiPlayer.state, d.symbol, d.shares, d.price);
        this.log(`🤖 ${aiPlayer.name} liquidó ${d.shares} acciones de ${d.symbol} a $${d.price}.`, "log-info");
      }
    });

    this.refreshUI();
    this.endTurn();
  }

  handleAIOpportunity(aiPlayer) {
    const oppType = aiPlayer.decideOpportunityType();
    const card = oppType === "BIG" ? this.cardDeck.drawBigDeal() : this.cardDeck.drawSmallDeal();
    const decision = aiPlayer.evaluateDeal(card);

    if (decision.action === "BUY") {
      try {
        if (card.category === "Stock") {
          aiPlayer.state = FinancialEngine.buyStocks(aiPlayer.state, card.symbol, 100, card.price, card.dividend);
          this.log(`🤖 ${aiPlayer.name} compró 100 acciones de ${card.symbol}.`, "log-info");
        } else {
          aiPlayer.state = FinancialEngine.addRealEstate(aiPlayer.state, card);
          this.log(`🤖 ${aiPlayer.name} adquirió '${card.title}' (+Flujo: $${card.cashflow}/mes).`, "log-info");
        }
      } catch (e) {
        // No compra si hubo error
      }
    } else if (decision.action === "BUY_WITH_LOAN") {
      aiPlayer.state = FinancialEngine.takeBankLoan(aiPlayer.state, decision.neededLoan);
      aiPlayer.state = FinancialEngine.addRealEstate(aiPlayer.state, card);
      this.log(`🤖 ${aiPlayer.name} tomó préstamo de $${decision.neededLoan.toLocaleString()} y adquirió '${card.title}'.`, "log-warning");
    } else {
      this.log(`🤖 ${aiPlayer.name} pasó la oportunidad '${card.title}'.`, "log-info");
    }

    this.refreshUI();
    this.endTurn();
  }

  handleHumanCharity() {
    const player = this.activePlayer;
    const charityCost = Math.round(player.state.totalIncome * 0.10);
    if (player.state.cash < charityCost) {
      alert(`Necesitas $${charityCost.toLocaleString()} para donar el 10% de tus ingresos.`);
      return;
    }
    player.state.cash -= charityCost;
    player.state.charityTurns = 3;
    this.log(`🤝 Donaste $${charityCost.toLocaleString()} a caridad. Podrás lanzar 2 dados los próximos 3 turnos.`, "log-success");
    this.refreshUI();
  }

  handleTakeBankLoan() {
    const input = document.getElementById("inputLoanAmount");
    const amount = parseInt(input.value) || 1000;
    try {
      this.activePlayer.state = FinancialEngine.takeBankLoan(this.activePlayer.state, amount);
      this.log(`🏦 Préstamo aprobado: +$${amount.toLocaleString()} en mano. Interés mensual: +$${amount * 0.10}/mes.`, "log-warning");
      this.refreshUI();
    } catch (err) {
      alert(err.message);
    }
  }

  handleHumanExitRatRace() {
    const player = this.activePlayer;
    if (!player.state.canExitRatRace) return;

    player.state = FinancialEngine.transitionToFastTrack(player.state);
    player.position = 0;
    this.log(`🎉 ¡FELICITACIONES! Has salido de la Carrera de la Rata y entrado en la Vía Rápida con $${player.state.cash.toLocaleString()} de capital.`, "log-success");
    this.launchConfetti(120);
    document.getElementById("btnExitRatRace").classList.add("hidden");
    this.refreshUI();
  }

  endTurn() {
    // Verificar si el jugador actual puede salir de la rata
    if (this.activePlayer.state.canExitRatRace && !this.activePlayer.state.inFastTrack) {
      if (this.activePlayer.isAI) {
        this.activePlayer.state = FinancialEngine.transitionToFastTrack(this.activePlayer.state);
        this.activePlayer.position = 0;
        this.log(`🚀 ¡${this.activePlayer.name} ha salido de la Carrera de la Rata hacia la Vía Rápida!`, "log-warning");
        this.launchConfetti(80);
      } else {
        document.getElementById("btnExitRatRace").classList.remove("hidden");
      }
    }

    // Pasar al siguiente jugador
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    if (this.activePlayerIndex === 0) {
      this.turn += 1;
      // Actualizar mercados bursátiles en cada ronda
      const marketUpdate = this.market.nextTurn();
      if (this.mode202) {
        this.renderMarketTickers();
      }
    }

    this.refreshUI();

    // Si le toca a un bot de IA
    if (this.activePlayer.isAI) {
      document.getElementById("btnRollDice").disabled = true;
      document.getElementById("turnLabel").textContent = `Turno ${this.turn}: Pensando ${this.activePlayer.name}...`;

      const gen = this._gameGeneration;
      setTimeout(() => {
        if (gen !== this._gameGeneration) return; // la partida se reinició mientras la IA pensaba
        this.executeAITurn(this.activePlayer);
      }, 1000);
    } else {
      document.getElementById("btnRollDice").disabled = false;
      document.getElementById("turnLabel").textContent = `Turno ${this.turn}: Tu Turno (${this.activePlayer.name})`;
    }
  }

  kickOffTurn() {
    // Primer turno tras iniciar o restaurar una partida: la pantalla compartida
    // debe anunciar de inmediato a quién le toca y, si es un bot, ponerlo en marcha
    const active = this.activePlayer;
    const dice = document.getElementById("btnRollDice");
    const label = document.getElementById("turnLabel");

    if (active.isAI) {
      dice.disabled = true;
      label.textContent = `Turno ${this.turn}: Pensando ${active.name}...`;
      const gen = this._gameGeneration;
      setTimeout(() => {
        if (gen !== this._gameGeneration) return; // la partida se reinició mientras la IA pensaba
        this.executeAITurn(this.activePlayer);
      }, 1000);
    } else {
      dice.disabled = false;
      label.textContent = `Turno ${this.turn}: Tu Turno (${active.name})`;
    }
  }

  executeAITurn(aiPlayer) {
    if (aiPlayer.state.downsizedTurns > 0) {
      aiPlayer.state.downsizedTurns -= 1;
      this.log(`🤖 ${aiPlayer.name} sigue despedido.`, "log-warning");
      this.endTurn();
      return;
    }

    const { rolls, total } = this.board.rollDice(false);
    this.animateDice(rolls, total);

    const moveResult = this.board.movePlayer(aiPlayer.position, total, aiPlayer.state.inFastTrack);
    aiPlayer.position = moveResult.newPosition;
    this.board.render(this.players, this.activePlayerIndex);

    if (moveResult.passedPaycheck) {
      aiPlayer.state = FinancialEngine.collectPaycheck(aiPlayer.state);
      this.log(`🤖 ${aiPlayer.name} cobró su nómina (+$${aiPlayer.state.monthlyCashflow.toLocaleString()}).`, "log-info");
    }

    // Liquidar deudas si le conviene
    const debtAction = aiPlayer.evaluateDebtPayoff();
    if (debtAction) {
      aiPlayer.state = FinancialEngine.payOffDebt(aiPlayer.state, debtAction.type, debtAction.amount);
      this.log(`🤖 ${aiPlayer.name} amortizó $${debtAction.amount.toLocaleString()} en ${debtAction.type}.`, "log-info");
    }

    this.processLandSpace(aiPlayer, moveResult.space);
  }

  refreshUI() {
    const p = this.activePlayer;
    const s = p.state;

    // Métricas del Header de Jugador
    document.getElementById("playerAvatar").textContent = s.icon || "💼";
    document.getElementById("playerName").textContent = p.name;
    document.getElementById("playerProfession").textContent = s.profession;
    this.animateCashValue(s.cash);
    document.getElementById("playerCashflow").textContent = `${s.monthlyCashflow >= 0 ? '+' : ''}$${s.monthlyCashflow.toLocaleString()}`;
    document.getElementById("playerTotalIncome").textContent = `$${s.totalIncome.toLocaleString()}`;
    document.getElementById("playerTotalExpenses").textContent = `$${s.totalExpenses.toLocaleString()}`;

    // Barra de Progreso de Libertad Financiera
    document.getElementById("txtPassiveIncome").textContent = `$${s.passiveIncome.toLocaleString()}`;
    document.getElementById("txtTargetExpenses").textContent = `$${s.totalExpenses.toLocaleString()}`;
    document.getElementById("txtExitProgress").textContent = `${s.exitProgress}%`;
    document.getElementById("progressBarFill").style.width = `${s.exitProgress}%`;

    // Pestaña Estado de Resultados
    document.getElementById("stSalary").textContent = `$${s.salary.toLocaleString()}`;
    const reCashflow = s.assets.realEstate.reduce((sum, item) => sum + (item.cashflow || 0), 0);
    const bizCashflow = s.assets.businesses.reduce((sum, item) => sum + (item.cashflow || 0), 0);
    const stockDiv = s.assets.stocks.reduce((sum, item) => sum + ((item.dividend || 0) * (item.shares || 0)), 0);

    document.getElementById("stReCashflow").textContent = `+$${reCashflow.toLocaleString()}`;
    document.getElementById("stBizCashflow").textContent = `+$${bizCashflow.toLocaleString()}`;
    document.getElementById("stStockDividends").textContent = `+$${stockDiv.toLocaleString()}`;
    document.getElementById("stTotalIncome").textContent = `$${s.totalIncome.toLocaleString()}`;

    document.getElementById("stTaxes").textContent = `$${s.taxes.toLocaleString()}`;
    document.getElementById("stMortgage").textContent = `$${s.mortgagePay.toLocaleString()}`;
    document.getElementById("stSchoolLoan").textContent = `$${s.schoolLoanPay.toLocaleString()}`;
    document.getElementById("stCarLoan").textContent = `$${s.carLoanPay.toLocaleString()}`;
    document.getElementById("stCreditCards").textContent = `$${s.creditCardsPay.toLocaleString()}`;
    document.getElementById("stRetailDebt").textContent = `$${s.retailDebtPay.toLocaleString()}`;
    document.getElementById("stOtherExpenses").textContent = `$${s.otherExpenses.toLocaleString()}`;
    document.getElementById("stChildCount").textContent = s.childrenCount;
    document.getElementById("stChildExpense").textContent = `$${(s.childrenCount * s.perChildExpense).toLocaleString()}`;
    document.getElementById("stBankInterest").textContent = `$${Math.round(s.liabilities.bankLoan * 0.10).toLocaleString()}`;
    document.getElementById("stTotalExpenses").textContent = `$${s.totalExpenses.toLocaleString()}`;

    // Pestaña Balance General
    this.renderAssetsAndLiabilities(s);

    // Botones de Amortización de Deuda
    this.renderPayoffButtons(s);

    // Renderizado del Tablero Canvas
    this.board.render(this.players, this.activePlayerIndex);

    // Mercado 202
    if (this.mode202) {
      this.renderMarketTickers();
    }
  }

  // Anima con conteo incremental el efectivo del jugador y destella verde/rojo
  // según suba o baje. Si cambia el jugador activo, salta directo al valor final.
  animateCashValue(newValue) {
    const el = document.getElementById("playerCash");
    if (!el) return;

    const prevShown = this._displayedCash;
    const samePlayer = this._displayedCashIndex === this.activePlayerIndex;
    this._displayedCash = newValue;
    this._displayedCashIndex = this.activePlayerIndex;

    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prevShown === undefined || !samePlayer || prevShown === newValue || reducedMotion) {
      el.textContent = `$${newValue.toLocaleString()}`;
      if (prevShown === undefined || !samePlayer) return;
    }

    if (this._cashTweenId) cancelAnimationFrame(this._cashTweenId);
    const startValue = prevShown;
    const duration = 450;
    const startTime = performance.now();
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = `$${Math.round(startValue + (newValue - startValue) * eased).toLocaleString()}`;
      if (t < 1) this._cashTweenId = requestAnimationFrame(step);
    };
    this._cashTweenId = requestAnimationFrame(step);

    // Destello verde (subida) o rojo (bajada) sobre el valor
    el.classList.remove("cash-flash-up", "cash-flash-down");
    void el.offsetWidth; // fuerza el reinicio de la animación CSS
    el.classList.add(newValue >= startValue ? "cash-flash-up" : "cash-flash-down");
  }

  // Lluvia de confeti CSS para celebrar hitos (escape de la Carrera de la Rata, victoria)
  launchConfetti(count = 100) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (this._confettiLayer) this._confettiLayer.remove();

    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    layer.setAttribute("aria-hidden", "true");

    const palette = ["#f43f5e", "#38bdf8", "#a78bfa", "#fbbf24", "#34d399", "#fb923c", "#f472b6"];
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = palette[Math.floor(Math.random() * palette.length)];
      piece.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
      piece.style.animationDelay = `${Math.random() * 0.6}s`;
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    this._confettiLayer = layer;
    setTimeout(() => {
      layer.remove();
      if (this._confettiLayer === layer) this._confettiLayer = null;
    }, 4800);
  }

  renderAssetsAndLiabilities(s) {
    const assetsList = document.getElementById("assetsList");
    assetsList.innerHTML = "";

    const allAssets = [
      ...s.assets.realEstate.map(r => ({ title: r.title, sub: `${r.units || 1} U • Flujo: +$${r.cashflow}/mes`, cost: `$${r.cost.toLocaleString()}` })),
      ...s.assets.stocks.map(stk => ({ title: `${stk.shares} acc. ${stk.symbol}`, sub: `Costo base: $${stk.costBasis}`, cost: `$${(stk.shares * stk.costBasis).toLocaleString()}` })),
      ...s.assets.metals.map(m => ({ title: m.title, sub: `Metal Físico`, cost: `$${m.cost.toLocaleString()}` }))
    ];

    if (allAssets.length === 0) {
      assetsList.innerHTML = `<div class="empty-hint">Sin activos adquiridos aún. ¡Cae en casillas de Oportunidad!</div>`;
    } else {
      allAssets.forEach(a => {
        const item = document.createElement("div");
        item.className = "asset-card";
        item.innerHTML = `
          <div class="asset-header"><span>${a.title}</span><strong class="val-positive">${a.cost}</strong></div>
          <div class="asset-details"><span>${a.sub}</span></div>
        `;
        assetsList.appendChild(item);
      });
    }

    const liabList = document.getElementById("liabilitiesList");
    liabList.innerHTML = "";
    const debts = [
      { name: "Hipoteca Inmobiliaria", amount: s.liabilities.mortgage },
      { name: "Préstamo Escolar", amount: s.liabilities.schoolLoan },
      { name: "Préstamo de Auto", amount: s.liabilities.carLoan },
      { name: "Tarjetas de Crédito", amount: s.liabilities.creditCards },
      { name: "Créditos Comerciales", amount: s.liabilities.retailDebt },
      { name: "Préstamo Bancario Activo", amount: s.liabilities.bankLoan }
    ];

    debts.forEach(d => {
      if (d.amount > 0) {
        const item = document.createElement("div");
        item.className = "liability-card";
        item.innerHTML = `
          <div class="asset-header"><span>${d.name}</span><strong class="val-negative">$${d.amount.toLocaleString()}</strong></div>
        `;
        liabList.appendChild(item);
      }
    });
  }

  renderPayoffButtons(s) {
    const grid = document.getElementById("payoffButtonsGrid");
    grid.innerHTML = "";

    const debts = [
      { key: "creditCards", name: "Tarjetas de Crédito", amount: s.liabilities.creditCards },
      { key: "carLoan", name: "Préstamo de Auto", amount: s.liabilities.carLoan },
      { key: "retailDebt", name: "Créditos Minoristas", amount: s.liabilities.retailDebt },
      { key: "bankLoan", name: "Préstamo Bancario", amount: s.liabilities.bankLoan },
      { key: "schoolLoan", name: "Préstamo Escolar", amount: s.liabilities.schoolLoan }
    ];

    debts.forEach(d => {
      if (d.amount > 0) {
        const btn = document.createElement("button");
        btn.className = "btn-payoff";
        btn.disabled = s.cash < d.amount;
        btn.innerHTML = `
          <strong>Pagar ${d.name}</strong><br>
          Monto: $${d.amount.toLocaleString()}
        `;
        btn.onclick = () => {
          try {
            this.activePlayer.state = FinancialEngine.payOffDebt(this.activePlayer.state, d.key, d.amount);
            this.log(`💳 Cancelaste ${d.name} por $${d.amount.toLocaleString()}. ¡Gastos reducidos!`, "log-success");
            this.refreshUI();
          } catch (e) {
            alert(e.message);
          }
        };
        grid.appendChild(btn);
      }
    });
  }

  renderMarketTickers() {
    const grid = document.getElementById("tickersGrid");
    if (!grid) return;
    grid.innerHTML = "";

    this.market.stocks.forEach((stk, idx) => {
      const card = document.createElement("div");
      card.className = "ticker-card";
      // Entrada escalonada de las tarjetas del mercado
      card.style.animationDelay = `${idx * 70}ms`;

      let chartBars = "";
      stk.history.forEach(p => {
        const heightPct = Math.round(((p - stk.minPrice) / (stk.maxPrice - stk.minPrice || 1)) * 100);
        chartBars += `<div class="chart-bar" style="height: ${Math.max(10, heightPct)}%;"></div>`;
      });

      card.innerHTML = `
        <div class="ticker-top">
          <span class="ticker-symbol">${stk.symbol}</span>
          <span class="ticker-price">$${stk.currentPrice}</span>
        </div>
        <div class="ticker-chart">${chartBars}</div>
        <div class="ticker-actions">
          <button class="btn btn-outline" data-buy="${stk.symbol}">Comprar</button>
          <button class="btn btn-outline" data-call="${stk.symbol}">Call ($2)</button>
          <button class="btn btn-outline" data-put="${stk.symbol}">Put ($2)</button>
          <button class="btn btn-outline" data-short="${stk.symbol}">⬇ Corto</button>
        </div>
      `;

      // Destello de precio: verde si subió respecto al refresco anterior, rojo si bajó
      const prevPrice = this._lastTickerPrices ? this._lastTickerPrices[stk.symbol] : null;
      if (prevPrice !== null && prevPrice !== undefined && prevPrice !== stk.currentPrice) {
        card.querySelector(".ticker-price").classList.add(stk.currentPrice > prevPrice ? "price-up" : "price-down");
      }

      card.querySelector(`[data-buy="${stk.symbol}"]`).onclick = () => {
        try {
          this.activePlayer.state = FinancialEngine.buyStocks(this.activePlayer.state, stk.symbol, 100, stk.currentPrice, stk.dividend);
          this.log(`📈 Compraste 100 acciones de ${stk.symbol} a $${stk.currentPrice}.`, "log-success");
          this.refreshUI();
        } catch (e) {
          alert(e.message);
        }
      };

      card.querySelector(`[data-call="${stk.symbol}"]`).onclick = () => {
        try {
          this.market.buyOption(this.activePlayer.state, "CALL", stk.symbol, stk.currentPrice, 2, 100, 4);
          this.log(`⚡ Contrato CALL adquirido en ${stk.symbol} (Strike: $${stk.currentPrice}, 4 turnos).`, "log-success");
          this.refreshUI();
        } catch (e) {
          alert(e.message);
        }
      };

      card.querySelector(`[data-put="${stk.symbol}"]`).onclick = () => {
        try {
          this.market.buyOption(this.activePlayer.state, "PUT", stk.symbol, stk.currentPrice, 2, 100, 4);
          this.log(`🛡️ Contrato PUT adquirido en ${stk.symbol} (Strike: $${stk.currentPrice}, 4 turnos).`, "log-success");
          this.refreshUI();
        } catch (e) {
          alert(e.message);
        }
      };

      card.querySelector(`[data-short="${stk.symbol}"]`).onclick = () => {
        try {
          this.market.openShort(this.activePlayer.state, stk.symbol, 100);
          this.log(`⬇️ Posición corta abierta: vendiste prestadas 100 acciones de ${stk.symbol} a $${stk.currentPrice}. Deberás recomprarlas para cerrar.`, "log-warning");
          this.refreshUI();
        } catch (e) {
          alert(e.message);
        }
      };

      grid.appendChild(card);
    });

    // Memoria de precios para el destello de subida/bajada del siguiente refresco
    this._lastTickerPrices = {};
    this.market.stocks.forEach(s => { this._lastTickerPrices[s.symbol] = s.currentPrice; });

    // Renderizar opciones activas y posiciones cortas
    const optList = document.getElementById("optionsList");
    optList.innerHTML = "";
    if (this.market.optionsContracts.length === 0 && this.market.shortPositions.length === 0) {
      optList.innerHTML = `<div class="empty-hint">No posees contratos de opciones ni posiciones cortas activos.</div>`;
    } else {
      this.market.optionsContracts.forEach(opt => {
        const div = document.createElement("div");
        div.className = "asset-card";
        div.innerHTML = `
          <div class="asset-header">
            <span>${opt.type} en ${opt.symbol} (Strike: $${opt.strike})</span>
            <button class="btn btn-primary" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;" data-exercise="${opt.id}">Ejercer</button>
          </div>
          <div class="asset-details"><span>Quedan ${opt.turnsLeft} turnos</span></div>
        `;
        div.querySelector(`[data-exercise="${opt.id}"]`).onclick = () => {
          try {
            const res = this.market.exerciseOption(this.activePlayer.state, opt.id);
            this.log(`🎯 ¡Opción ${opt.type} ejercida con éxito! Cobraste beneficio de +$${res.payoff.toLocaleString()}.`, "log-success");
            this.refreshUI();
          } catch (e) {
            alert(e.message);
          }
        };
        optList.appendChild(div);
      });

      this.market.shortPositions.forEach(pos => {
        const live = this.market.getStock(pos.symbol);
        const current = live ? live.currentPrice : pos.shortPrice;
        const unrealized = (pos.shortPrice - current) * pos.shares;
        const div = document.createElement("div");
        div.className = "asset-card";
        div.innerHTML = `
          <div class="asset-header">
            <span>⬇️ Corto en ${pos.symbol} (x${pos.shares} @ $${pos.shortPrice})</span>
            <button class="btn btn-primary" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;" data-cover="${pos.id}">Cubrir</button>
          </div>
          <div class="asset-details"><span>P&L no realizado: <strong class="${unrealized >= 0 ? 'val-positive' : 'val-negative'}">${unrealized >= 0 ? '+' : ''}$${unrealized.toLocaleString()}</strong></span></div>
        `;
        div.querySelector(`[data-cover="${pos.id}"]`).onclick = () => {
          try {
            const res = this.market.coverShort(this.activePlayer.state, pos.id);
            this.log(`✅ Corto en ${pos.symbol} cubierto. ${res.profit >= 0 ? 'Beneficio' : 'Pérdida'}: $${Math.abs(res.profit).toLocaleString()}.`, res.profit >= 0 ? "log-success" : "log-danger");
            this.refreshUI();
          } catch (e) {
            alert(e.message);
          }
        };
        optList.appendChild(div);
      });
    }
  }

  // Snapshot serializable del estado completo de la sesión en curso (jugadores,
  // turno activo, reglamento y mercado bursátil con patrones, opciones y cortos)
  construirSnapshotPartida() {
    return {
      players: this.players,
      activePlayerIndex: this.activePlayerIndex,
      turn: this.turn,
      mode202: this.mode202,
      market: {
        turn: this.market.turn,
        stocks: this.market.stocks.map(s => ({
          symbol: s.symbol,
          currentPrice: s.currentPrice,
          history: s.history,
          activePattern: s.activePattern,
          patternIndex: s.patternIndex
        })),
        optionsContracts: this.market.optionsContracts,
        shortPositions: this.market.shortPositions
      }
    };
  }

  // 💾 Guardar: si la sesión ya está asociada a una partida registrada,
  // actualiza ese mismo registro "NNN-AAA" en sitio; si no, abre el panel
  // de salas para elegir la sala destino o crear una nueva
  saveCurrentGame() {
    if (this.currentPartidaId) {
      this.guardarEnSala(this.currentSalaCodigo, this.currentPartidaId);
      return;
    }
    this.abrirSalasModal("guardar");
  }

  // 📂 Cargar: abre el explorador de salas y partidas de la base de datos local
  loadSavedGame() {
    this.abrirSalasModal("cargar");
  }

  initSalasModal() {
    document.getElementById("btnSalasClose").addEventListener("click", () => this.cerrarSalasModal());
    // Delegación única sobre el contenedor: el contenido del panel se
    // regenera por completo en cada render y rebindaría listeners duplicados
    document.getElementById("salasContent").addEventListener("click", (e) => this.handleSalasClick(e));
    document.getElementById("storagePill").addEventListener("click", () => this.alternarAlmacen());
  }

  // Detecta la API Worker en segundo plano; no bloquea el arranque
  async iniciarAlmacen() {
    const base = resolverApiBase();
    if (!base) { this.actualizarPillAlmacen("local"); return; }
    this.actualizarPillAlmacen("comprobando");
    const nube = new NubeSalasDB(base);
    if (await nube.disponible()) {
      this.dbNube = nube;
      this.db = nube;
      this.actualizarPillAlmacen("nube");
      this.log("☁️ Sincronización en la nube activa: tus salas y partidas se guardan en Cloudflare D1.", "log-info");
    } else {
      this.actualizarPillAlmacen("sin-conexion");
    }
  }

  // Cambia entre nube y base local (solo si la API respondió al arrancar)
  alternarAlmacen() {
    if (!this.dbNube) { this.iniciarAlmacen(); return; }
    this.db = this.db === this.dbNube ? this.dbLocal : this.dbNube;
    this.currentSalaCodigo = null;
    this.currentPartidaId = null;
    this.actualizarPillAlmacen(this.db.esNube ? "nube" : "local");
    this.log(this.db.esNube ? "☁️ Guardado en la nube activado." : "💾 Guardado local (este navegador) activado.", "log-info");
    if (!document.getElementById("salasModal").classList.contains("hidden")) this.renderSalas();
  }

  actualizarPillAlmacen(estado) {
    const pill = document.getElementById("storagePill");
    const textos = {
      local: ["💾 Local", "Partidas guardadas en este navegador (IndexedDB)"],
      comprobando: ["⏳ Conectando…", "Comprobando la API en la nube"],
      nube: ["☁️ Nube", "Partidas sincronizadas en Cloudflare D1 · clic para usar guardado local"],
      "sin-conexion": ["⚠️ Sin nube", "La API en la nube no responde; usando guardado local · clic para reintentar"]
    };
    const [txt, titulo] = textos[estado] || textos.local;
    pill.textContent = txt;
    pill.title = titulo;
    pill.dataset.estado = estado;
  }

  cerrarSalasModal() {
    document.getElementById("salasModal").classList.add("hidden");
    this._salaSeleccionada = null;
  }

  abrirSalasModal(modo) {
    this._modoSalas = modo;
    this._salaSeleccionada = null;
    document.getElementById("salasModalTitle").textContent = modo === "guardar"
      ? "💾 Guardar Partida en una Sala"
      : "📂 Cargar Partida Guardada";
    document.getElementById("salasModal").classList.remove("hidden");
    this.renderSalas();
  }

  async renderSalas() {
    const cont = document.getElementById("salasContent");
    cont.innerHTML = `<p class="salas-vacio">Consultando la base de datos ${this.db.esNube ? "en la nube" : "local"}…</p>`;
    document.getElementById("salasDesc").innerHTML = this.db.esNube
      ? '☁️ <strong>Nube (Cloudflare D1):</strong> comparte el código de 3 dígitos de tu sala para que otros carguen sus partidas <strong>NNN-AAA</strong> desde cualquier dispositivo. Solo el creador de la sala puede guardar o borrar.'
      : '💾 <strong>Local:</strong> las partidas se guardan en este navegador organizadas por salas con código de 3 dígitos; cada partida se identifica como <strong>NNN-AAA</strong> (los 3 dígitos de su sala, un guion y 3 letras).';
    try {
      let salas = await this.db.listarSalas();
      // En la nube solo se puede guardar en salas propias
      if (this._modoSalas === "guardar" && this.db.esNube) salas = salas.filter(s => s.propia);

      if (this._modoSalas === "guardar") {
        const resumen = `Modo ${this.mode202 ? "Avanzado" : "Esencial"} • Turno ${this.turn} • ${this.players.length} participante(s)`;
        const tarjetas = salas.map(s => `
          <button type="button" class="sala-card" data-sala-codigo="${s.codigo}">
            <span class="sala-code">${s.codigo}</span>
            <span class="sala-card-body"><strong>${this.escaparHtml(s.nombre)}</strong><span class="sala-meta">${s.numPartidas} partida(s) guardada(s)</span></span>
            <span class="sala-card-pick">✓</span>
          </button>`).join("");
        cont.innerHTML = `
          <p class="salas-resumen">${resumen}</p>
          <div class="sala-list">
            ${salas.length ? tarjetas : '<p class="salas-vacio">Aún no hay salas: crea la primera para organizar tus partidas.</p>'}
            <button type="button" class="sala-card sala-card-new" data-sala-codigo="nueva">
              <span class="sala-code">➕</span>
              <span class="sala-card-body"><strong>Crear sala nueva</strong><span class="sala-meta">Se asignará un código libre de 3 dígitos</span></span>
              <span class="sala-card-pick">✓</span>
            </button>
          </div>
          <div id="salaNuevaForm" class="sala-nueva-form hidden">
            <label for="inputSalaNombre">Nombre de la sala (opcional):</label>
            <input type="text" id="inputSalaNombre" maxlength="40" placeholder="Ej. Mesa de los martes">
          </div>
          <div class="setup-actions">
            <button type="button" id="btnSalasConfirmGuardar" class="btn btn-primary" disabled>💾 Guardar Partida Aquí</button>
          </div>`;
        return;
      }

      // Modo cargar: cada sala con sus partidas listadas por última actualización
      const bloques = await Promise.all(salas.map(async s => {
        const partidas = await this.db.listarPartidas(s.codigo);
        const filas = partidas.map(p => `
          <div class="partida-row">
            <span class="partida-id">${p.id}</span>
            <span class="partida-meta">${p.modo === "202" ? "Avanzado" : "Esencial"} • Turno ${p.turno} • ${p.numJugadores} jug. • ${this.formatearFecha(p.actualizado)}</span>
            <button type="button" class="btn btn-outline btn-sm" data-cargar-partida="${p.id}">📂 Cargar</button>
            ${this.db.esNube && !s.propia ? "" : `<button type="button" class="btn btn-outline btn-sm btn-borrar" data-eliminar-partida="${p.id}" title="Eliminar partida">🗑️</button>`}
          </div>`).join("");
        return `
          <div class="sala-bloque">
            <div class="sala-bloque-head">
              <span class="sala-code">${s.codigo}</span>
              <strong class="sala-bloque-nombre">${this.escaparHtml(s.nombre)}</strong>
              <button type="button" class="btn btn-outline btn-sm btn-borrar" data-eliminar-sala="${s.codigo}" title="${this.db.esNube && !s.propia ? "Quitar de mi lista (la sala sigue en la nube)" : "Eliminar la sala y todas sus partidas"}">${this.db.esNube && !s.propia ? "✕ Quitar" : "🗑️ Sala"}</button>
            </div>
            <div class="partida-rows">${filas || '<p class="salas-vacio">Sin partidas guardadas en esta sala.</p>'}</div>
          </div>`;
      }));
      const unirse = this.db.esNube ? `
        <div class="sala-unirse">
          <label for="inputUnirseSala">🔗 Unirse a una sala compartida:</label>
          <div class="input-action-row">
            <input type="text" id="inputUnirseSala" class="input-control" maxlength="3" inputmode="numeric" placeholder="042">
            <button type="button" id="btnUnirseSala" class="btn btn-secondary btn-sm">Añadir</button>
          </div>
        </div>` : "";
      cont.innerHTML = unirse + (bloques.join("")
        || `<p class="salas-vacio">Aún no hay salas ni partidas guardadas ${this.db.esNube ? "en tu cuenta de la nube" : "en este navegador"}. Inicia una partida y pulsa 💾 Guardar para crear la primera sala.</p>`);
    } catch (err) {
      cont.innerHTML = `<p class="salas-vacio">⚠️ Error de base de datos: ${this.escaparHtml(err.message)}</p>`;
    }
  }

  handleSalasClick(e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.cargarPartida) { this.cargarPartidaGuardada(btn.dataset.cargarPartida); return; }
    if (btn.dataset.eliminarPartida) { this.confirmarBorrado(btn, () => this.borrarPartida(btn.dataset.eliminarPartida)); return; }
    if (btn.dataset.eliminarSala) { this.confirmarBorrado(btn, () => this.borrarSala(btn.dataset.eliminarSala)); return; }
    if (btn.id === "btnSalasConfirmGuardar") { this.confirmarGuardarEnSala(); return; }
    if (btn.id === "btnUnirseSala") { this.unirseASala(); return; }
    if (btn.dataset.salaCodigo) { this.seleccionarSala(btn.dataset.salaCodigo, btn); }
  }

  async unirseASala() {
    const input = document.getElementById("inputUnirseSala");
    const codigo = (input?.value || "").trim().padStart(3, "0");
    try {
      const sala = await this.db.unirseASala(codigo);
      this.log(`🔗 Sala ${sala.codigo} («${sala.nombre}») añadida a tu lista.`, "log-success");
      this.renderSalas();
    } catch (err) {
      this.log(`⚠️ No se pudo añadir la sala: ${err.message}`, "log-danger");
    }
  }

  seleccionarSala(codigo, btn) {
    this._salaSeleccionada = codigo;
    document.querySelectorAll("#salasContent .sala-card").forEach(c => c.classList.toggle("selected", c === btn));
    const form = document.getElementById("salaNuevaForm");
    if (form) form.classList.toggle("hidden", codigo !== "nueva");
    const confirmar = document.getElementById("btnSalasConfirmGuardar");
    if (confirmar) confirmar.disabled = false;
  }

  async confirmarGuardarEnSala() {
    const eleccion = this._salaSeleccionada;
    if (!eleccion) return;
    const input = document.getElementById("inputSalaNombre");
    const nombreNueva = input && !input.closest(".hidden") ? input.value.trim() : "";
    await this.guardarEnSala(eleccion, null, nombreNueva);
  }

  // Persiste el snapshot de la sesión en la base de datos. `codigoEleccion`
  // es un código de sala existente o "nueva" (crea sala con `nombreSalaNueva`);
  // `partidaIdExistente` actualiza el registro en sitio sin cambiar su código
  async guardarEnSala(codigoEleccion, partidaIdExistente, nombreSalaNueva = "") {
    try {
      let codigoSala = codigoEleccion;
      if (!codigoSala || codigoSala === "nueva") {
        const sala = await this.db.crearSala(nombreSalaNueva);
        codigoSala = sala.codigo;
      }
      const datos = {
        modo: this.mode202 ? "202" : "101",
        turno: this.turn,
        numJugadores: this.players.length,
        resumenJugadores: this.players.map(p => `${p.name}${p.isAI ? " (IA)" : ""}`).join(", "),
        estado: this.construirSnapshotPartida()
      };
      const res = await this.db.guardarPartida(codigoSala, datos, partidaIdExistente);
      this.currentSalaCodigo = codigoSala;
      this.currentPartidaId = res.id;
      this.cerrarSalasModal();
      this.log(res.esNueva
        ? `💾 Partida ${res.id} guardada en la sala ${codigoSala} (${this.players.length} jugadores).`
        : `💾 Partida ${res.id} actualizada (Turno ${this.turn}).`, "log-success");
    } catch (err) {
      this.log(`⚠️ No se pudo guardar la partida: ${err.message}`, "log-danger");
    }
  }

  async cargarPartidaGuardada(id) {
    try {
      const registro = await this.db.cargarPartida(id);
      if (!registro || !registro.estado || !Array.isArray(registro.estado.players) || registro.estado.players.length === 0) {
        this.log(`⚠️ La partida ${id} no pudo leerse de la base de datos.`, "log-danger");
        return;
      }
      this.restaurarSnapshot(registro.estado);
      this.currentSalaCodigo = registro.sala;
      this.currentPartidaId = registro.id;

      document.getElementById("welcomeScreen").classList.add("hidden");
      document.getElementById("btnWelcomeCancel").classList.add("hidden");
      this.cerrarSalasModal();
      this.log(`📂 Partida ${registro.id} cargada desde la sala ${registro.sala}.`, "log-warning");
      // Si el turno restaurado pertenece a un bot, reanudar su ejecución
      this.kickOffTurn();
    } catch (err) {
      this.log(`⚠️ Error al cargar la partida: ${err.message}`, "log-danger");
    }
  }

  // Reconstruye la sesión a partir de un snapshot guardado: reglamento, mercado
  // bursátil y jugadores (los bots se reinstancian como AIPlayer porque JSON
  // descarta prototipos). No arranca turnos: quien llama decide si reanuda.
  restaurarSnapshot(snap) {
    this.mode202 = !!snap.mode202;
    this.cardDeck = new CardDeck(this.mode202);

    if (snap.market) {
      this.market.turn = snap.market.turn || 1;
      (snap.market.stocks || []).forEach(savedStock => {
        const live = this.market.getStock(savedStock.symbol);
        if (live) {
          live.currentPrice = savedStock.currentPrice;
          live.history = savedStock.history || [savedStock.currentPrice];
          live.activePattern = savedStock.activePattern;
          live.patternIndex = savedStock.patternIndex || 0;
        }
      });
      this.market.optionsContracts = snap.market.optionsContracts || [];
      this.market.shortPositions = snap.market.shortPositions || [];
    }

    this.players = snap.players.map(p => {
      if (p.isAI) {
        const prof = PROFESSIONS.find(pr => pr.title === p.state.profession) || PROFESSIONS[0];
        const ai = new AIPlayer(p.name, p.profileKey, prof);
        ai.position = p.position || 0;
        ai.state = p.state;
        return ai;
      }
      return { ...p };
    });

    this.activePlayerIndex = Math.min(snap.activePlayerIndex || 0, this.players.length - 1);
    this.turn = snap.turn || 1;
    // Generación de partida: invalida temporizadores de IA de la sesión anterior
    this._gameGeneration = (this._gameGeneration || 0) + 1;

    this.updateModePill();
    this.refreshUI();

    // Restaurar visibilidad del botón de escape de la Carrera de la Rata
    // (multijugador: se evalúa al jugador activo, no al "primer humano")
    const active = this.activePlayer;
    const canExitNow = active && !active.isAI && active.state.canExitRatRace && !active.state.inFastTrack;
    document.getElementById("btnExitRatRace").classList.toggle("hidden", !canExitNow);
  }

  async borrarPartida(id) {
    try {
      await this.db.eliminarPartida(id);
      if (this.currentPartidaId === id) {
        this.currentPartidaId = null;
        this.currentSalaCodigo = null;
      }
      this.log(`🗑️ Partida ${id} eliminada de la base de datos.`, "log-warning");
      this.renderSalas();
    } catch (err) {
      this.log(`⚠️ No se pudo eliminar la partida: ${err.message}`, "log-danger");
    }
  }

  async borrarSala(codigo) {
    try {
      await this.db.eliminarSala(codigo);
      if (this.currentSalaCodigo === codigo) {
        this.currentPartidaId = null;
        this.currentSalaCodigo = null;
      }
      this.log(`🗑️ Sala ${codigo} eliminada junto con todas sus partidas.`, "log-warning");
      this.renderSalas();
    } catch (err) {
      this.log(`⚠️ No se pudo eliminar la sala: ${err.message}`, "log-danger");
    }
  }

  // Confirmación de borrado en dos pasos (sin confirm(), que bloquea la
  // automatización y la UX): el primer clic arma el botón y el segundo lo
  // ejecuta; se desarma solo tras 2.5 s sin actividad
  confirmarBorrado(btn, accion) {
    if (btn.dataset.armed === "1") {
      clearTimeout(Number(btn.dataset.timer || 0));
      accion();
      return;
    }
    btn.dataset.armed = "1";
    btn.dataset.labelOriginal = btn.textContent;
    btn.textContent = "¿Seguro?";
    btn.classList.add("armed");
    btn.dataset.timer = String(setTimeout(() => {
      btn.dataset.armed = "";
      btn.textContent = btn.dataset.labelOriginal;
      btn.classList.remove("armed");
    }, 2500));
  }

  escaparHtml(texto) {
    return String(texto).replace(/[&<>"']/g, c => (
      { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': "&#34;", "'": "&#39;" }[c]
    ));
  }

  formatearFecha(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  checkBankruptcyOrDebt(player) {
    if (player.state.cash < 0) {
      this.log(`⚠️ Alerta: Efectivo negativo ($${player.state.cash}). Debes pedir un préstamo bancario o vender activos para no caer en quiebra.`, "log-danger");
    }
  }

  declareWinner(player, reason) {
    this.launchConfetti(160);
    alert(`🏆 ¡VICTORIA! ${player.name} ha ganado la partida. ${reason}`);
    this.log(`🏆 ¡VICTORIA! ${player.name} ha ganado la partida. ${reason}`, "log-success");
  }

  log(msg, type = "log-info") {
    const stream = document.getElementById("gameLog");
    if (!stream) return;
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `[T${this.turn}] ${msg}`;
    stream.appendChild(entry);
    stream.scrollTop = stream.scrollHeight;
  }
}

// Inicializar la aplicación al cargar
window.addEventListener("DOMContentLoaded", () => {
  window.app = new CashflowApp();
});
