// Base de Datos de Salas y Partidas en la Nube (API Worker + Cloudflare D1)
// ---------------------------------------------------------------
// Misma interfaz pública que SalasDB (IndexedDB) para que app.js pueda usar
// cualquiera de las dos sin cambios. Los tokens de escritura de las salas
// creadas en este navegador y los códigos de salas a las que el usuario se
// unió se recuerdan en localStorage (las salas de la nube son compartidas:
// el listado muestra solo las propias o las añadidas por código).
import { esIdPartidaValido } from './SalasDB.js';

const CLAVE_SALAS = "codex_nube_salas_v1"; // { "042": { token: "..."|null } }

export class NubeSalasDB {
  constructor(apiBase, fetchImpl = (...a) => fetch(...a)) {
    this.apiBase = apiBase.replace(/\/+$/, "");
    this._fetch = fetchImpl;
    this.esNube = true;
  }

  // ---- Registro local de salas conocidas ----
  _conocidas() {
    try { return JSON.parse(localStorage.getItem(CLAVE_SALAS)) || {}; } catch { return {}; }
  }
  _recordar(codigo, token = null) {
    const m = this._conocidas();
    m[codigo] = { token: token || (m[codigo] && m[codigo].token) || null };
    localStorage.setItem(CLAVE_SALAS, JSON.stringify(m));
  }
  _olvidar(codigo) {
    const m = this._conocidas();
    delete m[codigo];
    localStorage.setItem(CLAVE_SALAS, JSON.stringify(m));
  }
  esPropietario(codigo) {
    const s = this._conocidas()[codigo];
    return !!(s && s.token);
  }

  async _pedir(metodo, ruta, cuerpo, codigoSala) {
    const headers = {};
    if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
    const token = codigoSala && this._conocidas()[codigoSala]?.token;
    if (token) headers["X-Sala-Token"] = token;
    const res = await this._fetch(`${this.apiBase}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status} de la API en la nube.`);
    return data;
  }

  // Comprueba si la API responde (timeout corto para no bloquear el arranque)
  async disponible(ms = 3500) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      const res = await this._fetch(`${this.apiBase}/api/health`, { signal: ctrl.signal });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ---- Interfaz compatible con SalasDB ----
  async listarSalas() {
    const codigos = Object.keys(this._conocidas());
    if (!codigos.length) return [];
    const salas = await this._pedir("GET", `/api/salas?codigos=${codigos.join(",")}`);
    // Salas borradas por su dueño desde otro dispositivo: se olvidan
    const vivas = new Set(salas.map(s => s.codigo));
    codigos.filter(c => !vivas.has(c)).forEach(c => this._olvidar(c));
    return salas.map(s => ({ ...s, propia: this.esPropietario(s.codigo) }));
  }

  async obtenerSala(codigo) {
    try { return await this._pedir("GET", `/api/salas/${codigo}`); } catch { return null; }
  }

  async crearSala(nombre = "") {
    const sala = await this._pedir("POST", "/api/salas", { nombre: String(nombre).trim() });
    this._recordar(sala.codigo, sala.token);
    const { token, ...publica } = sala;
    return publica;
  }

  // Añade a "mis salas" una sala compartida por otro jugador (solo lectura)
  async unirseASala(codigo) {
    if (!/^\d{3}$/.test(codigo)) throw new Error("El código de sala debe tener 3 dígitos (ej. 042).");
    const sala = await this._pedir("GET", `/api/salas/${codigo}`);
    this._recordar(codigo);
    return sala;
  }

  async guardarPartida(codigoSala, datos, partidaIdExistente = null) {
    if (!this.esPropietario(codigoSala)) {
      throw new Error(`La sala ${codigoSala} es de solo lectura en este navegador (no eres su creador). Guarda en una sala propia.`);
    }
    if (partidaIdExistente) {
      return this._pedir("PUT", `/api/partidas/${partidaIdExistente}`, datos, codigoSala);
    }
    return this._pedir("POST", `/api/salas/${codigoSala}/partidas`, datos, codigoSala);
  }

  listarPartidas(codigoSala) {
    return this._pedir("GET", `/api/salas/${codigoSala}/partidas`);
  }

  cargarPartida(id) {
    if (!esIdPartidaValido(id)) return Promise.resolve(null);
    return this._pedir("GET", `/api/partidas/${id}`).catch(() => null);
  }

  eliminarPartida(id) {
    return this._pedir("DELETE", `/api/partidas/${id}`, undefined, id.slice(0, 3));
  }

  // El dueño borra la sala en la nube; un invitado solo la quita de su lista
  async eliminarSala(codigo) {
    if (this.esPropietario(codigo)) await this._pedir("DELETE", `/api/salas/${codigo}`, undefined, codigo);
    this._olvidar(codigo);
  }

  // La migración del guardado legado solo aplica a la base local
  async migrarGuardadoLegado() {
    return { migrada: false };
  }
}
