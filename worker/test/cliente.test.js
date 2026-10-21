// Integración cliente ↔ servidor: NubeSalasDB (frontend) contra el handler del
// Worker con D1 sobre node:sqlite. Ejecutar: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { handle } from "../src/index.js";
import { NubeSalasDB } from "../../js/engine/NubeSalasDB.js";

// localStorage mínimo para Node
globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};

const db = new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => db.prepare(sql).run(...args),
  _exec: () => db.prepare(sql).run(...args)
});
const env = {
  ALLOWED_ORIGINS: "",
  DB: { prepare: (s) => stmt(s), batch: async (l) => { db.exec("BEGIN"); l.forEach(s => s._exec()); db.exec("COMMIT"); } }
};
const fetchWorker = (url, init) => handle(new Request(url, init), env);

test("NubeSalasDB: dueño guarda y actualiza; invitado se une en solo lectura", async () => {
  const dueno = new NubeSalasDB("https://api.test", fetchWorker);
  assert.equal(await dueno.disponible(), true);

  const sala = await dueno.crearSala("Mesa Nube");
  assert.equal(sala.token, undefined, "el token no se expone a la UI");
  const datos = { modo: "202", turno: 3, numJugadores: 1, resumenJugadores: "Ana", estado: { players: [{ name: "Ana" }] } };
  const { id } = await dueno.guardarPartida(sala.codigo, datos);
  await dueno.guardarPartida(sala.codigo, { ...datos, turno: 9 }, id);
  assert.equal((await dueno.cargarPartida(id)).turno, 9);
  assert.equal((await dueno.listarSalas())[0].propia, true);

  // Otro navegador: sin token
  const tokenGuardado = localStorage.getItem("codex_nube_salas_v1");
  localStorage._d = {};
  const invitado = new NubeSalasDB("https://api.test", fetchWorker);
  await invitado.unirseASala(sala.codigo);
  const [s] = await invitado.listarSalas();
  assert.equal(s.propia, false);
  assert.equal((await invitado.listarPartidas(sala.codigo)).length, 1);
  await assert.rejects(invitado.guardarPartida(sala.codigo, datos), /solo lectura/);
  await invitado.eliminarSala(sala.codigo); // solo la quita de su lista
  assert.equal((await invitado.listarSalas()).length, 0);

  localStorage.setItem("codex_nube_salas_v1", tokenGuardado);
  assert.ok(await dueno.cargarPartida(id), "la sala sigue en la nube");
  await dueno.eliminarSala(sala.codigo);
  assert.equal(await dueno.cargarPartida(id), null);
});
