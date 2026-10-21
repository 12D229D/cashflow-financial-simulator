// Configuración de la API en la nube (Cloudflare Worker + D1)
// ---------------------------------------------------------------
// Deja API_BASE vacío para usar solo la base local del navegador (IndexedDB).
// Tras `npx wrangler deploy`, pega aquí la URL del Worker, por ejemplo:
//   "https://flujo-maestro-api.<tu-subdominio>.workers.dev"
// También puede forzarse por URL para pruebas: ?api=http://127.0.0.1:8787
export const API_BASE = "https://flujo-maestro-api.avalanchsecurity.workers.dev";

export function resolverApiBase() {
  try {
    const desdeUrl = new URLSearchParams(location.search).get("api");
    if (desdeUrl && /^https?:\/\/[\w.-]+(:\d+)?$/.test(desdeUrl)) return desdeUrl;
  } catch { /* entorno sin location (tests) */ }
  return API_BASE;
}
