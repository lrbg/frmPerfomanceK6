# frmPerformanceK6

Framework de pruebas de performance automatizadas con **menu interactivo**, **reportes HTML**, **historico unificado** y ejecucion en **CI/CD (GitHub Actions)**. Soporta dos motores intercambiables (**k6** y **JMeter**) y dos plataformas (**web** y **API**).

## Que hace

- Menu para elegir motor, plataforma, tipo de prueba y target.
- 5 tipos de prueba estandar: **smoke, load, stress, spike, soak**.
- Genera un reporte HTML por corrida y un dashboard historico que junta k6 y JMeter lado a lado.
- Umbrales configurables (p95 y tasa de error) que actuan como **gate**: si se cruzan, la ejecucion falla (codigo 1), util en pipelines.
- Corre igual en local (menu) que en GitHub Actions (por flags).

## Requisitos

- Node.js 18+
- [k6](https://k6.io/docs/get-started/installation/) si vas a usar el motor k6
- [JMeter](https://jmeter.apache.org/download_jmeter.cgi) 5.x en el PATH si vas a usar JMeter

```bash
npm install
```

## Uso interactivo (menu)

```bash
npm start
```

```
? Motor de pruebas   k6
? Plataforma         Web
? Tipo de prueba     Load - carga esperada en operacion normal
? Target             demo (https://test.k6.io)
```

## Uso no-interactivo (CI/CD)

```bash
node bin/perf.js --tool k6 --platform web --type load --target demo
node bin/perf.js --tool jmeter --platform api --type stress --target https://mi-api.com/health
```

`--target` acepta un **nombre** definido en `perf.config.json` o una **URL completa**.

## Configuracion

`perf.config.json`:

```json
{
  "targets": {
    "web": { "demo": "https://test.k6.io", "staging": "https://..." },
    "api": { "demo": "https://httpbin.test.k6.io/get" }
  },
  "thresholds": { "p95_ms": 800, "error_rate": 0.01 },
  "jmeter": { "binary": "jmeter" }
}
```

Los perfiles de carga de cada tipo de prueba estan en [`src/profiles.js`](src/profiles.js) (VUs y duracion para k6; threads/ramp-up/duracion para JMeter). Agregar un tipo nuevo es una entrada mas en ese objeto.

## Reportes e historico

- Cada corrida se guarda en `reports/runs/<fecha>-<motor>-<tipo>-<plataforma>/` con su `report.html` y `summary.json`.
- `reports/index.json` es la fuente de verdad del historico.
- `reports/index.html` es el dashboard generado (tabla + grafica de p95 + filtros por motor y tipo).
- Para regenerar el dashboard sin correr una prueba: `npm run report`.

Publicable con **GitHub Pages** apuntando a `/reports`.

## GitHub Actions

El workflow [`.github/workflows/performance.yml`](.github/workflows/performance.yml) se dispara manualmente (`workflow_dispatch`) eligiendo motor, plataforma, tipo y target desde la UI de Actions. Instala el motor elegido, corre la prueba, sube el reporte como artifact y commitea el historico de regreso al repo.

## Estructura

```
bin/perf.js              CLI (menu + flags)
src/menu.js              resuelve opciones (interactivo o flags)
src/profiles.js          perfiles de carga por tipo (datos)
src/orchestrator.js      corre motor -> reporte -> historico -> dashboard
src/runner/              k6Runner.js, jmeterRunner.js
src/report/              buildReport.js (por corrida), buildIndex.js (dashboard)
tests/k6/                web.js, api.js
tests/jmeter/            web.jmx, api.jmx
reports/                 index.json, index.html, runs/
.github/workflows/       performance.yml
```
