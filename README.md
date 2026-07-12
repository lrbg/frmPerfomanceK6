# frmPerformanceK6

Framework de pruebas de performance automatizadas con **menu interactivo**, **reportes HTML**, **historico unificado**, **monitoreo con alertas** y ejecucion en **CI/CD (GitHub Actions)**. Soporta dos motores intercambiables (**k6** y **JMeter**) y dos plataformas (**web** y **API**).

## Que hace

- Menu para elegir motor, plataforma, tipo de prueba y target.
- 5 tipos de prueba estandar: **smoke, load, stress, spike, soak**.
- Mide las **4 senales de oro (KPIs)**: disponibilidad (uptime), latencia (p95/p99), errores y throughput (**TPS/QPS**).
- **Alertas automaticas** cuando algo se cae, se degrada o esta mas lento de lo normal (comparando contra el historico). Abre un GitHub Issue con las metricas.
- **Monitoreo agendado** (cron) que vigila produccion sin intervencion.
- **Agente @claude** que triaja los issues de alerta y propone la causa o un PR.
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

Bloque `alerts` (reglas de alertamiento):

```json
"alerts": {
  "availability_min": 0.99,        // por debajo -> aviso; <= 50% -> caida critica
  "p95_regression_factor": 1.5,    // p95 actual > 1.5x el historico -> "mas lento de lo normal"
  "rps_drop_factor": 0.5,          // throughput < 50% del historico -> aviso
  "min_baseline_samples": 3,       // corridas previas minimas para comparar
  "channels": ["github"]           // canal de alerta
}
```

Los perfiles de carga de cada tipo de prueba estan en [`src/profiles.js`](src/profiles.js) (VUs y duracion para k6; threads/ramp-up/duracion para JMeter). Agregar un tipo nuevo es una entrada mas en ese objeto.

## Metricas y KPIs

Cada corrida normaliza las **4 senales de oro** (iguales para k6 y JMeter):

| KPI | Que detecta |
|---|---|
| **Disponibilidad** (uptime %) | Un sitio/API **caido** (peticiones fallando). <= 50% = alerta critica. |
| **Latencia** (p95/p99) | App **mas lenta de lo normal**. Alerta por umbral fijo y por regresion vs historico. |
| **Errores** (error_rate) | Degradacion parcial del servicio. |
| **Throughput** (TPS/QPS = req/seg) | Saturacion; una caida fuerte vs lo habitual dispara aviso. |

## Monitoreo y alertas

Con `--notify` la corrida evalua las reglas de `alerts` y, si detecta un problema, **abre un GitHub Issue** con el detalle y las metricas:

```bash
node bin/perf.js --tool k6 --platform api --type smoke --target demo --notify
```

El workflow [`.github/workflows/monitor.yml`](.github/workflows/monitor.yml) hace esto en automatico por **cron** (cada 15 min por defecto) contra tus targets de produccion. Requiere que `gh` este disponible (en CI lo esta con `GITHUB_TOKEN`).

## Agente de GitHub (@claude)

El workflow [`.github/workflows/claude.yml`](.github/workflows/claude.yml) instala el agente. Cuando el monitor abre un issue de alerta, mencionas **@claude** y el agente investiga el reporte, lo compara con el historico y propone la causa o un PR.

**Setup (una vez):** crea el secret `ANTHROPIC_API_KEY` en `Settings > Secrets and variables > Actions`. Sin el secret, el resto del framework funciona igual.

## Skills de autoria (opcional)

En `.agents/skills/` estan instaladas skills que ayudan a **escribir** los scripts: `k6`, `k6-docs` (Grafana), `jmeter-test-plan-creator` y `151-java-performance-jmeter`. Se gestionan con la CLI `skills`:

```bash
npx skills add https://github.com/grafana/skills --skill k6
```

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
src/orchestrator.js      corre motor -> reporte -> historico -> alertas -> dashboard
src/runner/              k6Runner.js, jmeterRunner.js
src/report/              buildReport.js (por corrida), buildIndex.js (dashboard)
src/alerts/              evaluate.js (reglas + baseline), github.js (crea issues)
tests/k6/                web.js, api.js
tests/jmeter/            web.jmx, api.jmx
reports/                 index.json, index.html, runs/
.github/workflows/       performance.yml (manual), monitor.yml (cron), claude.yml (agente)
.agents/skills/          skills de autoria k6/JMeter (opcional)
```
