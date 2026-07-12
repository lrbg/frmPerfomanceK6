#!/usr/bin/env node
import { resolveOptions } from '../src/menu.js';
import { run } from '../src/orchestrator.js';

const argv = process.argv.slice(2);

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`
frmPerformanceK6 - framework de pruebas de performance

Uso interactivo (menu):
  node bin/perf.js

Uso no-interactivo (CI/CD):
  node bin/perf.js --tool <k6|jmeter> --platform <web|api> --type <smoke|load|stress|spike|soak> --target <nombre|url>

Ejemplos:
  node bin/perf.js --tool k6 --platform web --type load --target demo
  node bin/perf.js --tool jmeter --platform api --type stress --target https://mi-api.com/health

Salida: codigo 0 si PASA los umbrales, 1 si FALLA (util como gate en CI).
`);
  process.exit(0);
}

try {
  const { opts, config } = await resolveOptions(argv);
  const meta = await run(opts, config);
  process.exit(meta.pass ? 0 : 1);
} catch (err) {
  console.error(`\nError: ${err.message}\n`);
  process.exit(2);
}
