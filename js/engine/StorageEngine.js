// Motor de Persistencia Relacional SQLite / LocalStorage
export class StorageEngine {
  static SQLITE_SCHEMA = `
    -- Esquema Relacional de Persistencia para Flujo Maestro (Simulador de Libertad Financiera)
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      mode TEXT CHECK(mode IN ('101', '202')),
      turn_number INTEGER DEFAULT 1,
      is_finished INTEGER DEFAULT 0,
      winner_id TEXT
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      game_id TEXT,
      name TEXT NOT NULL,
      is_ai INTEGER DEFAULT 0,
      ai_profile TEXT,
      profession TEXT,
      cash INTEGER,
      salary INTEGER,
      passive_income INTEGER,
      total_expenses INTEGER,
      monthly_cashflow INTEGER,
      in_fast_track INTEGER DEFAULT 0,
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assets_ledger (
      id TEXT PRIMARY KEY,
      player_id TEXT,
      category TEXT,
      title TEXT,
      cost INTEGER,
      down_payment INTEGER,
      mortgage INTEGER,
      monthly_cashflow INTEGER,
      units INTEGER,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT,
      turn INTEGER,
      player_name TEXT,
      action_type TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- Salas de juego y partidas: implementadas en el navegador con IndexedDB
    -- (js/engine/SalasDB.js, base "codex_flujo_maestro_db") porque GitHub Pages
    -- solo sirve archivos estáticos. Este DDL documenta el modelo relacional
    -- equivalente para una futura migración a SQLite / Cloudflare D1.
    CREATE TABLE IF NOT EXISTS salas (
      codigo TEXT PRIMARY KEY CHECK(length(codigo) = 3),   -- '001'–'999'
      nombre TEXT NOT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS partidas (
      id TEXT PRIMARY KEY CHECK(length(id) = 7),           -- 'NNN-AAA' (sala + '-' + 3 letras)
      sala_codigo TEXT NOT NULL,
      version TEXT DEFAULT '2.1.0',
      modo TEXT CHECK(modo IN ('101', '202')),
      turno INTEGER DEFAULT 1,
      num_jugadores INTEGER,
      resumen_jugadores TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      estado_json TEXT NOT NULL,                           -- snapshot completo de la sesión
      FOREIGN KEY(sala_codigo) REFERENCES salas(codigo) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_partidas_sala ON partidas(sala_codigo);
  `;

  static STORAGE_KEY = "codex_cashflow_saved_game";

  static saveGame(gameState) {
    try {
      const serialized = JSON.stringify({
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        state: gameState
      });
      localStorage.setItem(this.STORAGE_KEY, serialized);
      return { success: true };
    } catch (err) {
      console.error("Error al guardar partida:", err);
      return { success: false, error: err.message };
    }
  }

  static loadGame() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error("Error al cargar partida:", err);
      return null;
    }
  }
}
