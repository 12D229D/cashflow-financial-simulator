export const RAT_RACE_SPACES = [
  { id: 0, type: "PAYCHECK", label: "Día de Pago", color: "#facc15", icon: "💵" },
  { id: 1, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 2, type: "MARKET", label: "El Mercado", color: "#38bdf8", icon: "📈" },
  { id: 3, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 4, type: "DOODAD", label: "Capricho", color: "#f43f5e", icon: "🛍️" },
  { id: 5, type: "CHARITY", label: "Caridad", color: "#fb923c", icon: "🤝" },
  { id: 6, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 7, type: "PAYCHECK", label: "Día de Pago", color: "#facc15", icon: "💵" },
  { id: 8, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 9, type: "MARKET", label: "El Mercado", color: "#38bdf8", icon: "📈" },
  { id: 10, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 11, type: "DOODAD", label: "Capricho", color: "#f43f5e", icon: "🛍️" },
  { id: 12, type: "DOWNSIZED", label: "Despido", color: "#64748b", icon: "📉" },
  { id: 13, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 14, type: "PAYCHECK", label: "Día de Pago", color: "#facc15", icon: "💵" },
  { id: 15, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 16, type: "MARKET", label: "El Mercado", color: "#38bdf8", icon: "📈" },
  { id: 17, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 18, type: "DOODAD", label: "Capricho", color: "#f43f5e", icon: "🛍️" },
  { id: 19, type: "BABY", label: "¡Nuevo Bebé!", color: "#ec4899", icon: "👶" },
  { id: 20, type: "OPPORTUNITY", label: "Oportunidad", color: "#22c55e", icon: "🎯" },
  { id: 21, type: "PAYCHECK", label: "Día de Pago", color: "#facc15", icon: "💵" },
  { id: 22, type: "MARKET", label: "El Mercado", color: "#38bdf8", icon: "📈" },
  { id: 23, type: "DOODAD", label: "Capricho", color: "#f43f5e", icon: "🛍️" }
];

export const FAST_TRACK_SPACES = [
  { id: 0, type: "CASH_FLOW_DAY", label: "Día de Flujo Vía Rápida", color: "#10b981", icon: "💰" },
  { id: 1, type: "FT_BUSINESS", label: "Franquicia Hotelera", cost: 150000, cashflow: 6000, icon: "🏨" },
  { id: 2, type: "DREAM_SPACE", dreamId: "dream_1", label: "Fundación Médica", cost: 250000, icon: "🎗️" },
  { id: 3, type: "FT_BUSINESS", label: "Parque Eólico Solar", cost: 200000, cashflow: 8500, icon: "⚡" },
  { id: 4, type: "FT_LAWSUIT", label: "Demanda Judicial", cost: 50000, icon: "⚖️" },
  { id: 5, type: "FT_BUSINESS", label: "Centro Comercial Prime", cost: 300000, cashflow: 12000, icon: "🏬" },
  { id: 6, type: "DREAM_SPACE", dreamId: "dream_2", label: "Super Yate de Lujo", cost: 350000, icon: "🛥️" },
  { id: 7, type: "CASH_FLOW_DAY", label: "Día de Flujo Vía Rápida", color: "#10b981", icon: "💰" },
  { id: 8, type: "FT_BUSINESS", label: "Cadena de Bio-Farmacias", cost: 180000, cashflow: 7500, icon: "💊" },
  { id: 9, type: "DREAM_SPACE", dreamId: "dream_3", label: "Reserva Safari en África", cost: 400000, icon: "🦁" },
  { id: 10, type: "FT_TAX_AUDIT", label: "Auditoría Fiscal", cost: 60000, icon: "📑" },
  { id: 11, type: "FT_BUSINESS", label: "Flota de Jets Privados", cost: 400000, cashflow: 18000, icon: "✈️" },
  { id: 12, type: "DREAM_SPACE", dreamId: "dream_4", label: "Vuelo Orbital Espacial", cost: 300000, icon: "🚀" },
  { id: 13, type: "CASH_FLOW_DAY", label: "Día de Flujo Vía Rápida", color: "#10b981", icon: "💰" },
  { id: 14, type: "FT_BUSINESS", label: "Desarrollo Inmobiliario 100 U", cost: 500000, cashflow: 25000, icon: "🏙️" },
  { id: 15, type: "DREAM_SPACE", dreamId: "dream_6", label: "Isla Tropical Privada", cost: 500000, icon: "🏝️" }
];

export class Board {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.ratRaceSpaces = RAT_RACE_SPACES;
    this.fastTrackSpaces = FAST_TRACK_SPACES;
  }

  rollDice(hasCharity = false) {
    const diceCount = hasCharity ? 2 : 1;
    const rolls = [];
    for (let i = 0; i < diceCount; i++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    const total = rolls.reduce((a, b) => a + b, 0);
    return { rolls, total };
  }

  movePlayer(currentPosition, steps, inFastTrack = false) {
    const track = inFastTrack ? this.fastTrackSpaces : this.ratRaceSpaces;
    const previous = currentPosition;
    const next = (currentPosition + steps) % track.length;
    
    // Verificar si pasó por la casilla Paycheck en la Carrera de la Rata
    let passedPaycheck = false;
    if (!inFastTrack) {
      for (let i = 1; i <= steps; i++) {
        const checkPos = (previous + i) % track.length;
        if (track[checkPos].type === "PAYCHECK") {
          passedPaycheck = true;
          break;
        }
      }
    }

    return {
      newPosition: next,
      space: track[next],
      passedPaycheck
    };
  }

  render(players = [], activePlayerIndex = 0) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Fondo del tablero espacial/financiero con gradiente radial sutil
    const bgGradient = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, width / 2);
    bgGradient.addColorStop(0, "hsl(222, 47%, 14%)");
    bgGradient.addColorStop(1, "hsl(224, 71%, 6%)");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 1. Dibujar Vía Rápida (Anillo Exterior)
    const ftRadius = Math.min(width, height) * 0.42;
    const ftSpaceCount = this.fastTrackSpaces.length;

    ctx.save();
    ctx.strokeStyle = "hsla(160, 84%, 39%, 0.25)";
    ctx.lineWidth = 44;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ftRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < ftSpaceCount; i++) {
      const angle = (i / ftSpaceCount) * (Math.PI * 2) - Math.PI / 2;
      const x = centerX + Math.cos(angle) * ftRadius;
      const y = centerY + Math.sin(angle) * ftRadius;
      const space = this.fastTrackSpaces[i];

      // Espacio Vía Rápida
      ctx.save();
      ctx.fillStyle = space.type === "DREAM_SPACE" ? "#eab308" : (space.type.includes("LAWSUIT") || space.type.includes("AUDIT") ? "#ef4444" : "#10b981");
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.stroke();

      ctx.font = "14px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(space.icon, x, y);
      ctx.restore();
    }

    // 2. Dibujar Carrera de la Rata (Anillo Central)
    const rrRadius = Math.min(width, height) * 0.26;
    const rrSpaceCount = this.ratRaceSpaces.length;

    ctx.save();
    ctx.strokeStyle = "hsla(217, 91%, 60%, 0.15)";
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.arc(centerX, centerY, rrRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < rrSpaceCount; i++) {
      const angle = (i / rrSpaceCount) * (Math.PI * 2) - Math.PI / 2;
      const x = centerX + Math.cos(angle) * rrRadius;
      const y = centerY + Math.sin(angle) * rrRadius;
      const space = this.ratRaceSpaces[i];

      ctx.save();
      ctx.fillStyle = space.color;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.stroke();

      ctx.font = "12px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(space.icon, x, y);
      ctx.restore();
    }

    // Centro decorativo: "Rat Race Wheel"
    ctx.save();
    ctx.fillStyle = "hsla(220, 30%, 15%, 0.8)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "hsla(45, 93%, 47%, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 13px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FLUJO MAESTRO", centerX, centerY - 8);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px Inter, sans-serif";
    ctx.fillText("Libertad Financiera", centerX, centerY + 10);
    ctx.restore();

    // 3. Renderizar fichas de los jugadores
    players.forEach((p, idx) => {
      const isFast = p.state.inFastTrack;
      const radius = isFast ? ftRadius : rrRadius;
      const count = isFast ? ftSpaceCount : rrSpaceCount;
      const angle = (p.position / count) * (Math.PI * 2) - Math.PI / 2;
      
      // Separación de fichas si caen en la misma casilla
      const offsetRadius = radius + (idx * 6 - 8);
      const px = centerX + Math.cos(angle) * offsetRadius;
      const py = centerY + Math.sin(angle) * offsetRadius;

      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color || "#38bdf8";

      ctx.fillStyle = p.color || "#38bdf8";
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      if (idx === activePlayerIndex) {
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.font = "bold 10px Inter, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.name ? p.name.charAt(0).toUpperCase() : `${idx + 1}`, px, py);
      ctx.restore();
    });
  }
}
