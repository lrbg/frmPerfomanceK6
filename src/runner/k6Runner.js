import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from '../util.js';

// Ejecuta k6 contra el script de la plataforma (web.js / api.js).
// El script escribe summary.json en outDir via handleSummary.
// k6 termina con codigo != 0 si algun threshold se cruza -> sirve de gate en CI.
export function runK6({ platform, type, target, outDir, thresholds }) {
  const script = path.join(ROOT, 'tests', 'k6', `${platform}.js`);
  const env = {
    ...process.env,
    TEST_TYPE: type,
    BASE_URL: target,
    OUT_DIR: outDir,
    THRESH_P95: String(thresholds.p95_ms),
    THRESH_ERR: String(thresholds.error_rate),
  };

  const res = spawnSync('k6', ['run', script], { stdio: 'inherit', env });
  if (res.error) {
    throw new Error(
      `No se pudo ejecutar k6 (${res.error.message}). Instalalo desde https://k6.io/docs/get-started/installation/`
    );
  }
  return {
    summaryPath: path.join(outDir, 'summary.json'),
    exitCode: res.status ?? 1,
  };
}
