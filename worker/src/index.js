// API Worker de Flujo Maestro — Salas y Partidas en Cloudflare D1
// ---------------------------------------------------------------
// Frontend estático en GitHub Pages + esta API serverless mínima.
// Seguridad:
//   • Cada sala nace con un token secreto de escritura (se devuelve UNA vez
//     al crearla; en D1 solo se guarda su hash SHA-256).
//   • Lectura pública por código (compartir «NNN» o «NNN-AAA» en la mesa);
//     crear/actualizar/borrar partidas o la sala exige `X-Sala-Token`.
//   • CORS restringido a ALLOWED_ORIGINS, validación estricta de formatos y
//     límite de tamaño del cuerpo.
//
// Rutas:
//   GET    /api/health
//   POST   /api/salas                      { nombre }        → sala + token
//   GET    /api/salas?codigos=001,002                        → salas con numPartidas
//   GET    /api/salas/:codigo
//   DELETE /api/salas/:codigo              (token)           → cascada de partidas
//   GET    /api/salas/:codigo/partidas                       → lista sin `estado`
//   POST   /api/salas/:codigo/partidas     (token) { datos } → { id, esNueva }
//   GET    /api/partidas/:id                                 → partida completa
//   PUT    /api/partidas/:id               (token) { datos } → { id, esNueva:false }
//   DELETE /api/partidas/:id               (token)

export const LETRAS_PARTIDA = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MAX_BODY_BYTES = 512 * 1024;
const RE_SALA = /^\d{3}$/;
const RE_PARTIDA = /^\d{3}-[A-Z]{3}$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- Utilidades ----------

const pad3 = (n) => String(n).padStart(3, "0");

function randomInt(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function nuevoToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(texto) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante de dos hashes hex de igual longitud
function igualSeguro(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const permitidos = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const h = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Sala-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (permitidos.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      ...cors
    }
  });
}

async function leerJson(request) {
  const largo = Number(request.headers.get("Content-Length") || 0);
  if (largo > MAX_BODY_BYTES) throw new HttpError(413, "La partida excede el tamaño máximo permitido (512 KB).");
  const texto = await request.text();
  if (texto.length > MAX_BODY_BYTES) throw new HttpError(413, "La partida excede el tamaño máximo permitido (512 KB).");
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    throw new HttpError(400, "Cuerpo JSON inválido.");
  }
}

// Normaliza y valida los datos de partida que envía el frontend
function validarDatosPartida(d) {
  if (!d || typeof d !== "object") throw new HttpError(400, "Datos de partida ausentes.");
  const modo = d.modo === "202" ? "202" : d.modo === "101" ? "101" : null;
  if (!modo) throw new HttpError(400, "`modo` debe ser '101' o '202'.");
  if (!d.estado || typeof d.estado !== "object" || !Array.isArray(d.estado.players) || d.estado.players.length === 0) {
    throw new HttpError(400, "`estado` debe incluir al menos un jugador.");
  }
  return {
    modo,
    turno: Math.max(1, Math.floor(Number(d.turno) || 1)),
    numJugadores: Math.min(6, Math.max(1, Math.floor(Number(d.numJugadores) || d.estado.players.length))),
    resumenJugadores: String(d.resumenJugadores || "").slice(0, 300),
    estado: JSON.stringify(d.estado)
  };
}

function filaPartida(r, conEstado) {
  const p = {
    id: r.id,
    sala: r.sala,
    modo: r.modo,
    turno: r.turno,
    numJugadores: r.num_jugadores,
    resumenJugadores: r.resumen_jugadores,
    version: r.version,
    creado: r.creado,
    actualizado: r.actualizado
  };
  if (conEstado) p.estado = JSON.parse(r.estado);
  return p;
}

async function exigirToken(env, request, codigoSala) {
  const sala = await env.DB.prepare("SELECT codigo, token_hash FROM salas WHERE codigo = ?").bind(codigoSala).first();
  if (!sala) throw new HttpError(404, "La sala no existe.");
  const token = request.headers.get("X-Sala-Token") || "";
  if (!token || !igualSeguro(await sha256(token), sala.token_hash)) {
    throw new HttpError(403, "Token de sala inválido: solo el creador de la sala puede modificarla.");
  }
  return sala;
}

// ---------- Controladores ----------

async function crearSala(env, request) {
  const body = await leerJson(request);
  const ocupados = new Set((await env.DB.prepare("SELECT codigo FROM salas").all()).results.map(r => r.codigo));
  const libres = [];
  for (let i = 1; i <= 999; i++) if (!ocupados.has(pad3(i))) libres.push(pad3(i));
  if (!libres.length) throw new HttpError(409, "No quedan códigos de sala disponibles (001–999).");
  const codigo = libres[randomInt(libres.length)];
  const nombre = String(body.nombre || "").trim().slice(0, 40) || `Sala ${codigo}`;
  const token = nuevoToken();
  const ahora = new Date().toISOString();
  await env.DB.prepare("INSERT INTO salas (codigo, nombre, token_hash, creado, actualizado) VALUES (?, ?, ?, ?, ?)")
    .bind(codigo, nombre, await sha256(token), ahora, ahora).run();
  return { codigo, nombre, creado: ahora, actualizado: ahora, numPartidas: 0, token };
}

async function listarSalas(env, url) {
  const codigos = String(url.searchParams.get("codigos") || "")
    .split(",").map(s => s.trim()).filter(c => RE_SALA.test(c)).slice(0, 100);
  if (!codigos.length) return [];
  const marcas = codigos.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT s.codigo, s.nombre, s.creado, s.actualizado, COUNT(p.id) AS numPartidas
       FROM salas s LEFT JOIN partidas p ON p.sala = s.codigo
      WHERE s.codigo IN (${marcas})
      GROUP BY s.codigo ORDER BY s.codigo`
  ).bind(...codigos).all();
  return results;
}

async function obtenerSala(env, codigo) {
  const s = await env.DB.prepare(
    `SELECT s.codigo, s.nombre, s.creado, s.actualizado, COUNT(p.id) AS numPartidas
       FROM salas s LEFT JOIN partidas p ON p.sala = s.codigo
      WHERE s.codigo = ? GROUP BY s.codigo`
  ).bind(codigo).first();
  if (!s) throw new HttpError(404, "La sala no existe.");
  return s;
}

async function crearPartida(env, request, codigoSala) {
  await exigirToken(env, request, codigoSala);
  const d = validarDatosPartida(await leerJson(request));
  const usados = new Set((await env.DB.prepare("SELECT id FROM partidas WHERE sala = ?").bind(codigoSala).all())
    .results.map(r => r.id.slice(4)));
  if (usados.size >= LETRAS_PARTIDA.length ** 3) throw new HttpError(409, "La sala alcanzó el máximo de partidas.");
  let sufijo;
  do {
    sufijo = [0, 1, 2].map(() => LETRAS_PARTIDA[randomInt(LETRAS_PARTIDA.length)]).join("");
  } while (usados.has(sufijo));
  const id = `${codigoSala}-${sufijo}`;
  const ahora = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO partidas (id, sala, modo, turno, num_jugadores, resumen_jugadores, estado, version, creado, actualizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, '2.1.0', ?, ?)`
    ).bind(id, codigoSala, d.modo, d.turno, d.numJugadores, d.resumenJugadores, d.estado, ahora, ahora),
    env.DB.prepare("UPDATE salas SET actualizado = ? WHERE codigo = ?").bind(ahora, codigoSala)
  ]);
  return { id, esNueva: true };
}

async function actualizarPartida(env, request, id) {
  const sala = id.slice(0, 3);
  await exigirToken(env, request, sala);
  const existe = await env.DB.prepare("SELECT id FROM partidas WHERE id = ?").bind(id).first();
  if (!existe) throw new HttpError(404, "La partida que se intenta actualizar ya no existe.");
  const d = validarDatosPartida(await leerJson(request));
  const ahora = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE partidas SET modo = ?, turno = ?, num_jugadores = ?, resumen_jugadores = ?, estado = ?, actualizado = ?
        WHERE id = ?`
    ).bind(d.modo, d.turno, d.numJugadores, d.resumenJugadores, d.estado, ahora, id),
    env.DB.prepare("UPDATE salas SET actualizado = ? WHERE codigo = ?").bind(ahora, sala)
  ]);
  return { id, esNueva: false };
}

// ---------- Enrutador ----------

export async function handle(request, env) {
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  const partes = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean); // ["api", ...]
  const m = request.method;

  try {
    if (partes[0] !== "api") throw new HttpError(404, "Ruta no encontrada.");
    const [, recurso, clave, sub] = partes;

    if (recurso === "health" && m === "GET") {
      return json({ ok: true, servicio: "flujo-maestro-api", version: "1.0.0" }, 200, cors);
    }

    if (recurso === "salas") {
      if (!clave) {
        if (m === "POST") return json(await crearSala(env, request), 201, cors);
        if (m === "GET") return json(await listarSalas(env, url), 200, cors);
      } else {
        if (!RE_SALA.test(clave)) throw new HttpError(400, "Código de sala inválido (NNN).");
        if (!sub) {
          if (m === "GET") return json(await obtenerSala(env, clave), 200, cors);
          if (m === "DELETE") {
            await exigirToken(env, request, clave);
            await env.DB.batch([
              env.DB.prepare("DELETE FROM partidas WHERE sala = ?").bind(clave),
              env.DB.prepare("DELETE FROM salas WHERE codigo = ?").bind(clave)
            ]);
            return json({ ok: true }, 200, cors);
          }
        } else if (sub === "partidas") {
          if (m === "GET") {
            await obtenerSala(env, clave);
            const { results } = await env.DB.prepare(
              "SELECT * FROM partidas WHERE sala = ? ORDER BY actualizado DESC"
            ).bind(clave).all();
            return json(results.map(r => filaPartida(r, false)), 200, cors);
          }
          if (m === "POST") return json(await crearPartida(env, request, clave), 201, cors);
        }
      }
    }

    if (recurso === "partidas" && clave) {
      if (!RE_PARTIDA.test(clave)) throw new HttpError(400, "Identificador de partida inválido (NNN-AAA).");
      if (m === "GET") {
        const r = await env.DB.prepare("SELECT * FROM partidas WHERE id = ?").bind(clave).first();
        if (!r) throw new HttpError(404, "La partida no existe.");
        return json(filaPartida(r, true), 200, cors);
      }
      if (m === "PUT") return json(await actualizarPartida(env, request, clave), 200, cors);
      if (m === "DELETE") {
        await exigirToken(env, request, clave.slice(0, 3));
        await env.DB.prepare("DELETE FROM partidas WHERE id = ?").bind(clave).run();
        return json({ ok: true }, 200, cors);
      }
    }

    throw new HttpError(404, "Ruta no encontrada.");
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    return json({ error: status === 500 ? "Error interno del servidor." : err.message }, status, cors);
  }
}

export default { fetch: handle };
