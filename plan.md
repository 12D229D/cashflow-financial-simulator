# 💰 Cashflow Financial Simulator — Plan de Desarrollo

> **Subproyecto:** `cashflow-financial-simulator`  
> **Categoría:** 🎮 Juego / 🪐 Simulador de Educación Financiera  
> **Inspiración / Reingeniería:** *CASHFLOW® 202 The E-Game* (cfgame.ru) de The Rich Dad Company  
> **Estado:** 🟢 Completado  

---

## 📌 Resumen Ejecutivo
`Cashflow Financial Simulator` es una reinvención web moderna, reactiva y de código abierto del clásico simulador de educación financiera *CASHFLOW 101 y 202*. Desarrollado tras la ingeniería inversa del motor original Win32/DirectDraw y sus contenedores de datos (`GA.dat`, `GD.dat`), este proyecto implementa fielmente la matemática contable (Estado de Resultados, Balance General, Apalancamiento, Flujo Pasivo), la dinámica del tablero de la Carrera de la Rata y la Vía Rápida, los modelos estocásticos de bolsa (patrones técnicos, opciones Call/Put, ventas en corto) y agentes de IA con diferentes perfiles de aversión al riesgo. Soporta partidas multijugador locales (*hot-seat*) de hasta 6 asientos combinando humanos y bots. Al cargar, una **pantalla de bienvenida** permite configurar la partida (reglamento y asientos humanos/IA) antes de entrar a la sesión de juego. De cara al público, el producto se presenta como **"Flujo Maestro — Simulador de Libertad Financiera"** (modos *Esencial* y *Avanzado*) por seguridad de marca: la UI no muestra las denominaciones registradas CASHFLOW® 101/202.

---

## 🎯 Objetivos
- [x] Realizar ingeniería inversa a los binarios, scripts y datasets de `CASHFLOW 202`.
- [x] Extraer las 10 profesiones oficiales con sus estados de ingresos/gastos y deudas originales.
- [x] Modelar las barajas completas de *Small Deals*, *Big Deals*, *The Market* y *Doodads*.
- [x] Implementar el motor de fluctuación bursátil 202 con patrones de análisis técnico (*Triangles*, *Head & Shoulders*, *Cup*, etc.).
- [x] Diseñar un tablero interactivo HTML5 Canvas con la Carrera de la Rata circular interna y la Vía Rápida perimetral.
- [x] Desarrollar la hoja de balance financiera automatizada en vivo con cálculo de liquidez, préstamos bancarios (10% mensual) y amortizaciones.
- [x] Crear bots de IA con los 5 perfiles heurísticos extraídos (`default`, `cautiousAI`, `risky`, `scared`, `smarter`).
- [x] Proveer persistencia local de partidas en LocalStorage (esquema relacional SQLite documentado como referencia en `StorageEngine.js`).
- [x] Multijugador local *hot-seat* de 1 a 6 jugadores: cada asiento configurable como humano o bot de IA (5 perfiles heurísticos).
- [x] Pantalla de Bienvenida y Configuración al inicio: el usuario elige reglamento (Esencial/Avanzado) y arma la mesa antes de entrar a la sesión de juego.
- [x] UI/UX Premium Glassmorphism con paleta HSL, tipografías Google Fonts (*Outfit* / *Inter*), microinteracciones y sin dependencias pesadas.

---

## 🏗️ Arquitectura

### Patrón Arquitectónico: SPA Reactiva + Motor de Simulación Desacoplado + Persistencia SQLite
El sistema sigue una arquitectura desacoplada basada en eventos (Event-Driven) en el frontend:
- **Presentation Layer (UI/UX)**: Tablero renderizado en Canvas de alta densidad de píxeles, paneles HTML5 semánticos y reactivos con diseño Glassmorphism y CSS puro.
- **Game Engine Core**:
  - `Board.js`: Controlador del grafo de casillas de la Carrera de la Rata (24 casillas) y la Vía Rápida (44 casillas).
  - `FinancialEngine.js`: Motor contable determinista e inmutable que gestiona el Cashflow mensual, ROI, deudas y la condición de escape.
  - `MarketEngine.js`: Simulador de series temporales y contratos de derivados (Calls, Puts, Shorts).
  - `CardDeck.js`: Máquina de reparto y barajado de eventos.
  - `AIPlayer.js`: Cerebro heurístico multivariable para bots autónomos.
- **Data & Storage Layer**:
  - Catálogos inmutables de profesiones, cartas y patrones técnicos.
  - Persistencia en SQLite relacional local (`cashflow.sqlite` / LocalStorage) que guarda partidas, perfiles de jugador y estadísticas.

### Estructura de Archivos
```text
cashflow-financial-simulator/
├── index.html                 # Interfaz visual principal (Tablero, Balance Sheet, Controles, Modal)
├── style.css                  # Sistema de diseño HSL Glassmorphism, animaciones y responsive
├── plan.md                    # Bitácora, arquitectura y estado del proyecto
├── js/
│   ├── app.js                 # Inicializador y controlador del ciclo de juego (Game Loop)
│   ├── engine/
│   │   ├── Board.js           # Geometría y lógica del tablero (Rat Race + Fast Track)
│   │   ├── FinancialEngine.js # Contabilidad en vivo, amortizaciones y cashflow
│   │   ├── MarketEngine.js    # Simulador estocástico de precios y derivados (202)
│   │   ├── CardDeck.js        # Barajas de Oportunidades, Mercado y Caprichos
│   │   ├── AIPlayer.js        # IA heurística (5 perfiles de decisión financiera)
│   │   └── StorageEngine.js   # Persistencia local relacional SQLite/JSON
│   └── data/
│       ├── professions.js     # Las 10 profesiones oficiales (Doctor, Conserje, etc.)
│       ├── cards101.js        # Oportunidades, mercado y caprichos básicos
│       ├── cards202.js        # Inversiones avanzadas, opciones y bienes raíces
│       └── stockPatterns.js   # Vectores de patrones técnicos y acciones
└── tests/
    └── simulation.test.js     # Tests unitarios automatizados para lógica financiera
```

### Flujo de Datos
1. El jugador selecciona o recibe aleatoriamente una Profesión y su Sueño en la Vía Rápida.
2. `FinancialEngine` computa los ingresos brutos, gastos fijos y cashflow inicial.
3. El jugador o la IA lanza los dados (`Board.rollDice()`), avanzando su ficha a la casilla objetivo.
4. Al caer en una casilla:
   - **Paycheck**: Recibe su Cashflow mensual acumulado.
   - **Opportunity**: Decide entre *Small Deal* o *Big Deal* según su liquidez y ROI deseado.
   - **Market**: El mercado fluctúa o se presentan compradores para activos existentes.
   - **Doodad / Downsized**: Deducción de efectivo forzada o pérdida de turnos.
5. Cada transacción recalcula en tiempo real el Balance General y el indicador de Salida de la Rata:
   $$\text{Ingreso Pasivo} > \text{Gastos Totales} \implies \text{Pase a la Vía Rápida}$$
6. En la Vía Rápida, el capital inicial se multiplica ($\text{Cashflow} \times 100$) y el objetivo pasa a ser adquirir el Sueño o generar $+\$50,000$/mes adicionales.

---

## 🧠 Paradigma de Programación

- **Paradigma Predominante**: **Híbrido (Orientado a Objetos + Funcional + Event-Driven)**.
  - **Orientado a Objetos (POO)**: Empleado para encapsular el estado y comportamiento de entidades del juego como `Player`, `AIPlayer`, `BoardSpace` y `Card`. Esto facilita la herencia entre jugadores humanos y bots de IA.
  - **Funcional & Inmutable**: El motor contable (`FinancialEngine`) opera con funciones puras para calcular balances, flujo neto e indicadores financieros a partir de estados dados, garantizando cero efectos secundarios indeseados en la contabilidad.
  - **Event-Driven (Reactivo)**: El bucle de eventos desacopla las acciones de los usuarios (lanzar dados, comprar activo, pedir préstamo) de la actualización visual del Canvas y los paneles de la UI.
- **Justificación**: Combina la claridad de modelar agentes e interfaces con la robustez y predictibilidad requerida en simulaciones matemáticas y financieras.

---

## 🌐 Propósito de Visibilidad y Destino Remoto

- **Visibilidad**: `Público (Open Source / Portafolio)`.
- **Plataforma Remota Asignada**: `GitHub`.
- **Plataforma de Despliegue CI/CD**: `GitHub Pages` / `Cloudflare Pages`.
- **Justificación**: Simulador de educación financiera de código abierto ("Flujo Maestro") sin dependencias de backend privado ni credenciales confidenciales; perfecto para acceso web universal y showcase interactivo en GitHub Pages.

---

## 📊 Estado Actual

### Tareas Completadas
- [x] Ingeniería inversa de `CASHFLOW 202.exe` y contenedores `.dat`.
- [x] Creación de `plan.md` con arquitectura, paradigmas y metas.
- [x] Implementación de datasets estructurados (`professions.js`, `cards101.js`, `cards202.js`, `stockPatterns.js`).
- [x] Implementación de motores core (`FinancialEngine.js`, `MarketEngine.js`, `Board.js`, `CardDeck.js`, `AIPlayer.js`, `StorageEngine.js`).
- [x] Creación de UI/UX (`index.html` semántico, `style.css` Glassmorphism HSL con canvas interactivo).
- [x] Batería de pruebas automatizadas (`tests/simulation.test.js`) con 33/33 pruebas aprobadas.
- [x] Registro en `PLANS-STATUS.md` de la raíz del monorrepo.
- [x] Re-branding público a **"Flujo Maestro — Simulador de Libertad Financiera"** (la UI no muestra las denominaciones registradas CASHFLOW® 101/202; los identificadores internos del código se conservan).
- [x] Capa de animación premium: aurora de fondo, monedas flotantes, *tween* de efectivo, confeti, dados animados y soporte `prefers-reduced-motion`.
- [x] Multijugador *hot-seat* 1–6 jugadores con diálogo de configuración de mesa (nombre, tipo humano/IA, profesión y perfil de IA por asiento), rotación de turnos y arranque automático de bots.
- [x] Eliminación del botón "🗄️ SQL Dump" y de la ruta de código `exportToSqliteScript()`; `SQLITE_SCHEMA` se conserva solo como documentación del modelo relacional.
- [x] Pantalla de Bienvenida y Configuración visible al cargar (hero de presentación, reglamento, asientos editables, 🚀 Iniciar Partida, 🎲 Mesa Rápida y ↩️ Volver a la Partida a mitad de juego).

---

## 🗒️ Bitácora de Cambios

### 2026-10-12 — Pantalla de Bienvenida y Configuración de Partida
- **Flujo de inicio:** al cargar la app, la pantalla de bienvenida (`#welcomeScreen`) sustituye al antiguo modal de configuración y aparece sobre el tablero en modo vista previa (mesa por defecto dibujada tras el cristal, dados deshabilitados, sin turnos activos). La sesión real de juego solo arranca al confirmar la configuración.
- **Tres entradas con semántica propia:** 🚀 *Iniciar Partida* (roster personalizado tal como quedó editado), 🎲 *Mesa Rápida* (mesa por defecto: 1 humano + 2 bots) y ↩️ *Volver a la Partida* (visible solo al reabrir la pantalla a mitad de juego: restaura dados y rótulo del turno sin agendar temporizadores ni reiniciar la mesa).
- **Reconfiguración en caliente:** 🎮 *Nueva Partida* reabre la bienvenida con el último roster como plantilla editable; la guarda de generación (`_gameGeneration`) hace seguro reconfigurar aunque un bot esté "pensando".
- **Estilo:** panel de cristal de 640 px con desplazamiento interno (`max-height: 92vh`), hero centrado con insignia dorada, título con degradado animado (reutiliza `titleShine`) y lista de características; sin keyframes nuevos, por lo que el *kill-switch* `prefers-reduced-motion` existente los cubre.
- **Verificación:** suite 33/33 con `node tests/simulation.test.js` y flujo completo probado en navegador: bienvenida visible al cargar con 3 asientos por defecto y tablero de vista previa; Mesa Rápida; reapertura a mitad de partida y vuelta sin reinicio; partida personalizada en Modo Avanzado con nombre propio y pestaña de bolsa visible; mesa 100 % IA autojugando desde la bienvenida; recarga final en estado prístino (un solo `<h1>`, sin residuos en LocalStorage, botón SQL ausente).

### 2026-10-12 — Multijugador, robustez de IA y limpieza de UI
- **Multijugador local (hot-seat):** nuevo diálogo "🎮 Configurar Partida Multijugador" con 1–6 asientos; cada asiento define nombre (máx. 24 caracteres), tipo (humano/IA), profesión y, para bots, perfil heurístico. `endTurn()` rota `activePlayerIndex`; al cerrar el ciclo (vuelta al asiento 0) incrementa la ronda y actualiza el mercado bursátil. Los bots juegan solos entre humanos y las mesas 100% IA funcionan como modo espectador.
- **`kickOffTurn()`:** centraliza el primer turno tras iniciar, reconfigurar o restaurar una partida: anuncia de inmediato al jugador activo en la pantalla compartida y, si es un bot, programa su jugada sin intervención humana (corrige la congelación cuando el asiento 1 era IA).
- **Guarda de generación (`_gameGeneration`):** cada `setTimeout` de IA captura la generación de la partida y se aborta si la partida se reinició o cargó mientras el bot "pensaba" — sin jugadas fantasma tras un reinicio.
- **Persistencia multijugador:** el guardado incluye la mesa completa (jugadores con perfil de IA, asiento activo, ronda, modo y snapshot del mercado con opciones y cortos); al cargar, los bots se reinstancian como `AIPlayer` a partir de su `profileKey`.
- **Retirada del volcado SQL:** se eliminó el botón "🗄️ SQL Dump" de la cabecera y el método `exportToSqliteScript()` de `StorageEngine.js`; el esquema `SQLITE_SCHEMA` permanece como documentación del modelo relacional subyacente.
- **Verificación:** suite 33/33 con `node tests/simulation.test.js` y verificación funcional en navegador: mesa de 4 (2 humanos + 2 IA) con rotación completa de 2 rondas; mesa 100% IA autojugando en cadena; ciclo guardar/cargar con restauración exacta y bots reinstanciados; conmutación ida y vuelta del Modo Avanzado (pill, botón y pestaña de mercado); fichas de todos los jugadores renderizadas en canvas (muestreo de píxeles por color); botón SQL ausente y recarga final en estado prístino.

### Sesión previa (consolidada) — Marca y animaciones
- Re-branding público a "Flujo Maestro — Simulador de Libertad Financiera" con modos *Esencial (Fundamental)* y *Avanzado (Opciones & Patrones)* por seguridad de marca (CASHFLOW® es marca registrada de The Rich Dad Company).
- Capa de animación: aurora de fondo, monedas flotantes, *tween* de efectivo, confeti al salir de la Carrera de la Rata y dados con animación de rebote, con *kill-switch* universal `prefers-reduced-motion`.
