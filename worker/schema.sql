-- Esquema Cloudflare D1 (SQLite) de Flujo Maestro — Salas y Partidas en la nube
-- Equivalente 1:1 al modelo IndexedDB de js/engine/SalasDB.js y al DDL de
-- referencia StorageEngine.SQLITE_SCHEMA. Aplicar con:
--   npx wrangler d1 execute flujo-maestro-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS salas (
  codigo       TEXT PRIMARY KEY CHECK (length(codigo) = 3),   -- "001"–"999"
  nombre       TEXT NOT NULL,
  token_hash   TEXT NOT NULL,                                  -- SHA-256 del token de escritura
  creado       TEXT NOT NULL,
  actualizado  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partidas (
  id                 TEXT PRIMARY KEY CHECK (length(id) = 7),  -- "NNN-AAA"
  sala               TEXT NOT NULL REFERENCES salas(codigo) ON DELETE CASCADE,
  modo               TEXT NOT NULL CHECK (modo IN ('101', '202')),
  turno              INTEGER NOT NULL DEFAULT 1,
  num_jugadores      INTEGER NOT NULL DEFAULT 1,
  resumen_jugadores  TEXT NOT NULL DEFAULT '',
  estado             TEXT NOT NULL,                            -- snapshot JSON de la partida
  version            TEXT NOT NULL DEFAULT '2.1.0',
  creado             TEXT NOT NULL,
  actualizado        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partidas_sala ON partidas (sala, actualizado DESC);
