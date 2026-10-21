# Flujo Maestro — API Worker (Cloudflare Workers + D1)

API serverless mínima que guarda **salas** y **partidas** en Cloudflare D1 (SQLite) para el frontend estático de GitHub Pages.

## Despliegue (una sola vez)

```bash
cd cashflow-financial-simulator/worker
npm install
npx wrangler login
npx wrangler d1 create flujo-maestro-db      # copia el database_id en wrangler.toml
npm run db:init:remote                       # aplica schema.sql
npm run deploy                               # → https://flujo-maestro-api.<subdominio>.workers.dev
```

Luego pega la URL en [`../js/config.js`](../js/config.js) (`API_BASE`) y publica en GitHub Pages.
Para probar sin modificar config: `https://12d229d.github.io/cashflow-financial-simulator/?api=https://flujo-maestro-api.<subdominio>.workers.dev`

## Desarrollo local

```bash
npm run db:init:local && npm run dev         # API en http://127.0.0.1:8787
# Frontend: servir la carpeta padre en :8080 y abrir http://localhost:8080/?api=http://127.0.0.1:8787
npm test                                     # pruebas con node:sqlite (Node 22.5+), sin wrangler
```

## Seguridad

- Cada sala recibe un **token secreto** al crearse (guardado solo en el navegador del creador; D1 almacena su hash SHA-256).
- Lectura pública por código (`NNN` / `NNN-AAA`); escritura y borrado exigen `X-Sala-Token`.
- CORS limitado a `ALLOWED_ORIGINS`, validación de formatos y límite de 512 KB por partida.
- Plan gratuito de Workers/D1: 100k peticiones/día y 5 GB de D1 — suficiente para el uso educativo.
