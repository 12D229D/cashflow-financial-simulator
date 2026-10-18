// Base de Datos local de Salas de Juego y Partidas (IndexedDB)
// ---------------------------------------------------------------
// GitHub Pages solo sirve archivos estáticos, por lo que la persistencia vive
// en el navegador: IndexedDB implementa el modelo relacional documentado en
// StorageEngine.SQLITE_SCHEMA (tablas `salas` y `partidas`), de modo que el
// DDL es migrable 1:1 a SQLite / Cloudflare D1 si el proyecto añade backend.
//
//   salas    → clave primaria `codigo` de 3 dígitos ("001"–"999")
//   partidas → clave primaria `id` "NNN-AAA" (NNN = código de su sala,
//              AAA = 3 letras mayúsculas sin I ni O, únicas por sala)
import { StorageEngine } from './StorageEngine.js';

const DB_NAME = "codex_flujo_maestro_db";
const DB_VERSION = 1;
// Bandera de un sola vez: evita reimportar la partida legada de localStorage
const MIGRACION_FLAG = "codex_salas_migracion_v1";

// Alfabeto de 24 letras (sin I ni O) para evitar confusión con 1 y 0 en los
// códigos de partida que el usuario lee y comparte en la mesa
export const LETRAS_PARTIDA = "ABCDEFGHJKLMNPQRSTUVWXYZ";

// Rellena un número a código de sala de 3 dígitos ("001"–"999")
export function pad3(n) {
  return String(n).padStart(3, "0");
}

// Genera un código de sala de 3 dígitos, aleatorio entre los libres.
// `codigosOcupados` es la lista de códigos ya registrados; `rand` se inyecta
// para pruebas deterministas.
export function generaCodigoSala(codigosOcupados = [], rand = Math.random) {
  const ocupados = new Set(codigosOcupados);
  const libres = [];
  for (let i = 1; i <= 999; i++) {
    const codigo = pad3(i);
    if (!ocupados.has(codigo)) libres.push(codigo);
  }
  if (libres.length === 0) {
    throw new Error("No quedan códigos de sala disponibles (001–999 completos).");
  }
  return libres[Math.floor(rand() * libres.length)];
}

// Genera un sufijo de 3 letras mayúsculas no ocupado dentro de una sala
export function generaSufijoPartida(sufijosOcupados = [], rand = Math.random) {
  const ocupados = new Set(sufijosOcupados);
  const total = LETRAS_PARTIDA.length ** 3; // 24³ = 13.824 partidas por sala
  if (ocupados.size >= total) {
    throw new Error(`La sala ya registró el máximo de ${total} partidas.`);
  }
  const letras = LETRAS_PARTIDA;
  let sufijo = "";
  do {
    sufijo = letras[Math.floor(rand() * letras.length)]
      + letras[Math.floor(rand() * letras.length)]
      + letras[Math.floor(rand() * letras.length)];
  } while (ocupados.has(sufijo));
  return sufijo;
}

// Genera el identificador de partida "NNN-AAA": los 3 dígitos de la sala de
// destino, un guion medio y 3 letras mayúsculas únicas dentro de esa sala
export function generaCodigoPartida(codigoSala, sufijosOcupados = [], rand = Math.random) {
  return `${codigoSala}-${generaSufijoPartida(sufijosOcupados, rand)}`;
}

// Valida el formato canónico de identificador de partida
export function esIdPartidaValido(id) {
  return typeof id === "string" && /^\d{3}-[A-Z]{3}$/.test(id);
}

// Extrae el código de sala ("NNN") de un identificador de partida válido
export function salaDePartida(id) {
  return esIdPartidaValido(id) ? id.slice(0, 3) : null;
}

export class SalasDB {
  constructor() {
    this._dbPromise = null;
  }

  // Abre (o crea) la base con los almacenes `salas` y `partidas`; el índice
  // `por_sala` equivale a la clave foránea sala_codigo del esquema SQL
  open() {
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (evento) => {
          const db = evento.target.result;
          if (!db.objectStoreNames.contains("salas")) {
            db.createObjectStore("salas", { keyPath: "codigo" });
          }
          if (!db.objectStoreNames.contains("partidas")) {
            const partidas = db.createObjectStore("partidas", { keyPath: "id" });
            partidas.createIndex("por_sala", "sala", { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this._dbPromise;
  }

  // Ejecuta una operación sobre un almacén en una transacción y resuelve con
  // el resultado de la solicitud IDB cuando la transacción completa
  async _ejecutar(nombreStore, modo, operacion) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nombreStore, modo);
      let resultado;
      const req = operacion(tx.objectStore(nombreStore));
      if (req) req.onsuccess = () => { resultado = req.result; };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(resultado);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Salas ordenadas por código, cada una con su conteo de partidas
  listarSalas() {
    return this._ejecutarMultiple(["salas", "partidas"], "readonly", (stores) => {
      return [stores.salas.getAll(), stores.partidas.getAll()];
    }).then(([salas, partidas]) => {
      const conteo = {};
      partidas.forEach(p => { conteo[p.sala] = (conteo[p.sala] || 0) + 1; });
      return salas
        .map(s => ({ ...s, numPartidas: conteo[s.codigo] || 0 }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo));
    });
  }

  // Transacción genérica sobre varios almacenes a la vez
  async _ejecutarMultiple(nombresStores, modo, planificar) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(nombresStores, modo);
      const stores = {};
      nombresStores.forEach(n => { stores[n] = tx.objectStore(n); });
      const resultados = planificar(stores);
      const valores = resultados.map(() => undefined);
      resultados.forEach((req, i) => {
        if (req) req.onsuccess = () => { valores[i] = req.result; };
      });
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.oncomplete = () => resolve(valores);
    });
  }

  obtenerSala(codigo) {
    return this._ejecutar("salas", "readonly", s => s.get(codigo));
  }

  // Crea una sala con un código de 3 dígitos libre y nombre opcional
  async crearSala(nombre = "") {
    const existentes = await this.listarSalas();
    const codigo = generaCodigoSala(existentes.map(s => s.codigo));
    const ahora = new Date().toISOString();
    const registro = {
      codigo,
      nombre: String(nombre).trim() || `Sala ${codigo}`,
      creado: ahora,
      actualizado: ahora
    };
    await this._ejecutar("salas", "readwrite", s => s.put(registro));
    return { ...registro, numPartidas: 0 };
  }

  // Guarda (o actualiza) la partida `datos` dentro de la sala indicada.
  // Con partidaIdExistente actualiza ese registro en sitio (mismo "NNN-AAA");
  // sin él genera un identificador nuevo y único en la sala.
  async guardarPartida(codigoSala, datos, partidaIdExistente = null) {
    const ahora = new Date().toISOString();
    const sala = await this.obtenerSala(codigoSala);
    if (!sala) throw new Error("La sala seleccionada ya no existe en la base de datos.");

    if (partidaIdExistente) {
      const previo = await this.cargarPartida(partidaIdExistente);
      if (!previo) throw new Error("La partida que se intenta actualizar ya no existe.");
      const registro = { ...previo, ...datos, actualizado: ahora };
      await this._ejecutarMultiple(["salas", "partidas"], "readwrite", (stores) => {
        return [stores.partidas.put(registro), stores.salas.put({ ...sala, actualizado: ahora })];
      });
      return { id: registro.id, esNueva: false };
    }

    const enSala = await this.listarPartidas(codigoSala);
    const id = generaCodigoPartida(codigoSala, enSala.map(p => p.id.slice(4)));
    const registro = { id, sala: codigoSala, creado: ahora, actualizado: ahora, version: "2.1.0", ...datos };
    await this._ejecutarMultiple(["salas", "partidas"], "readwrite", (stores) => {
      return [stores.partidas.put(registro), stores.salas.put({ ...sala, actualizado: ahora })];
    });
    return { id, esNueva: true };
  }

  listarPartidas(codigoSala) {
    return this._ejecutar("partidas", "readonly", s => s.index("por_sala").getAll(codigoSala))
      .then(lista => lista.sort((a, b) => (b.actualizado || "").localeCompare(a.actualizado || "")));
  }

  cargarPartida(id) {
    return this._ejecutar("partidas", "readonly", s => s.get(id));
  }

  eliminarPartida(id) {
    return this._ejecutar("partidas", "readwrite", s => s.delete(id));
  }

  // Elimina la sala y, en la misma transacción, todas sus partidas
  eliminarSala(codigo) {
    return this._ejecutarMultiple(["salas", "partidas"], "readwrite", (stores) => {
      const partidasStore = stores.partidas;
      const clavesReq = partidasStore.index("por_sala").getAllKeys(codigo);
      clavesReq.onsuccess = () => {
        clavesReq.result.forEach(id => partidasStore.delete(id));
      };
      return [stores.salas.delete(codigo)];
    });
  }

  // Importa una única vez la partida del sistema legado de localStorage
  // (StorageEngine) a la base de datos, creando la sala "Partida Importada".
  // La bandera en localStorage evita reintentos en cada arranque.
  async migrarGuardadoLegado() {
    try {
      if (localStorage.getItem(MIGRACION_FLAG)) return { migrada: false };
      const legado = StorageEngine.loadGame();
      const snap = legado && legado.state;
      if (!snap || !Array.isArray(snap.players) || snap.players.length === 0) {
        localStorage.setItem(MIGRACION_FLAG, "1");
        return { migrada: false };
      }
      const sala = await this.crearSala("Partida Importada");
      const datos = {
        modo: snap.mode202 ? "202" : "101",
        turno: snap.turn || 1,
        numJugadores: snap.players.length,
        resumenJugadores: snap.players.map(p => p.name).join(", "),
        estado: snap
      };
      const { id } = await this.guardarPartida(sala.codigo, datos);
      localStorage.setItem(MIGRACION_FLAG, "1");
      return { migrada: true, sala: sala.codigo, id };
    } catch (err) {
      console.error("Migración de partida legada falló:", err);
      return { migrada: false, error: err.message };
    }
  }
}
