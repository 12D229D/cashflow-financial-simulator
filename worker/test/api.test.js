// Pruebas de integración del API Worker con un adaptador D1 sobre node:sqlite
// (SQLite real en memoria, mismo dialecto que Cloudflare D1).
// Ejecutar: node --test test/   (Node 22.5+)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { handle } from "../src/index.js";

// Adaptador mínimo de la API de D1 (prepare/bind/first/all/run/batch)
function crearD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => db.prepare(sql).run(...args),
    _exec: () => db.prepare(sql).run(...args)
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (lista) => {
      db.exec("BEGIN");
      try { lista.forEach(s => s._exec()); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
    }
  };
}

const ORIGEN = "https://12d229d.github.io";
const env = { DB: crearD1(), ALLOWED_ORIGINS: ORIGEN };

async function api(method, path, body, token) {
  const headers = { Origin: ORIGEN, "Content-Type": "application/json" };
  if (token) headers["X-Sala-Token"] = token;
  const res = await handle(new Request(`https://api.test${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  }), env);
  return { status: res.status, cors: res.headers.get("Access-Control-Allow-Origin"), data: await res.json() };
}

const partida = (turno = 1) => ({
  modo: "101", turno, numJugadores: 2, resumenJugadores: "Ana, Bot (IA)",
  estado: { mode202: false, turn: turno, players: [{ name: "Ana" }, { name: "Bot", isAI: true }] }
});

test("flujo completo: sala → partida → actualizar → listar → borrar", async () => {
  const h = await api("GET", "/api/health");
  assert.equal(h.status, 200);
  assert.equal(h.cors, ORIGEN);

  const sala = await api("POST", "/api/salas", { nombre: "Mesa de los martes" });
  assert.equal(sala.status, 201);
  assert.match(sala.data.codigo, /^\d{3}$/);
  assert.equal(sala.data.token.length, 48);
  const { codigo, token } = sala.data;

  const sinToken = await api("POST", `/api/salas/${codigo}/partidas`, partida());
  assert.equal(sinToken.status, 403);

  const nueva = await api("POST", `/api/salas/${codigo}/partidas`, partida(), token);
  assert.equal(nueva.status, 201);
  assert.match(nueva.data.id, new RegExp(`^${codigo}-[A-HJ-NP-Z]{3}$`));

  const upd = await api("PUT", `/api/partidas/${nueva.data.id}`, partida(7), token);
  assert.deepEqual(upd.data, { id: nueva.data.id, esNueva: false });

  const leida = await api("GET", `/api/partidas/${nueva.data.id}`);
  assert.equal(leida.data.turno, 7);
  assert.equal(leida.data.estado.players.length, 2);

  const lista = await api("GET", `/api/salas/${codigo}/partidas`);
  assert.equal(lista.data.length, 1);
  assert.equal(lista.data[0].estado, undefined, "la lista no debe incluir el snapshot pesado");

  const salas = await api("GET", `/api/salas?codigos=${codigo},999x`);
  assert.equal(salas.data[0].numPartidas, 1);

  assert.equal((await api("DELETE", `/api/salas/${codigo}`, null, "malo")).status, 403);
  assert.equal((await api("DELETE", `/api/salas/${codigo}`, null, token)).status, 200);
  assert.equal((await api("GET", `/api/partidas/${nueva.data.id}`)).status, 404);
});

test("validaciones: formatos, datos de partida y CORS", async () => {
  assert.equal((await api("GET", "/api/partidas/12-ABC")).status, 400);
  assert.equal((await api("GET", "/api/salas/abc")).status, 400);
  const { data: { codigo, token } } = await api("POST", "/api/salas", {});
  const mala = await api("POST", `/api/salas/${codigo}/partidas`, { modo: "303", estado: {} }, token);
  assert.equal(mala.status, 400);

  const res = await handle(new Request("https://api.test/api/health", { headers: { Origin: "https://malicioso.com" } }), env);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
});
